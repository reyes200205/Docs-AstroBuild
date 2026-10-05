---
title: Base de datos
description: MySQL 8.4 en contenedor, usuarios, configuración para 2 GB de RAM y cómo administrarla.
---

MySQL **8.4** en el contenedor `mysql`, con los datos en el volumen `md_mysql_data`. **No publica
puertos**: solo `api`, `queue` y `scheduler` llegan a él por la red interna de Docker.

## Usuarios

| Usuario | Privilegios | Quién lo usa |
|---|---|---|
| `root` | Todos | Solo administración manual |
| `md` | `ALL PRIVILEGES ON md.*` y nada más | La aplicación |

Las contraseñas están en `deploy/.env` (`DB_PASSWORD`, `DB_ROOT_PASSWORD`).

:::caution[Las contraseñas solo se leen una vez]
MySQL toma las contraseñas del `.env` **solo la primera vez que crea el volumen**. Cambiarlas
después en el `.env` no cambia nada dentro de MySQL: hay que hacer `ALTER USER` en la base y
actualizar el `.env` con el mismo valor.
:::

## Configuración

`deploy/mysql/prod.cnf`:

| Parámetro | Valor | Motivo |
|---|---|---|
| `character-set-server` / `collation-server` | `utf8mb4` / `utf8mb4_unicode_ci` | Lo recomendado para Laravel |
| `default-time-zone` | `'-06:00'` | Igual que `APP_TIMEZONE` (Monterrey, UTC-6 todo el año). Se usa el desfase y no el nombre porque las tablas de zonas horarias no existen cuando la imagen inicializa la base |
| `max_allowed_packet` | `64M` | PDFs e importaciones |
| `innodb_buffer_pool_size` | `256M` | Los 2 GB de RAM se comparten con el resto del stack |
| `max_connections` | `60` | Suficiente para PHP-FPM, worker y scheduler |
| `performance_schema` | `OFF` | Ahorra 100–200 MB a cambio de menos diagnóstico interno |
| `skip-log-bin` | — | Sin réplica ni recuperación a un punto en el tiempo: el binlog solo gastaría disco |
| `skip-name-resolve` | — | Sin búsquedas DNS de los clientes |

Para aplicar un cambio: se edita en el repo, `git pull` en el servidor y
`sudo docker compose restart mysql` (corte breve de la base).

## Administrarla

Consola de MySQL dentro del contenedor:

```bash
sudo docker compose exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" md'
```

Desde tu PC con un cliente gráfico (TablePlus, DBeaver...): túnel SSH al contenedor. Primero
obtén su IP interna en el servidor:

```bash
sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' md-mysql-1
```

Y en tu PC:

```bash
ssh -L 3307:<IP-del-contenedor>:3306 ubuntu@<servidor>
```

Conéctate a `127.0.0.1:3307` con el usuario `md`. El puerto nunca queda expuesto a internet.

## Datos iniciales

| Seeder | Cuándo |
|---|---|
| `Database\Seeders\ProductionSeeder` | Una sola vez, en un servidor nuevo: catálogos, roles, permisos, settings, módulos |
| `Database\Seeders\Production\<Seeder>` | Cuando un cambio agrega un catálogo nuevo y el seeder es idempotente |
| `DatabaseSeeder` / `db:seed` a secas | **Nunca en producción** (crea un admin con contraseña `password`) |

El primer administrador se crea con `php artisan md:create-super-admin`, que pide nombre, correo,
contraseña (oculta) y módulos.

Respaldos y restauración: [Respaldos](/deploy/operacion/respaldos/). Cambios de esquema:
[Migraciones](/deploy/operacion/migraciones/).
