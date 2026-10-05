---
title: Red y TLS
description: Cloudflare, certificados, Security Group, nginx y cómo se obtiene la IP real del visitante.
---

El tráfico pasa por cuatro capas, de afuera hacia adentro:

| Capa | Qué hace |
|---|---|
| **Cloudflare** | DNS, proxy, HTTP→HTTPS, certificado público, protección DDoS |
| **Security Group de AWS** | Solo deja entrar al 443 desde los rangos de Cloudflare: nadie llega al servidor sin pasar por Cloudflare |
| **UFW** | Protege los servicios del host (SSH). No filtra los puertos de Docker ([por qué](/deploy/infraestructura/servidor/#firewall-ufw)) |
| **nginx** | Único contenedor con puerto publicado; reparte entre `web` y `api` |

## Cloudflare

| Ajuste | Valor |
|---|---|
| DNS | `A mdmexico.online` y `A api` → Elastic IP, **con proxy** (nube naranja) |
| SSL/TLS | **Full (strict)**: Cloudflare exige un certificado válido en el origen |
| Always Use HTTPS | Encendido (por eso el puerto 80 está cerrado en el servidor) |
| TLS mínimo | 1.2 |

:::caution
Un registro DNS **sin proxy** (nube gris) expone la IP del servidor y salta Cloudflare. Ambos
registros deben ir con proxy.
:::

## Certificado de origen

**Cloudflare Origin CA**, emitido para `mdmexico.online` y `*.mdmexico.online`, válido hasta 2041.

- Solo lo aceptan los servidores de Cloudflare; un navegador que entrara directo lo rechazaría (es
  lo que se busca).
- No hay renovaciones ni certbot.
- La llave privada se generó en el servidor y nunca salió de él: `deploy/certs/origin.key` (600),
  fuera de git.

## Security Group

| Puerto | Origen |
|---|---|
| 443 | Lista de prefijos administrada con los rangos IPv4 de Cloudflare |
| 22 | Administración |
| 80 | Sin regla |

Los rangos de Cloudflare cambian muy rara vez ([cloudflare.com/ips](https://www.cloudflare.com/ips/)).
Si cambian, hay que actualizar la lista de prefijos **y** `deploy/nginx/conf.d/00-common.conf`.

## nginx

Tres archivos en `deploy/nginx/conf.d/`:

| Archivo | Contenido |
|---|---|
| `00-common.conf` | IP real, resolver de Docker, rechazo de hosts desconocidos y healthcheck interno |
| `api.conf` | `api.mdmexico.online` → PHP-FPM |
| `web.conf` | `mdmexico.online` → Nitro |

### Decisiones

- **nginx no tiene el código de la API.** Todo se manda al front controller con
  `SCRIPT_FILENAME=/var/www/html/public/index.php` fijo: PHP-FPM lo abre en su propio contenedor y
  ningún otro `.php` puede ejecutarse. Una sola fuente de verdad: la imagen de `api`.
- **Archivos del disco `public`**: `/storage/` se sirve desde el volumen `md_api_storage`
  montado en solo lectura.
- **Hosts desconocidos rechazados**: quien entre por la IP directa o con otro dominio recibe un
  rechazo en el handshake TLS (`ssl_reject_handshake`), sin llegar a la app.
- **Upstreams re-resueltos**: `resolver 127.0.0.11` y variables para `api`/`web`. Cuando un deploy
  recrea un contenedor y cambia su IP, nginx no se queda apuntando a la vieja.
- **Timeout de 100 s** hacia PHP-FPM, igual que el corte de Cloudflare.
- **Sin `X-Powered-By`** ni versión de nginx en las respuestas.
- Cuerpo máximo de **100 MB** en la API (importaciones y adjuntos).

### IP real del visitante

```nginx
real_ip_header CF-Connecting-IP;
set_real_ip_from 173.245.48.0/20;
# ... resto de rangos de Cloudflare
```

nginx toma la IP de `CF-Connecting-IP` **solo si la conexión viene de un rango de Cloudflare**.
Así Laravel ve la IP real en los logs, la auditoría y el *rate limit*, y nadie puede falsearla
mandando cabeceras.

### Cambiar la configuración de nginx

Se edita en el repo, se sube y en el servidor:

```bash
cd /opt/md && git pull --ff-only && cd deploy
```

```bash
sudo docker compose exec nginx nginx -t
```

Solo si responde `syntax is ok`:

```bash
sudo docker compose restart nginx
```

## CORS

La API solo acepta peticiones del navegador desde los orígenes de `CORS_ALLOWED_ORIGINS`
(`https://mdmexico.online`). Ver [Variables de entorno](/deploy/configuracion/variables/).
