---
title: fail2ban
description: Estado de la jail de SSH, IPs bloqueadas, desbloquear o bloquear a mano, logs y cambios de configuración.
---

fail2ban vigila los intentos de login por SSH y bloquea durante **1 hora** a cualquier IP que
falle **5 veces en 10 minutos**. Solo protege SSH: el tráfico web llega desde las IPs de
Cloudflare y lo filtra el Security Group.

Configuración: `/etc/fail2ban/jail.d/sshd.local` ([Servidor](/deploy/infrastructure/server/#fail2ban)).

## Estado

Servicio y jails activas:

```bash
sudo systemctl status fail2ban --no-pager
```

```bash
sudo fail2ban-client status
```

Debe listar `Jail list: sshd`.

Detalle de la jail de SSH:

```bash
sudo fail2ban-client status sshd
```

| Campo | Significado |
|---|---|
| `Currently failed` | IPs con fallos recientes que aún no llegan al límite |
| `Total failed` | Fallos desde que arrancó fail2ban |
| `Currently banned` | IPs bloqueadas ahora mismo |
| `Total banned` | Bloqueos desde que arrancó fail2ban |
| `Banned IP list` | Las IPs bloqueadas |

IPs bloqueadas con la hora en que se liberan:

```bash
sudo fail2ban-client get sshd banip --with-time
```

## Desbloquear una IP

Por ejemplo, la tuya después de equivocarte de llave varias veces:

```bash
sudo fail2ban-client set sshd unbanip <IP>
```

Todas a la vez:

```bash
sudo fail2ban-client unban --all
```

## Bloquear una IP a mano

```bash
sudo fail2ban-client set sshd banip <IP>
```

Dura lo mismo que un bloqueo normal (1 hora). Para bloquear de forma permanente, mejor en UFW:

```bash
sudo ufw insert 1 deny from <IP> to any port 22 proto tcp
```

## Logs

Últimos eventos:

```bash
sudo tail -n 50 /var/log/fail2ban.log
```

Solo los bloqueos de hoy:

```bash
sudo grep "$(date +%F)" /var/log/fail2ban.log | grep -E " Ban | Unban "
```

Las IPs más bloqueadas (incluye los archivos rotados):

```bash
sudo zgrep -h " Ban " /var/log/fail2ban.log* | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$" | sort | uniq -c | sort -rn | head
```

En vivo (`Ctrl+C` para salir):

```bash
sudo tail -f /var/log/fail2ban.log
```

## Valores efectivos

```bash
for k in maxretry findtime bantime; do printf "%s: " $k; sudo fail2ban-client get sshd $k; done
```

Debe mostrar `maxretry: 5`, `findtime: 600` y `bantime: 3600` (en segundos).

## Cambiar la configuración

Edita el archivo, valida y reinicia:

```bash
sudo nano /etc/fail2ban/jail.d/sshd.local
```

```bash
sudo fail2ban-client -t && sudo systemctl restart fail2ban
```

`-t` comprueba la sintaxis antes de reiniciar. Al reiniciar se pierden los bloqueos actuales.

Ejemplo para reincidentes: bloqueos que crecen cada vez que una IP vuelve a caer, hasta 1 semana.
Agrega a la sección `[sshd]`:

```ini
bantime.increment = true
bantime.maxtime   = 1w
```

:::caution[No agregues jails para nginx]
Las peticiones web llegan desde las IPs de **Cloudflare**, no de los visitantes. Una jail que
bloqueara por IP en el firewall bloquearía a Cloudflare entero y tumbaría el sitio. Los abusos
web se frenan en Cloudflare (*Security → WAF*) y con el límite de intentos de la API.
:::

## Problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `Jail list` vacío | El archivo de la jail no se cargó o tiene un error | `sudo fail2ban-client -t` y revisa `/var/log/fail2ban.log` |
| `Total failed` siempre en 0 aunque `journalctl -u ssh` muestra fallos | La jail no lee el journal | Confirma `backend = systemd` en `sshd.local` |
| fail2ban no arranca después de una actualización | Cambio de configuración del paquete | `sudo journalctl -u fail2ban -n 50 --no-pager` |
