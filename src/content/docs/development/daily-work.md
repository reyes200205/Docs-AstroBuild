---
title: Trabajo diario
description: Levantar el entorno, ponerse al día con develop, manejar la base de datos local, ver logs y los comandos de Artisan y pnpm más usados.
---

Todo se ejecuta en PowerShell. Los comandos de Laravel, dentro de `laravel-api-kit`; los de pnpm,
dentro de `nuxt-app-kit`.

## Empezar el día

1. Laragon → **Start All** (MySQL y Mailpit).
2. Ponerte al día con `develop`:

   ```powershell
   git checkout develop; git pull
   ```

3. Si cambiaron las dependencias o la base, ponlas al día:

   ```powershell
   cd laravel-api-kit; composer install; php artisan migrate
   ```

   ```powershell
   cd ..\nuxt-app-kit; pnpm install
   ```

   Si `composer.lock`, `pnpm-lock.yaml` o `database/migrations/` no cambiaron, puedes saltarte este
   paso. Un error raro justo después de un `pull` casi siempre es esto.

4. Levantar (una terminal por proceso):

   | Terminal | Carpeta | Comando |
   |---|---|---|
   | API | `laravel-api-kit` | `php artisan serve` |
   | Frontend | `nuxt-app-kit` | `pnpm dev` |
   | Colas (si lo necesitas) | `laravel-api-kit` | `php artisan queue:work` |
   | Scheduler (si lo necesitas) | `laravel-api-kit` | `php artisan schedule:work` |

5. Crear tu rama para lo que vas a hacer ([Flujo de Git](/development/git-workflow/)).

:::tip
`queue:work` carga el código una sola vez. Si cambias un job, una notificación o un comando,
**reinícialo** (`Ctrl+C` y vuelve a lanzarlo). `php artisan serve` y `pnpm dev` recargan solos.
:::

## Base de datos local

| Para | Comando |
|---|---|
| Aplicar migraciones nuevas | `php artisan migrate` |
| Ver qué migraciones corrieron | `php artisan migrate:status` |
| Deshacer la última tanda | `php artisan migrate:rollback` |
| **Empezar de cero** con datos de desarrollo | `php artisan migrate:fresh --seed` |
| Correr un seeder concreto | `php artisan db:seed --class='Database\Seeders\Production\<Seeder>'` |
| Crear una migración | `php artisan make:migration add_columna_to_tabla_table` |

`migrate:fresh` **borra todas las tablas**. En local está bien; en producción, jamás
([Migraciones](/deploy/operations/migrations/)).

:::caution[No edites una migración que ya está en `main`]
`migrate` solo ejecuta las migraciones que no ha corrido. Si cambias una que ya corrió en
producción, el cambio nunca llega allá. Todo cambio de esquema va en una **migración nueva**.
:::

Para explorar los datos: HeidiSQL (*Laragon → Database*) o la consola:

```powershell
mysql -u root md
```

## Logs

La API escribe en `laravel-api-kit/storage/logs/laravel.log`. Para seguirlo en vivo:

```powershell
Get-Content storage\logs\laravel.log -Tail 50 -Wait
```

`php artisan pail` no funciona en Windows (necesita la extensión `pcntl`).

Los errores del frontend salen en la terminal de `pnpm dev` y en la consola del navegador (`F12`).

## Correos

Todo lo que envía la app en local cae en **Mailpit**: `http://localhost:8025`. Nada sale a
direcciones reales.

## Comandos útiles

### Laravel

| Para | Comando |
|---|---|
| Ver las rutas de la API | `php artisan route:list --path=api/v1` |
| Probar código contra la base | `php artisan tinker` |
| Limpiar cachés si algo no se refleja | `php artisan optimize:clear` |
| Ver trabajos de cola fallidos | `php artisan queue:failed` |
| Reintentar los fallidos | `php artisan queue:retry all` |
| Ver las tareas programadas | `php artisan schedule:list` |
| Crear un super admin (pregunta los datos) | `php artisan md:create-super-admin` |
| Crear un controlador, request, modelo... | `php artisan make:controller`, `make:request`, `make:model -m`... |

### Nuxt

| Para | Comando |
|---|---|
| Servidor de desarrollo | `pnpm dev` |
| Revisar estilo | `pnpm lint` |
| Revisar tipos | `pnpm typecheck` |
| Compilar como en producción | `pnpm build` y luego `pnpm preview` |
| Agregar una dependencia | `pnpm add <paquete>` (o `pnpm add -D` si es solo de desarrollo) |

## Antes de terminar

- Commits pequeños y con mensaje claro ([Flujo de Git](/development/git-workflow/#commits)).
- Antes de abrir un PR, pasa las revisiones de [Calidad del código](/development/code-quality/).
- Sube tu rama aunque no esté terminada: `git push -u origin <tu-rama>`. Así el trabajo no vive
  solo en tu PC.
