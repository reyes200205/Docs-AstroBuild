---
title: Diagnóstico
description: Comandos para revisar el estado de producción y soluciones a los problemas más comunes.
---

Todos los comandos se ejecutan en el servidor, en `/opt/md/deploy`.

## Comandos útiles

| Comando | Para qué |
|---|---|
| `sudo docker compose ps` | Estado de los 6 servicios |
| `sudo docker compose logs -f --tail=50 api` | Errores de la API en vivo (`Ctrl+C` para salir) |
| `sudo docker compose logs --tail=50 queue` | Worker de colas |
| `sudo docker compose logs --tail=50 scheduler` | Tareas programadas |
| `sudo docker compose logs --tail=20 nginx` | Peticiones y errores de nginx |
| `sudo docker compose exec api php artisan queue:failed` | Jobs de la cola que fallaron |
| `sudo docker compose exec api php artisan about` | Entorno, caché de configuración y drivers en uso |
| `sudo docker compose exec api php artisan vacations:renew --dry-run` | A quién se le renovarían hoy las vacaciones, sin guardar nada |
| `sudo docker compose restart <servicio>` | Reiniciar un servicio (no relee el `.env`) |
| `sudo docker compose up -d --force-recreate api queue scheduler` | Recrear para que tomen el `.env` |
| `sudo docker stats --no-stream` y `free -h` | Memoria y CPU |
| `df -h /` y `sudo docker system df` | Disco |
| `sudo docker compose images` | Imágenes en uso |

### Ver un valor de configuración en uso

```bash
sudo docker compose exec api php artisan tinker --execute="echo config('filesystems.disks.s3.bucket');"
```

Si no coincide con el `.env`, falta recrear los contenedores.

## Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `permission denied ... docker.sock` | Falta `sudo` (en una cadena con `&&`, cada comando lleva el suyo) | Repite con `sudo`. Si era el `up -d`, no se aplicó nada |
| La app sigue como la versión anterior | Se hizo `pull` pero el `up -d` no corrió o falló | `sudo docker compose up -d` y revisa la fecha de la imagen |
| Un cambio en el `.env` no tiene efecto | Se usó `restart` en lugar de recrear | `sudo docker compose up -d --force-recreate api queue scheduler` |
| `Unknown column ...` después de desplegar | Se editó una migración que ya había corrido, o se saltó el paso de migraciones | Migración nueva y paso 5 ([Migraciones](/deploy/operacion/migraciones/)) |
| `unauthorized` al hacer `pull` | Venció el token de GHCR | Token nuevo con `read:packages` y `docker login ghcr.io` ([Instalación](/deploy/instalacion/#4-el-proyecto)) |
| `manifest unknown` al hacer `pull` | El build no terminó o falló | Revisa *Actions* en GitHub |
| `git pull` avisa de cambios locales | Alguien editó un archivo del clon | `git status` y `git checkout -- <archivo>`. **No toques** `.env`, `certs/` ni `secrets/` |
| 502 / 504 | `api` o `web` no arrancaron | `ps` y `logs api` |
| 500 en la API | Error de la aplicación | `logs --tail=100 api` |
| 522 (Cloudflare) | Cloudflare no llega al servidor | Contenedores arriba, Security Group, Elastic IP asociada |
| 524 (Cloudflare) | Una petición tardó más de 100 s | Reducir el trabajo de esa petición o hacerlo en la cola |
| 526 (Cloudflare) | Certificado de origen inválido | `deploy/certs/` y modo *Full (strict)* |
| Imágenes o archivos que no cargan | Credenciales o bucket de S3 equivocados | Revisa `AWS_*` y el valor en uso (arriba) |
| Correos que no llegan | `MAIL_MAILER=log` (SMTP pendiente) | Se escriben en el log de la API |
| Se ve el frontend viejo | Caché del navegador o de Cloudflare | `Ctrl+F5`; si sigue, *Caching → Purge Everything* |
| Disco lleno | Imágenes viejas | `sudo docker image prune -f` |
| Jobs que no se procesan | Worker `queue` caído | `logs queue`, `restart queue` |
| Tareas programadas que no corren | [Tareas programadas → Problemas](/deploy/operacion/tareas-programadas/#problemas) | |
