---
title: Estado y pendientes
description: Lo que falta del despliegue, lo que no se ha probado y lo que tiene fecha de vencimiento.
---

Actualiza esta página en cuanto algo cambie de estado.

## Pendiente

| Qué | Por qué importa | Notas |
|---|---|---|
| **Despliegue automático** desde GitHub Actions | Hoy cada actualización son 7 pasos a mano por SSH | Diseño previsto: job `deploy` después del build, SSH como `deploy` con llave dedicada limitada a un solo script (`command=` forzado), migraciones, `up -d`, healthchecks y vuelta automática a la versión anterior si fallan |
| **Proveedor SMTP** | Los correos (recuperar contraseña, notificaciones) solo se escriben al log | Cambiar `MAIL_*` en el `.env` |
| **Confirmar el Security Group** | Si el 443 está abierto a todo internet, se puede llegar al origen sin pasar por Cloudflare | Debe permitir el 443 solo desde la lista de prefijos de Cloudflare ([Red y TLS](/deploy/infrastructure/network-and-tls/#security-group)) |

## Sin probar

Procedimientos documentados que todavía no se han ejecutado en producción. Pruébalos con calma
antes de necesitarlos con prisa:

- [Rollback](/deploy/operations/rollback/) con `IMAGE_TAG`.
- [Restaurar un respaldo](/deploy/operations/backups/#restaurar).
- [Montar el servidor desde cero](/deploy/installation/) completo, de principio a fin. Lo ideal es
  seguirla en una EC2 temporal (con un bucket de prueba) y destruirla al terminar.
- El contenido de `/etc/fail2ban/jail.d/sshd.local` y `/etc/apt/apt.conf.d/52unattended-upgrades-local`
  documentado en [Servidor](/deploy/infrastructure/server/) se reconstruyó a partir de la
  descripción de la Etapa 3: compáralo con el servidor actual
  (`sudo cat` de ambos archivos) y corrige la documentación si difiere.

## Con fecha de vencimiento

| Qué | Vence | Qué hacer |
|---|---|---|
| Token de GHCR del servidor (`read:packages`) | Septiembre de 2027 | Crear uno nuevo y repetir `docker login ghcr.io` |
| Certificado Origin CA | 2041 | Emitir otro en Cloudflare |

## A vigilar

- **RAM**: si `free -h` muestra swap en uso sostenido, pasar a t3.medium.
- **Disco**: `df -h /` de vez en cuando; `docker image prune -f` libera las imágenes viejas.
- **Rangos de Cloudflare**: si cambian, actualizar la lista de prefijos del Security Group y
  `deploy/nginx/conf.d/00-common.conf`.
- **Parches de Docker**: no se instalan solos; actualizarlo a mano de vez en cuando.
