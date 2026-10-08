---
title: Servidor
description: Instancia EC2, usuarios, SSH, firewall, parches automáticos y swap.
---

| | |
|---|---|
| Instancia | AWS EC2 **t3.small** (2 vCPU, 2 GB RAM) |
| Sistema | Ubuntu 24.04 LTS |
| Disco | EBS de 30 GiB |
| IP | Elastic IP (fija); la referencian los registros DNS de Cloudflare |
| Zona horaria del host | **UTC**, para que los logs coincidan con AWS y Cloudflare. La app usa `America/Monterrey` |

En el host solo hay Docker: PHP, Node, Composer y MySQL viven dentro de las imágenes.

## Usuarios

| Usuario | Para qué | Permisos |
|---|---|---|
| `ubuntu` | Administración por SSH | `sudo`. **No** está en el grupo `docker`: los comandos de Docker van con `sudo` a propósito |
| `deploy` | Reservado para el despliegue automático desde GitHub Actions | Sin contraseña, sin `sudo`, sin grupo `docker`. Todavía sin llave SSH |
| `root` | — | Sin acceso por SSH |

:::tip
Para escribir menos: `alias dc='sudo docker compose'` (ya está en el `.bashrc` de `ubuntu`).
:::

## SSH

`/etc/ssh/sshd_config.d/00-hardening.conf`. El prefijo `00` importa: OpenSSH se queda con el
**primer** valor que encuentra.

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers ubuntu deploy
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
LogLevel VERBOSE
```

El reenvío de puertos TCP se deja activo a propósito: permite administrar MySQL por túnel
(`ssh -L`) sin publicarlo.

:::caution[Al cambiar esta configuración]
Valida con `sudo sshd -T`, recarga con `sudo systemctl reload ssh` y **abre una segunda sesión
antes de cerrar la actual**. Si algo quedó mal, la sesión abierta es la única forma de arreglarlo
sin la consola de AWS.
:::

## Firewall (UFW)

| Regla | Valor |
|---|---|
| Entrada por defecto | Denegar |
| Salida por defecto | Permitir |
| Abiertos | 22 (SSH) y 443 (HTTPS) |
| Puerto 80 | Cerrado: Cloudflare redirige HTTP→HTTPS antes de llegar al servidor |

:::danger[Docker se salta UFW]
Los puertos que publica Docker entran por `iptables` antes que las reglas de UFW. El firewall que
de verdad protege el 443 es el **Security Group de AWS**, y por eso ningún contenedor salvo
`nginx` publica puertos. UFW protege los servicios del host (SSH).
:::

## fail2ban

`/etc/fail2ban/jail.d/sshd.local`: 5 intentos en 10 minutos → bloqueo de 1 hora.

```ini
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
```

Con login solo por llave la fuerza bruta no es viable; fail2ban reduce el ruido en los logs y la
carga de los escaneos. Estado y IPs bloqueadas: `sudo fail2ban-client status sshd`.

## Parches automáticos

`unattended-upgrades` (activo de fábrica en la imagen de Ubuntu) con
`/etc/apt/apt.conf.d/52unattended-upgrades-local`, que se carga después de
`50unattended-upgrades` y por eso tiene prioridad:

```text
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "09:00";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
```

- Instala los parches de seguridad de Ubuntu.
- Reinicia **solo si un parche lo requiere**, a las **09:00 UTC (03:00 Monterrey)**.
- Limpia kernels y dependencias sin uso.
- **Docker no se actualiza solo**: su repositorio no está entre los orígenes permitidos, para que
  el daemon nunca se reinicie sin que lo decidas.

Comprobar: `sudo unattended-upgrade --dry-run` (sin errores) y
`apt-config dump | grep Automatic-Reboot`.

## Swap

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl -p /etc/sysctl.d/99-swappiness.conf
```

Con `swappiness=10` el swap solo se usa en picos (una exportación grande). Swap en uso de forma
sostenida (`free -h`) es la señal para pasar a una t3.medium.

## Ampliar el disco

Si `df -h /` se acerca al límite y la limpieza de imágenes no basta: amplía el volumen EBS en la
consola de AWS y después, en el servidor:

```bash
sudo growpart /dev/nvme0n1 1 && sudo resize2fs /dev/nvme0n1p1
```
