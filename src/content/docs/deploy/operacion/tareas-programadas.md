---
title: Tareas programadas
description: Los procesos que la plataforma corre sola (renovación de vacaciones, respaldos, limpieza), cómo se administran y cómo se agregan.
---

El contenedor `scheduler` ejecuta `php artisan schedule:work`, que cada minuto revisa qué tarea
toca correr. No depende de servicios externos (antes la renovación de vacaciones la disparaba
Power Automate).

## Tareas

| Tarea | Comando | Hora por defecto | Qué hace |
|---|---|---|---|
| Renovación de vacaciones | `vacations:renew` | 01:00 diario | Abre el ciclo nuevo de quien cumple aniversario y aplica la prescripción. Es seguro repetirla el mismo día |
| Respaldo de la base de datos | `md:backup-database` | 02:00 diario | [Respaldos](/deploy/operacion/respaldos/) |
| Limpieza de registros vencidos | `md:prune-expired` | 03:00 diario | Borra códigos de un solo uso vencidos, tokens expirados y vinculaciones de kiosko abandonadas |

Las horas son de `APP_TIMEZONE` (Monterrey), no UTC.

## Administrarlas

**Management → Tareas Programadas** (permisos `management.scheduled_tasks.view` y `.manage`):

- Encender o apagar cada tarea y cambiar su hora. Aplica al minuto siguiente, sin reiniciar nada.
- **Ejecutar** o **Simular** (`--dry-run`, solo en las que lo soportan). Esas ejecuciones las
  corre el worker `queue`, no el scheduler.
- Historial con la salida de cada ejecución. La pantalla no se refresca sola: usa el botón de
  recargar.
- Si una ejecución **por horario** falla, llega una notificación (campana y push) a quien tenga el
  permiso.
- Todos los cambios quedan en Auditorías (`management_scheduled_tasks`).

## Cómo funciona

- **Lista blanca en código**: las tareas existen solo si están en
  `laravel-api-kit/config/scheduled_tasks.php`. Desde la pantalla no se puede ejecutar ningún otro
  comando.
- **El estado editable vive en la base** (`scheduled_tasks`: encendida, hora, día) y el historial
  en `scheduled_task_runs`.
- **Cada tarea se registra "cada minuto"** con un filtro que compara la hora actual con la hora
  guardada en la base. Por eso `schedule:list` muestra `* * * * *` y un cambio de hora aplica sin
  reiniciar.
- **Candado por tarea**: si una ejecución sigue en curso, otra de la misma tarea queda como
  *Omitida* en vez de encimarse.

## Verificar en el servidor

```bash
sudo docker compose exec scheduler php artisan schedule:list
```

Deben aparecer las tres como `scheduled-task:<clave>`.

```bash
sudo docker compose logs --tail=50 scheduler
```

## Agregar una tarea

1. Un comando de Artisan que haga el trabajo, que devuelva `FAILURE` si algo sale mal y, si
   modifica datos, que sea seguro correrlo dos veces.
2. Una entrada en `config/scheduled_tasks.php` con `name`, `description`, `command`, `frequency`
   (`daily`, `weekly` u `hourly`), `time` y `dry_run`.
3. Desplegar. La fila en la base se crea sola la primera vez; no hace falta seeder.

## En local

En tu PC nada corre solo. Para probar:

| Para | Comando, en `laravel-api-kit` |
|---|---|
| Tareas por horario | `php artisan schedule:work` |
| Botones Ejecutar y Simular | `php artisan queue:work` |
| Ver las tareas registradas | `php artisan schedule:list` |

Para ver una ejecución por horario, cambia la hora de una tarea a uno o dos minutos después de la
actual y deja corriendo `schedule:work`.

## Problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| No corrió a su hora | `scheduler` caído, tarea apagada o la hora pensada en UTC | `docker compose ps`, `logs scheduler`, revisa la tarea en la pantalla |
| Ejecutar se queda en *En cola* | Worker `queue` caído | `logs queue`, `sudo docker compose restart queue` |
| Se quedó en *Ejecutando* para siempre | Un contenedor se reinició a media ejecución | Pasada una hora se marca como fallida sola al lanzar otra |
