---
title: Flujo de Git
description: Ramas del repositorio, de dónde sale y a dónde vuelve cada cambio, formato de los commits y cómo mantener una rama al día.
---

## Ramas

| Rama | Qué contiene | Quién escribe en ella |
|---|---|---|
| `main` | **Producción.** Cada push construye las imágenes que se despliegan | Solo PRs desde `develop` (o un `hotfix/*`) |
| `develop` | Lo próximo que va a producción, ya revisado | Solo PRs desde ramas de trabajo |
| `feature/<tema>` | Una funcionalidad nueva | Tú |
| `fix/<tema>` | Una corrección que puede esperar al siguiente despliegue | Tú |
| `hotfix/<tema>` | Una corrección **urgente** para producción | Tú |
| `chore/<tema>`, `docs/<tema>`, `refactor/<tema>` | Mantenimiento, documentación, reorganizar código sin cambiar comportamiento | Tú |

:::danger[Nunca hagas push directo a `main`]
Un push a `main` dispara el build de producción (`.github/workflows/build-images.yml`). Lo que
llegue a `main` es lo que se desplegará.
:::

Nombres en minúsculas, en inglés y con guiones: `feature/vacation-approval-flow`,
`fix/employee-import-dates`, `hotfix/login-500`.

## El recorrido de un cambio

```text
develop ──► feature/mi-cambio ──(PR)──► develop ──(PR de release)──► main ──► build ──► despliegue
```

1. Sales de `develop` actualizado:

   ```powershell
   git checkout develop; git pull
   ```

   ```powershell
   git checkout -b feature/mi-cambio
   ```

2. Trabajas con commits pequeños y subes la rama:

   ```powershell
   git push -u origin feature/mi-cambio
   ```

3. Abres un [pull request](/development/pull-requests/) hacia `develop`.
4. Cuando `develop` tiene lo que quieres publicar, un PR de **`develop` → `main`** (la *release*).
5. Al fusionarlo, GitHub construye las imágenes y se despliega con
   [Actualizar producción](/deploy/operations/update-production/).

### Hotfix

Para algo roto en producción que no puede esperar a lo que hay en `develop`:

1. Sale de `main`: `git checkout main; git pull; git checkout -b hotfix/mi-arreglo`.
2. PR hacia **`main`**, se fusiona y se despliega.
3. Inmediatamente, lleva el arreglo a `develop` para que no se pierda en la siguiente release:

   ```powershell
   git checkout develop; git pull; git merge origin/main; git push
   ```

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/es/), en **inglés** y en
imperativo, como la mayor parte del historial:

```text
tipo(alcance opcional): descripción corta
```

| Tipo | Cuándo |
|---|---|
| `feat` | Funcionalidad nueva |
| `fix` | Corrección de un error |
| `refactor` | Cambio de código sin cambiar comportamiento |
| `perf` | Mejora de rendimiento |
| `test` | Pruebas |
| `docs` | Documentación |
| `chore` | Dependencias, configuración, tareas de mantenimiento |
| `ci` | Workflows de GitHub Actions |
| `build` | Dockerfiles, compose |

Ejemplos:

```text
feat(hr): add vacation balance export to Excel
fix(auth): return 403 when the account is inactive
refactor(news): extract comment policy to a dedicated class
chore(deps): update laravel/framework to 13.4
```

- Un commit = un cambio con sentido propio. Evita `fix`, `cambios`, `wip` o `ADD se agregó...`.
- Si el cambio rompe algo existente (un endpoint cambia su respuesta, una variable de entorno nueva
  obligatoria), agrega `!` y explícalo en el cuerpo: `feat(api)!: rename employee status field`.
- Agrega solo lo que pertenece al commit: `git add <rutas>`, no `git add .` con otros cambios a
  medias.

## Mantener tu rama al día

Si `develop` avanzó mientras trabajabas:

```powershell
git fetch origin; git rebase origin/develop
```

Resuelve los conflictos, `git add <archivo>`, `git rebase --continue` y sube con:

```powershell
git push --force-with-lease
```

`--force-with-lease` solo sobrescribe si nadie más subió algo a tu rama. Úsalo **solo en tus ramas
de trabajo**, nunca en `develop` ni en `main`.

Si prefieres no reescribir historia, `git merge origin/develop` también sirve.

## Qué nunca va en un commit

- `.env` de ningún tipo (ya están en `.gitignore`), llaves, tokens, contraseñas, certificados.
- `vendor/`, `node_modules/`, `.nuxt/`, `.output/`.
- Respaldos de base de datos o archivos con datos de empleados.

Si subiste un secreto por error, **no basta con borrarlo en otro commit**: queda en el historial.
Rótalo de inmediato ([Incidentes](/deploy/security/incidents/#rotar-secretos)).
