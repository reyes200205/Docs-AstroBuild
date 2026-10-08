---
title: Calidad del código
description: Las herramientas que revisan estilo, tipos y pruebas en el backend y el frontend, cómo correrlas y qué hacer cuando fallan.
---

Hoy **ningún workflow de GitHub ejecuta estas revisiones**: el único workflow construye las
imágenes de producción. Por eso se corren en local antes de abrir cada
[pull request](/development/pull-requests/).

## Backend (`laravel-api-kit`)

| Herramienta | Qué revisa | Configuración |
|---|---|---|
| [Pint](https://laravel.com/docs/pint) | Estilo: preset Laravel, `declare(strict_types=1)`, clases `final`, imports | `pint.json` |
| [Rector](https://getrector.com) | Modernización y refactors automáticos | `rector.php` |
| [PHPStan](https://phpstan.org) + Larastan | Tipos, en el **nivel máximo** | `phpstan.neon` |
| [Pest](https://pestphp.com) | Pruebas unitarias y de integración | `tests/`, `phpunit.xml` |

### Todo de una vez

```powershell
composer test
```

Ejecuta, en orden: `pint --test` y `rector --dry-run` (solo revisan), `phpstan` y las pruebas. Es
lo que tiene que pasar antes de un PR.

### Corregir el estilo automáticamente

```powershell
composer lint
```

Aplica Rector y Pint sobre los archivos. Revisa el diff antes de hacer commit.

### Por separado

| Para | Comando |
|---|---|
| Solo estilo, corrigiendo | `vendor\bin\pint` |
| Solo estilo de lo que cambiaste | `vendor\bin\pint --dirty` |
| Solo tipos | `vendor\bin\phpstan analyse` |
| Todas las pruebas | `php artisan test` |
| Una prueba o un archivo | `php artisan test --filter=VacationBalance` |

### Las pruebas

- Corren sobre **SQLite en memoria** (`phpunit.xml`): no tocan tu base `md` y necesitan la
  extensión `pdo_sqlite` activa en Laragon.
- Viven en `tests/Feature/` (endpoints completos: petición → respuesta) y `tests/Unit/`.
- Una corrección de un error debería venir con una prueba que falle sin el arreglo.
- Para un endpoint nuevo, prueba al menos: respuesta correcta con permiso, `403` sin permiso y
  `422` con datos inválidos.

### Cuando PHPStan se queja

El nivel máximo es estricto a propósito. Antes de ignorar un error:

1. Tipa lo que falta: parámetros, retornos, `@return Collection<int, Employee>`, `@var` en arreglos.
2. Si viene de una librería sin tipos, un `@phpstan-ignore` puntual **con el motivo**:
   `// @phpstan-ignore argument.type (Excel devuelve mixed)`.
3. Nunca bajes el nivel en `phpstan.neon` ni agregues rutas completas a `excludePaths` para que
   pase.

## Frontend (`nuxt-app-kit`)

| Herramienta | Qué revisa | Comando |
|---|---|---|
| ESLint (`@nuxt/eslint`) | Estilo y errores comunes de Vue y TypeScript | `pnpm lint` |
| `vue-tsc` vía Nuxt | Tipos de TypeScript en `.ts` y `.vue` | `pnpm typecheck` |

Corregir lo que ESLint puede arreglar solo:

```powershell
pnpm lint --fix
```

Antes de un PR que toque mucho el frontend, comprueba también que compila como en producción:

```powershell
pnpm build
```

Así detectas antes que el build de GitHub Actions errores que `pnpm dev` deja pasar.

## Editor

[VS Code](https://code.visualstudio.com) con:

| Extensión | Para |
|---|---|
| Vue - Official | Vue y TypeScript en `.vue` |
| ESLint | Errores de ESLint mientras escribes |
| PHP Intelephense | Autocompletado y navegación en PHP |
| Laravel Pint | Formatear PHP al guardar con la configuración del repo |
| EditorConfig | Respeta `.editorconfig` (indentación y finales de línea) |

## Dependencias

- **Siempre** sube el lockfile junto con el cambio: `composer.lock` o `pnpm-lock.yaml`.
- Backend: `composer require <paquete>`, o `composer require --dev` si solo se usa en desarrollo.
- Frontend: `pnpm add <paquete>` o `pnpm add -D`. Nunca `npm install` ni `yarn`: generan otro
  lockfile.
- Antes de agregar una librería, revisa si el proyecto ya tiene algo que lo resuelva.
- Revisa vulnerabilidades de vez en cuando: `composer audit` y `pnpm audit`.
