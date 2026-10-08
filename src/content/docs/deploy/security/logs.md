---
title: Logs
description: Dónde está cada log de seguridad del servidor, de nginx y de la aplicación, y los comandos para encontrar lo que importa.
---

## Dónde está cada log

| Qué | Dónde | Cuánto dura |
|---|---|---|
| Accesos SSH, `sudo`, sistema | journal de systemd (`journalctl`) | Hasta llenar su límite de disco |
| Bloqueos de UFW | journal del kernel (`journalctl -k`) | Igual |
| fail2ban | `/var/log/fail2ban.log` | Rotado semanalmente |
| Parches automáticos | `/var/log/unattended-upgrades/` | Rotado |
| Peticiones web (nginx) | Logs del contenedor `nginx` | **~30 MB** (rotación de Docker) |
| Errores de la API | Logs de los contenedores `api`, `queue`, `scheduler` | ~30 MB cada uno |
| Acciones de los usuarios en la app | Base de datos → Management → **Auditorías** | Permanente |

:::caution
Los logs de los contenedores se pierden al **recrearlos** (cada despliegue recrea `api`, `queue`,
`scheduler` y `web`) y al rotar. Si investigas algo, copia lo que necesitas antes de desplegar:

```bash
sudo docker compose logs --no-log-prefix --since 48h nginx > ~/nginx-$(date +%F).log
```
:::

## Sistema

Errores de las últimas 24 horas (prioridad *error* o peor):

```bash
sudo journalctl -p err --since "24 hours ago" --no-pager
```

Todo lo de un servicio:

```bash
sudo journalctl -u ssh --since today --no-pager
```

```bash
sudo journalctl -u docker --since today --no-pager
```

En vivo (`Ctrl+C` para salir):

```bash
sudo journalctl -f
```

Espacio que ocupa el journal:

```bash
journalctl --disk-usage
```

Accesos SSH, intentos fallidos y uso de `sudo` tienen su propia página:
[SSH y accesos](/deploy/security/ssh-and-access/).

## Docker

Arranques, paradas y reinicios de contenedores. Un reinicio que no hiciste puede ser un contenedor
que se queda sin memoria o que falla al arrancar:

```bash
sudo docker events --since 24h --until now --filter type=container --format '{{.Time}} {{.Action}} {{.Actor.Attributes.name}}' | grep -vE "exec_|health_status"
```

Contenedores que se quedaron sin memoria:

```bash
sudo docker inspect --format '{{.Name}} OOMKilled={{.State.OOMKilled}} Restarts={{.RestartCount}}' $(sudo docker ps -aq)
```

## nginx

nginx escribe cada petición en el formato estándar de nginx: `IP - - [fecha] "MÉTODO ruta" código bytes "referer" "user-agent"`.
La IP es la **real del visitante** (nginx la toma de `CF-Connecting-IP` solo si la petición viene
de Cloudflare).

Últimas peticiones:

```bash
sudo docker compose logs --no-log-prefix --tail=50 nginx
```

IPs con más peticiones en las últimas 24 horas:

```bash
sudo docker compose logs --no-log-prefix --since 24h nginx | awk '{print $1}' | sort | uniq -c | sort -rn | head -n 15
```

Respuestas de error por código:

```bash
sudo docker compose logs --no-log-prefix --since 24h nginx | awk '$9 ~ /^[45][0-9][0-9]$/ {print $9}' | sort | uniq -c | sort -rn
```

| Código | Qué indica |
|---|---|
| `401` | Token inválido o login fallido |
| `403` | Usuario sin permiso para esa acción |
| `404` en rutas raras | Escaneos automáticos |
| `413` | Archivo de más de 100 MB |
| `429` | Alguien llegó al límite de peticiones |
| `5xx` | Error de la app: revisa los [logs de la API](#aplicación) |

Logins fallidos (la API responde `401`) y por IP:

```bash
sudo docker compose logs --no-log-prefix --since 24h nginx | grep '"POST /api/v1/login' | awk '$9 == 401 {print $1}' | sort | uniq -c | sort -rn | head
```

Peticiones frenadas por el límite de intentos:

```bash
sudo docker compose logs --no-log-prefix --since 24h nginx | awk '$9 == 429' | tail -n 20
```

Escaneos buscando archivos sensibles (no existen en el servidor, pero indica quién está probando):

```bash
sudo docker compose logs --no-log-prefix --since 168h nginx | grep -iE '\.env|\.git|wp-(login|admin)|phpmyadmin|\.php[^/]|/etc/passwd' | awk '{print $1, $7}' | sort | uniq -c | sort -rn | head -n 20
```

Errores del propio nginx (certificados, upstream caído):

```bash
sudo docker compose logs --no-log-prefix --since 24h nginx | grep -E '\[(error|crit|alert|emerg)\]'
```

:::note
Las conexiones por IP directa o con un dominio desconocido se rechazan en el handshake TLS
(`ssl_reject_handshake`) y **no aparecen** en el log de acceso. Y si el Security Group está bien,
ni siquiera llegan.
:::

## Aplicación

Laravel escribe a `stderr` con nivel `warning` o superior (`LOG_LEVEL=warning`).

Errores y excepciones de las últimas 24 horas:

```bash
sudo docker compose logs --no-log-prefix --since 24h api queue scheduler | grep -iE "\.(ERROR|CRITICAL|ALERT|EMERGENCY)|exception" | tail -n 30
```

Trabajos de cola que fallaron:

```bash
sudo docker compose exec api php artisan queue:failed
```

### Auditorías

La app registra quién hizo qué: **Management → Auditorías** (permiso
`management.audit_logs.view`). Revisa sobre todo:

- Cambios de roles y permisos.
- Usuarios nuevos o reactivados.
- Cambios en Configuración General y en Tareas Programadas.

### Sesiones de usuario

Cada inicio de sesión crea un token con el dispositivo y el user agent. Cada usuario ve y cierra los
suyos desde su cuenta (*Sesiones*), y RH puede cerrar la sesión de un empleado desde su ficha. Para
ver en la base cuántos tokens activos tiene cada usuario:

```bash
sudo docker compose exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" md -e "SELECT tokenable_id AS usuario, COUNT(*) AS tokens, MAX(last_used_at) AS ultimo_uso FROM personal_access_tokens GROUP BY tokenable_id ORDER BY tokens DESC LIMIT 20"'
```
