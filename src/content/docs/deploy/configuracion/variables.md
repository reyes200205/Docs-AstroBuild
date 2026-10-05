---
title: Variables de entorno
description: Qué va en el .env del servidor, para qué sirve cada variable y dónde vive cada secreto.
---

Toda la configuración de producción está en **`/opt/md/deploy/.env`** (permisos 600, fuera de
git). La plantilla con todas las variables es `deploy/.env.example` en el repo. Docker Compose lo
lee para las credenciales de MySQL y lo pasa completo a `api`, `queue` y `scheduler`.

:::caution[Después de editar el .env]
```bash
sudo docker compose up -d --force-recreate api queue scheduler
```
Un `restart` no basta: el `.env` se lee al **crear** el contenedor y Laravel cachea la
configuración al arrancar.
:::

Reglas del archivo: contraseñas solo con letras y números (evita problemas de escape) y
comentarios en su propia línea, nunca al final de un valor.

## MySQL

| Variable | Valor | Notas |
|---|---|---|
| `DB_DATABASE` | `md` | |
| `DB_USERNAME` | `md` | Usuario de la app, sin privilegios globales |
| `DB_PASSWORD` | secreto | Solo se lee al crear el volumen ([ver](/deploy/infraestructura/base-de-datos/#usuarios)) |
| `DB_ROOT_PASSWORD` | secreto | Lo usa solo el contenedor `mysql`; la API lo recibe vacío |

`DB_HOST`, `DB_PORT` y `DB_CONNECTION` los fija el compose; no van en el `.env`.

## Aplicación

| Variable | Valor en producción | Notas |
|---|---|---|
| `APP_ENV` | `production` | |
| `APP_DEBUG` | `false` | **Nunca `true`**: mostraría trazas y configuración en los errores |
| `APP_KEY` | secreto | `sudo docker compose run --rm api php artisan key:generate --show`. Cambiarlo invalida todo lo cifrado |
| `APP_URL` | `https://api.mdmexico.online` | |
| `FRONTEND_URL` | `https://mdmexico.online` | Enlaces en correos y notificaciones |
| `CORS_ALLOWED_ORIGINS` | `https://mdmexico.online` | Separados por coma |
| `APP_TIMEZONE` | `America/Monterrey` | **No lo cambies** con datos reales: cambia el significado de las fechas guardadas |
| `APP_LOCALE` / `APP_FALLBACK_LOCALE` | `es` / `en` | |
| `LOG_CHANNEL` | `stderr` | Los logs se ven con `docker compose logs` |
| `LOG_LEVEL` | `warning` | |
| `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION` | `database` | Sin Redis |
| `BROADCAST_CONNECTION` | `log` | Sin WebSockets; las notificaciones van por REST y push |

## Archivos (S3)

| Variable | Notas |
|---|---|
| `FILESYSTEM_DISK` | `s3`. Varios modelos generan las URLs con el disco por defecto, así que debe coincidir con donde se sube |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Usuario IAM de la app (secreto) |
| `AWS_DEFAULT_REGION` / `AWS_BUCKET` | Región y nombre del bucket |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `false` |

Permisos que necesita el usuario IAM: los de los archivos de la app y, para los respaldos,
listar y borrar en `backups/` ([Respaldos](/deploy/operacion/respaldos/#permisos-de-aws)).

## Respaldos

| Variable | Valor | Notas |
|---|---|---|
| `BACKUP_DISK` | `s3` | `local` los dejaría en el mismo servidor, que no sirve como respaldo real |
| `BACKUP_KEEP_DAYS` | `14` | Los más viejos se borran solos; siempre quedan los 3 más recientes |

## Notificaciones push (Firebase)

| Variable | Notas |
|---|---|
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | Configuración web pública; la API se la entrega al frontend |
| `FIREBASE_VAPID_KEY` | Firebase Console → Cloud Messaging |
| `FIREBASE_CREDENTIALS_PATH` | `/run/secrets/md/firebase-credentials.json`. El archivo va en `deploy/secrets/`. Sin él, el push queda apagado sin errores |

## Pantallas kiosko

| Variable | Notas |
|---|---|
| `KIOSK_SYNC_TOKEN` | Token (`X-Api-Key`) con el que Power Automate envía los datos de los dashboards. Vacío = endpoint deshabilitado |
| `KIOSK_ACCESS_KEY` | Clave para vincular una TV sin celular. Vacía = ese método no aparece |

Genera cada token con `openssl rand -hex 32`.

## Correo

| Variable | Valor actual |
|---|---|
| `MAIL_MAILER` | `log` (los correos solo se escriben al log: **el proveedor SMTP está pendiente**) |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION` | Vacías hasta definir proveedor |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Remitente |

## Asistente de IA

| Variable | Notas |
|---|---|
| `AI_DEFAULT_PROVIDER` | `groq` |
| `AI_TIMEOUT` | Segundos |
| `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL` | Proveedor principal |
| `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL` | Alternativo |

## Rollback

| Variable | Notas |
|---|---|
| `IMAGE_TAG` | **Normalmente no existe.** Solo durante un [rollback](/deploy/operacion/rollback/): fija las imágenes a un SHA |

## Configuración que no está en el .env

Algunos valores se cambian desde la app, sin tocar el servidor, y se guardan en la base de datos:

- **Management → Configuración General**: forzar cambio de contraseña, duración de las sesiones.
- **RH → Configuración General**: reglas de vacaciones y permisos.
- **Management → Tareas Programadas**: horario y encendido de cada tarea.
- **Management → Módulos**: módulos y funcionalidades encendidos.

## Dónde vive cada secreto

| Secreto | Dónde | En git |
|---|---|---|
| Contraseñas de MySQL, `APP_KEY`, llaves de AWS, IA, Firebase, tokens | `deploy/.env` en el servidor | No |
| Certificado y llave Origin CA | `deploy/certs/` en el servidor | No |
| Cuenta de servicio de Firebase | `deploy/secrets/` en el servidor | No |
| Llave de solo lectura del repo | `~/.ssh/md_repo` del usuario `ubuntu` | No |
| Token de lectura de GHCR | Credenciales de Docker de root en el servidor | No |
| `NUXT_PUBLIC_API_URL` | Build arg en el workflow (es pública, termina en el JS) | Sí |

Los secretos de la app **nunca pasan por GitHub Actions**: el pipeline no los conoce, así que no
puede filtrarlos.
