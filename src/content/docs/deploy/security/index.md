---
title: Visión general
description: Las capas de seguridad del servidor, una revisión rápida en un solo comando y qué revisar cada semana y cada mes.
---

Esta sección reúne los comandos para **revisar la seguridad del servidor**: quién entra, qué se
bloquea, qué puertos están abiertos, qué dicen los logs y qué hacer si algo no cuadra. La
configuración en sí (cómo se montó cada pieza) está en [Servidor](/deploy/infrastructure/server/)
y [Red y TLS](/deploy/infrastructure/network-and-tls/).

Todos los comandos se ejecutan **en el servidor, como `ubuntu`**, salvo donde se indica otra cosa.
Los de Docker, desde `/opt/md/deploy`.

## Capas

| Capa | Protege | Dónde se revisa |
|---|---|---|
| Cloudflare | DNS, proxy, DDoS, HTTPS público | [Firewall y puertos](/deploy/security/firewall-and-ports/#cloudflare) |
| Security Group de AWS | Solo Cloudflare llega al 443; SSH limitado | [Firewall y puertos](/deploy/security/firewall-and-ports/#security-group) |
| UFW | Servicios del host (SSH) | [Firewall y puertos](/deploy/security/firewall-and-ports/#ufw) |
| SSH endurecido | Solo llaves, sin root, solo `ubuntu` y `deploy` | [SSH y accesos](/deploy/security/ssh-and-access/) |
| fail2ban | Bloquea IPs que fallan el login SSH | [fail2ban](/deploy/security/fail2ban/) |
| Parches automáticos | Vulnerabilidades del sistema | [Parches](/deploy/security/patches/) |
| nginx | Rechaza hosts desconocidos, IP real solo desde Cloudflare | [Logs](/deploy/security/logs/#nginx) |
| Aplicación | Límite de 6 intentos de login por minuto, auditoría, sesiones revocables | [Logs](/deploy/security/logs/#aplicación) |

## Revisión rápida

Un solo comando que resume el estado. Crea el script una vez:

```bash
cat > ~/security-check.sh <<'EOF'
#!/bin/sh
echo "== Sesiones abiertas";           who
echo "== Últimos accesos";              last -n 5 -a | head -n 5
echo "== Fallos de SSH (24 h)";         sudo journalctl -u ssh --since "24 hours ago" | grep -cE "Failed|Invalid user"
echo "== fail2ban";                     sudo fail2ban-client status sshd | grep -E "Currently|Total"
echo "== UFW";                          sudo ufw status | head -n 1
echo "== Puertos escuchando";           sudo ss -tlnp | awk 'NR>1 {print $4}' | sort -u
echo "== Contenedores con puertos";     sudo docker ps --format '{{.Names}} {{.Ports}}' | grep -v ' $'
echo "== Paquetes por actualizar";      apt list --upgradable 2>/dev/null | tail -n +2 | wc -l
[ -f /var/run/reboot-required ] && echo "!! REINICIO PENDIENTE"
echo "== Disco";                        df -h / | tail -n 1
EOF
chmod 700 ~/security-check.sh
```

Y ejecútalo cuando quieras:

```bash
~/security-check.sh
```

Lo esperado:

| Línea | Valor normal |
|---|---|
| Sesiones abiertas | Solo la tuya |
| Últimos accesos | IPs que reconoces |
| Fallos de SSH | Cualquier número: son escaneos de internet. Preocupa que **no** haya fallos y sí accesos desconocidos |
| fail2ban | Jail activa; los bloqueos actuales varían |
| UFW | `Status: active` |
| Puertos escuchando | `0.0.0.0:22`, `0.0.0.0:443`, `[::]:22`, `[::]:443` y los de `127.0.0.53`/`127.0.0.54` (DNS local) |
| Contenedores con puertos | Solo `md-nginx-1 0.0.0.0:443->443/tcp, [::]:443->443/tcp` |
| Reinicio pendiente | No aparece, o se resuelve solo a las 09:00 UTC |

## Rutina

| Cada | Qué | Cómo |
|---|---|---|
| Semana | Revisión rápida | `~/security-check.sh` |
| Semana | Accesos SSH | [SSH y accesos](/deploy/security/ssh-and-access/#quién-entró) |
| Mes | Parches de Docker e imágenes base | [Parches](/deploy/security/patches/) |
| Mes | El origen sigue oculto detrás de Cloudflare | [Firewall y puertos](/deploy/security/firewall-and-ports/#probar-desde-fuera) |
| Mes | Usuarios con acceso de administrador en la app | Management → Usuarios y Auditorías |
| Trimestre | Rangos de Cloudflare al día | [Firewall y puertos](/deploy/security/firewall-and-ports/#rangos-de-cloudflare) |
| Año | Rotar el token de GHCR (vence en septiembre de 2027) | [Incidentes](/deploy/security/incidents/#rotar-secretos) |

¿Algo no cuadra? [Incidentes](/deploy/security/incidents/).
