---
title: Visión general
description: Qué es el repositorio, cómo está organizado, con qué herramientas se trabaja en local y dónde corre cada pieza.
---

Esta sección explica cómo trabajar en la plataforma desde tu PC: montar el entorno con
**Laragon**, el día a día, cómo se organizan las ramas y los pull requests, y las herramientas que
revisan la calidad del código. Para llevar los cambios al servidor, ver
[Actualizar producción](/deploy/operations/update-production/).

## El repositorio

`reyes200205/master-drilling-release` (privado) es un **monorepo con dos aplicaciones
independientes** que no comparten runtime:

```text
master-drilling-release/
├── laravel-api-kit/     API REST (Laravel 13, PHP 8.4, Sanctum)
├── nuxt-app-kit/        Panel web (Nuxt 4 en modo SPA, Nuxt UI, TypeScript)
├── deploy/              Todo lo de producción (compose, nginx, MySQL)
├── docker/              Dockerfiles de las imágenes
├── docs/                Documentos de diseño: dominio, features, RBAC, despliegue
└── .github/workflows/   Build de las imágenes de producción
```

| | Backend (`laravel-api-kit`) | Frontend (`nuxt-app-kit`) |
|---|---|---|
| Lenguaje | PHP 8.4 (`declare(strict_types=1)`, clases `final`) | TypeScript, Vue 3 |
| Framework | Laravel 13 | Nuxt 4.5, `ssr: false` |
| Dependencias | Composer | pnpm 11.22 (vía Corepack) |
| Autenticación | Laravel Sanctum por tokens | Guarda el token y lo manda en `Authorization` |
| Permisos | `spatie/laravel-permission` + middleware por módulo | Menús y páginas según los permisos del usuario |
| Calidad | Pint, Rector, PHPStan (nivel máximo), Pest | ESLint, `nuxt typecheck` |

## El entorno local

Se trabaja **sin Docker**, con [Laragon](https://laragon.org) en Windows, que aporta todo lo que
el proyecto necesita en el host:

| Herramienta | Versión | Para qué |
|---|---|---|
| PHP | 8.4 | La API |
| MySQL | 8.4 | La base de datos local (`md`) |
| Composer | 2.x | Dependencias de PHP |
| Node.js | 22 | El frontend |
| Mailpit | — | Atrapa los correos que envía la app en local |
| HeidiSQL | — | Cliente gráfico de MySQL |

El repo se clona en cualquier carpeta (no hace falta que esté en `C:\laragon\www`): la API corre
con `php artisan serve` y el frontend con `pnpm dev`.

:::caution[No confundir con el sistema legacy]
`C:\laragon\www\master-drilling` (y su sitio `master-drilling.test`) es el **sistema anterior**
(Laravel 12 + Inertia). La plataforma nueva no se sirve desde ahí.
:::

## URLs locales

| Qué | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| API | `http://localhost:8000/api/v1/...` |
| Documentación interactiva de la API (Scramble) | `http://localhost:8000/docs/api` |
| Correos atrapados (Mailpit) | `http://localhost:8025` |

## Por dónde empezar

1. [Instalar el entorno](/development/setup/): de cero a iniciar sesión en local.
2. [Trabajo diario](/development/daily-work/): levantar todo, base de datos, logs, comandos útiles.
3. [Flujo de Git](/development/git-workflow/): ramas y commits.
4. [Pull requests](/development/pull-requests/): cómo se propone, revisa y fusiona un cambio.
5. [Calidad del código](/development/code-quality/): lo que debe pasar antes de abrir un PR.
6. [Buenas prácticas](/development/best-practices/): convenciones y seguridad.
