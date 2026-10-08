---
title: Contenedores
description: Los seis servicios del docker-compose de producción, sus imágenes, volúmenes, memoria y la instalación de Docker.
---

Todo el stack está en **un solo archivo**: `deploy/docker-compose.yml` (proyecto Compose `md`).
Es independiente del compose de desarrollo de la raíz del repo.

## Servicios

| Servicio | Imagen | Puerto al host | Límite RAM | Qué hace |
|---|---|---|---|---|
| `mysql` | `mysql:8.4` | — | 640 MB | Base de datos ([Base de datos](/deploy/infrastructure/database/)) |
| `api` | `ghcr.io/reyes200205/md-api` | — | 448 MB | Laravel en PHP-FPM 8.4 con OPcache |
| `queue` | misma que `api` | — | 192 MB | `php artisan queue:work --sleep=3 --tries=3 --max-time=3600` |
| `scheduler` | misma que `api` | — | 192 MB | `php artisan schedule:work` ([Tareas programadas](/deploy/operations/scheduled-tasks/)) |
| `web` | `ghcr.io/reyes200205/md-web` | — | 160 MB | Nuxt servido por Nitro (Node 22) |
| `nginx` | `nginx:stable-alpine` | **443** | 64 MB | Único punto de entrada ([Red y TLS](/deploy/infrastructure/network-and-tls/)) |

Todos con `restart: unless-stopped`. `api`, `queue` y `scheduler` comparten un bloque común
(`x-api`): misma imagen, mismo `.env`, mismos volúmenes; solo cambia el comando.

- **`queue` y `scheduler` corren como `www-data`**, para no crear archivos de root dentro de `storage/`.
- **La API no conoce la contraseña de root de MySQL**: aunque comparte el `.env`, el compose vacía
  `DB_ROOT_PASSWORD` dentro de sus contenedores.
- **Healthchecks**: `mysql` (`mysqladmin ping`), `web` (GET `/`) y `nginx` (GET `/up` por un
  puerto interno, que atraviesa nginx → PHP-FPM → Laravel). `api` espera a que `mysql` esté sano.

## Imágenes

| Imagen | Dockerfile | Etiquetas |
|---|---|---|
| `md-api` | `docker/php/Dockerfile`, target `prod` | SHA completo del commit y `latest` |
| `md-web` | `docker/node/Dockerfile`, target `prod` | SHA completo del commit y `latest` |

Las construye `.github/workflows/build-images.yml` en cada push a `main` (o a mano con *Run
workflow*). El compose usa `${IMAGE_TAG:-latest}`: sin `IMAGE_TAG` toma `latest`, y fijar un SHA es
el mecanismo de [Rollback](/deploy/operations/rollback/).

**`md-api`**: código y dependencias de Composer horneados en la imagen, OPcache con
`validate_timestamps=Off` y la configuración de PHP de producción. El `.env` **no** va en la
imagen: llega en tiempo de ejecución, por eso el entrypoint ejecuta `config:cache`, `route:cache`
y `storage:link` en cada arranque.

**`md-web`**: la URL de la API (`NUXT_PUBLIC_API_URL`) se fija **al compilar** (build arg del
workflow), no en tiempo de ejecución. Cambiar de dominio de API requiere reconstruir `web`.

:::caution[Consecuencia del caché de configuración]
Editar el `.env` no tiene efecto hasta **recrear** los contenedores:
`sudo docker compose up -d --force-recreate api queue scheduler`. Un `restart` no basta: el
`env_file` solo se lee al crear el contenedor.
:::

## Volúmenes y montajes

| Volumen / montaje | Usado por | Contenido |
|---|---|---|
| `md_mysql_data` | `mysql` | **Los datos de la base.** Nunca lo borres |
| `md_api_storage` | `api`, `queue`, `scheduler` (lectura y escritura), `nginx` (solo lectura) | `storage/` de Laravel: disco `public`, logs, caché de fuentes de DomPDF |
| `./secrets` → `/run/secrets/md` | `api`, `queue`, `scheduler` (solo lectura) | Cuenta de servicio de Firebase |
| `./nginx/conf.d`, `./certs` | `nginx` (solo lectura) | Vhosts y certificado Origin CA |
| `./mysql/prod.cnf` | `mysql` (solo lectura) | Configuración de MySQL |

:::danger
`docker compose down -v` y `docker volume prune` **borran los volúmenes**, es decir, la base de
datos. No existe un caso de operación normal en el que haga falta ninguno de los dos.
:::

## Memoria

| Componente | Uso típico medido | Límite |
|---|---|---|
| Sistema + Docker | ~350 MB | — |
| `mysql` | ~290 MB | 640 MB |
| `api` | ~55 MB | 448 MB |
| `queue` | ~45 MB | 192 MB |
| `scheduler` | ~45 MB (estimado, igual que `queue`) | 192 MB |
| `web` | ~70 MB | 160 MB |
| `nginx` | ~10 MB | 64 MB |

Si un contenedor pasa su límite, Docker lo reinicia a él, no tumba el servidor. Revisa el uso real
con `sudo docker stats --no-stream` y `free -h`.

## Instalación de Docker

Desde el repositorio oficial, con la firma verificada:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

La huella de la llave debe ser `9DC8 5822 9FC7 DD38 854A E2D8 8D81 803C 0EBF CD88`
(`sudo gpg --show-keys --with-fingerprint /etc/apt/keyrings/docker.asc`).

`/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
```

- **Rotación de logs**: como máximo 30 MB por contenedor; los logs no llenan el disco.
- **`live-restore`**: los contenedores siguen corriendo si el daemon de Docker se reinicia.

Después de crearlo o cambiarlo: `sudo systemctl restart docker` y comprueba con
`sudo docker info --format '{{.LoggingDriver}} live-restore={{.LiveRestoreEnabled}}'`
(debe mostrar `json-file live-restore=true`). La rotación solo aplica a contenedores creados
después del cambio.

Docker se actualiza **a mano** (`apt-get install --only-upgrade docker-ce ...`), en un momento
tranquilo, porque reinicia el daemon.
