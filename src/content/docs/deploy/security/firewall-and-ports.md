---
title: Firewall y puertos
description: Comprobar UFW, los puertos abiertos en el host y en Docker, el Security Group, que el origen siga oculto detrás de Cloudflare y los rangos de Cloudflare.
---

El objetivo: **nadie llega al servidor sin pasar por Cloudflare**, y solo los puertos 22 y 443
están abiertos. El porqué de cada capa está en [Red y TLS](/deploy/infrastructure/network-and-tls/).

:::danger[Docker se salta UFW]
Un contenedor que publica un puerto (`ports:` en el compose) queda abierto aunque UFW diga lo
contrario. Por eso **solo `nginx` publica puertos** y el filtro real del 443 es el Security Group.
Revisa [contenedores con puertos](#contenedores-con-puertos) después de cualquier cambio al compose.
:::

## UFW

```bash
sudo ufw status verbose
```

Lo esperado:

```text
Status: active
Default: deny (incoming), allow (outgoing), deny (routed)
22/tcp                     ALLOW IN    Anywhere          # SSH
443/tcp                    ALLOW IN    Anywhere          # HTTPS desde Cloudflare
22/tcp (v6)                ALLOW IN    Anywhere (v6)     # SSH
443/tcp (v6)               ALLOW IN    Anywhere (v6)     # HTTPS desde Cloudflare
```

Con número de regla (para borrar una con `sudo ufw delete <n>`):

```bash
sudo ufw status numbered
```

Conexiones que UFW bloqueó hoy:

```bash
sudo journalctl -k --since today | grep "UFW BLOCK" | tail -n 20
```

## Puertos escuchando en el host

```bash
sudo ss -tulpn
```

| Dirección | Proceso | Normal |
|---|---|---|
| `0.0.0.0:22`, `[::]:22` | `sshd` o `systemd` (socket de SSH) | Sí |
| `0.0.0.0:443`, `[::]:443` | `docker-proxy` | Sí: es nginx |
| `127.0.0.53:53`, `127.0.0.54:53` | `systemd-resolve` | Sí: DNS local, solo en loopback |
| UDP `68` | `systemd-networkd` | Sí: DHCP de AWS |
| Cualquier otro en `0.0.0.0` o `[::]` | — | **No**: investiga qué es |

Para saber qué es un proceso desconocido:

```bash
sudo ss -tulpn | grep :<puerto>
```

```bash
ps -fp <PID>
```

## Contenedores con puertos

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Solo `md-nginx-1` debe mostrar `0.0.0.0:443->443/tcp`. Los demás muestran puertos internos
(`3306/tcp`, `9000/tcp`, `3000/tcp`) **sin** `0.0.0.0:`, lo que significa que solo se alcanzan
desde la red de Docker.

Contenedores que no forman parte del stack (no debería haber ninguno):

```bash
sudo docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -v '^md-'
```

## Security Group

Consola de AWS → *EC2* → la instancia → pestaña *Security* → el Security Group → *Inbound rules*:

| Regla | Esperado |
|---|---|
| HTTPS 443 | Origen `pl-...` (la lista `cloudflare-ipv4`) |
| SSH 22 | Tu IP o la de administración |
| Cualquier regla con origen `0.0.0.0/0` o `::/0` | **No debe existir** |
| HTTP 80 | **No debe existir** |

## Probar desde fuera

Desde **tu PC**, no desde el servidor.

El origen **no** debe responder por IP directa (el Security Group lo corta):

```bash
curl -vk --max-time 10 https://<elastic-ip>/
```

Debe terminar en `Connection timed out` o `Operation timed out`. Si responde con un error de TLS
(`handshake failure`), el 443 está abierto a internet: **revisa el Security Group ya**.

En Windows (PowerShell):

```powershell
Test-NetConnection <elastic-ip> -Port 443
```

`TcpTestSucceeded : False` es lo correcto.

Ni MySQL ni el 80 deben estar abiertos:

```powershell
Test-NetConnection <elastic-ip> -Port 3306; Test-NetConnection <elastic-ip> -Port 80
```

## Cloudflare

Los dominios deben resolver a IPs **de Cloudflare**, nunca a la Elastic IP:

```bash
nslookup mdmexico.online && nslookup api.mdmexico.online
```

Lo normal son direcciones `104.21.x.x` o `172.67.x.x`. Si aparece la Elastic IP, ese registro
está **sin proxy** (nube gris): actívalo en Cloudflare → *DNS*.

Otras comprobaciones en el panel de Cloudflare:

| Dónde | Esperado |
|---|---|
| *SSL/TLS → Overview* | **Full (strict)** |
| *SSL/TLS → Edge Certificates* | *Always Use HTTPS* encendido, TLS mínimo 1.2 |
| *SSL/TLS → Origin Server* | Un solo certificado activo, válido hasta 2041 |
| *Security → Events* | Picos de bloqueos o desafíos: indican un ataque o un bot insistente |

## Rangos de Cloudflare

Si Cloudflare agrega rangos y no se actualizan, parte del tráfico legítimo quedará bloqueado por el
Security Group (errores 522) y nginx no verá la IP real de esos visitantes.

Compara la lista oficial con la configuración de nginx (en el servidor):

```bash
diff <(curl -s https://www.cloudflare.com/ips-v4; echo) <(grep -oE 'set_real_ip_from [0-9./]+' /opt/md/deploy/nginx/conf.d/00-common.conf | awk '{print $2}') && echo "Rangos al día"
```

Si hay diferencias, actualiza **las dos cosas**: la lista de prefijos `cloudflare-ipv4` en AWS y
`deploy/nginx/conf.d/00-common.conf` en el repo (después, despliega la configuración de nginx como
dice [Red y TLS](/deploy/infrastructure/network-and-tls/#cambiar-la-configuración-de-nginx)).
