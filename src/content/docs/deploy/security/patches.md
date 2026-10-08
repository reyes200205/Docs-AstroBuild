---
title: Parches
description: Comprobar que los parches automáticos del sistema se aplican, reinicios pendientes y cómo actualizar a mano Docker y las imágenes base.
---

| Qué | Se actualiza | Cómo |
|---|---|---|
| Paquetes de Ubuntu (seguridad) | **Solo**, cada día | `unattended-upgrades`; reinicia a las 09:00 UTC si hace falta |
| Docker Engine | **A mano** | [Docker](#docker) |
| Imágenes `mysql` y `nginx` | **A mano** | [Imágenes base](#imágenes-base) |
| Imágenes `md-api` y `md-web` | Con cada build de GitHub Actions | [Imágenes de la app](#imágenes-de-la-app) |

La configuración de los parches automáticos está en [Servidor](/deploy/infrastructure/server/#parches-automáticos).

## Sistema

¿Hay paquetes pendientes?

```bash
apt list --upgradable 2>/dev/null
```

Los que quedan pendientes suelen ser de Docker (no se actualiza solo) o actualizaciones que no son
de seguridad. Si hay muchos paquetes de Ubuntu acumulados, revisa que los parches automáticos estén
funcionando.

¿Hay un reinicio pendiente y por qué?

```bash
cat /var/run/reboot-required /var/run/reboot-required.pkgs 2>/dev/null || echo "Sin reinicio pendiente"
```

Se resuelve solo a las 09:00 UTC (03:00 Monterrey). Para reiniciar antes, en un momento tranquilo:

```bash
sudo reboot
```

Los contenedores vuelven solos (`restart: unless-stopped`). Comprueba después con
`sudo docker compose ps`.

Tiempo encendido y últimos reinicios:

```bash
uptime && last reboot -n 5
```

### ¿Funcionan los parches automáticos?

Últimas ejecuciones:

```bash
sudo tail -n 30 /var/log/unattended-upgrades/unattended-upgrades.log
```

Qué paquetes se instalaron:

```bash
sudo zgrep -h "Packages that will be upgraded" /var/log/unattended-upgrades/unattended-upgrades.log* | tail -n 10
```

Los temporizadores que lo disparan:

```bash
systemctl list-timers apt-daily.timer apt-daily-upgrade.timer --no-pager
```

Simulación (no instala nada):

```bash
sudo unattended-upgrade --dry-run --debug 2>&1 | tail -n 20
```

Servicios que siguen usando librerías viejas después de un parche (solo lista, no reinicia nada):

```bash
sudo needrestart -r l
```

## Docker

Docker no se actualiza solo para que el daemon nunca se reinicie sin que lo decidas. Revisa una vez
al mes:

```bash
apt list --upgradable 2>/dev/null | grep -E "docker|containerd"
```

Para actualizar, en un momento tranquilo:

```bash
sudo apt-get install --only-upgrade -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin
```

Con `live-restore` los contenedores siguen corriendo mientras el daemon se reinicia. Verifica:

```bash
sudo docker version --format 'Engine {{.Server.Version}}' && sudo docker compose version && sudo docker compose ps
```

## Imágenes base

`mysql:8.4` y `nginx:stable-alpine` reciben parches de seguridad bajo la misma etiqueta. En una
actualización normal **no** se descargan (solo `pull api web`) para no reiniciar la base sin
planearlo. Hazlo a propósito una vez al mes, en un momento tranquilo:

```bash
sudo docker compose pull mysql nginx
```

```bash
sudo docker compose up -d mysql nginx
```

Hay un corte breve: unos segundos sin base de datos y sin nginx. Después verifica como en
[Actualizar producción](/deploy/operations/update-production/#verificar) y limpia las imágenes viejas:

```bash
sudo docker image prune -f
```

## Imágenes de la app

`md-api` y `md-web` se construyen en cada push a `main`, sobre las imágenes oficiales de PHP y Node.
Si pasa tiempo sin cambios de código, esas bases se quedan sin los últimos parches. Para
reconstruirlas sin cambiar código: GitHub → *Actions* → *Build and publish images* → *Run workflow*,
y después una [actualización normal](/deploy/operations/update-production/) desde el paso 4.
