---
title: Migraciones
description: Reglas para cambiar el esquema de la base de datos en producción sin perder datos.
---

## Cómo se aplican

Las migraciones corren en el paso 5 de [Actualizar producción](/deploy/operacion/actualizar/), con la
imagen nueva y **antes** de recrear los contenedores:

```bash
sudo docker compose run --rm api php artisan migrate --force
```

Ver qué está aplicado y qué está pendiente:

```bash
sudo docker compose run --rm api php artisan migrate:status
```

## Reglas

1. **Todo cambio de esquema va en una migración nueva.** `migrate` solo ejecuta las que no están
   registradas: si editas una migración que ya corrió, el cambio **nunca llega** a producción y
   `migrate` responde `Nothing to migrate`.
2. **Migraciones idempotentes** cuando sea posible (`Schema::hasColumn`, `Schema::hasTable`): si
   algo se aplicó a mano o a medias, volver a correrla no rompe.
3. **Compatibles hacia atrás.** El [rollback](/deploy/operacion/rollback/) revierte el código, no
   la base. La versión anterior del código tiene que poder funcionar con el esquema nuevo:
   - Agregar columnas nullable o con default: seguro.
   - Quitar o renombrar: en **dos despliegues**. Primero el código deja de usar la columna y
     después una migración la elimina.
4. **Respaldo antes de algo destructivo** (borrar o renombrar columnas o tablas, transformar datos).
5. **Nunca `migrate:fresh`, `migrate:refresh` ni `migrate:reset` en producción.** Borran todo.

:::note[Excepción del arranque]
Mientras producción **no tenía datos reales** se permitió editar migraciones originales y
reconstruir la base con
`sudo docker compose run --rm api php artisan migrate:fresh --force --seeder='Database\Seeders\ProductionSeeder'`.
En cuanto existen empleados, saldos o solicitudes reales, esa excepción termina y aplican las
reglas de arriba sin excepciones.
:::

## Respaldo antes de una migración destructiva

Desde **Management → Tareas Programadas → Respaldo de la base de datos → Ejecutar**. Espera a que
la ejecución salga *Correcta* en el historial antes de seguir.

Si la app no está disponible, el respaldo manual está en
[Respaldos](/deploy/operacion/respaldos/#respaldo-manual-desde-la-terminal).

## Comprobar el esquema

Ejemplo: ver las columnas de una tabla.

```bash
sudo docker compose exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW COLUMNS FROM vacation_balance" md'
```
