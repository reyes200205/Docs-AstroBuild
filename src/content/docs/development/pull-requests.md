---
title: Pull requests
description: Cómo abrir, describir, revisar y fusionar un pull request, con la lista de comprobación y la plantilla del repositorio.
---

Todo cambio llega a `develop` y a `main` por un **pull request (PR)**. Aunque trabaje una sola
persona, el PR deja registrado qué cambió y por qué, obliga a pasar la
[lista de comprobación](#antes-de-abrirlo) y es el punto donde se decide qué va a producción.

## Antes de abrirlo

- [ ] La rama está al día con `develop` ([cómo](/development/git-workflow/#mantener-tu-rama-al-día)).
- [ ] Pasan las revisiones de [Calidad del código](/development/code-quality/): `composer test` en
      `laravel-api-kit`, y `pnpm lint` y `pnpm typecheck` en `nuxt-app-kit`.
- [ ] Probaste el cambio en local, en el navegador, con un usuario que tenga **y** con uno que no
      tenga el permiso correspondiente.
- [ ] Cambios de esquema en **migraciones nuevas**, nunca editando una existente
      ([Migraciones](/deploy/operations/migrations/)).
- [ ] Permisos o catálogos nuevos en un seeder de `database/seeders/Production/` idempotente.
- [ ] Variables de entorno nuevas en `laravel-api-kit/.env.example` **y** en `deploy/.env.example`.
- [ ] Sin secretos, `dd()`, `console.log` ni código comentado de prueba.
- [ ] Documentación actualizada si cambia un endpoint, una variable o un procedimiento.

## Abrirlo

Desde GitHub (*Compare & pull request* al subir la rama) o con [GitHub CLI](https://cli.github.com):

```powershell
gh pr create --base develop --title "feat(hr): add vacation balance export"
```

`gh` abre el editor con la [plantilla](#plantilla) si ya existe en el repo.

| Campo | Qué poner |
|---|---|
| Base | `develop` (o `main` solo para una release o un hotfix) |
| Título | Igual que un commit: `tipo(alcance): descripción` |
| Descripción | La [plantilla](#plantilla) completa |
| Borrador | Márcalo como *Draft* si todavía no está listo para revisar |

**Un PR, un tema.** Si mezclas una funcionalidad con un refactor de otra cosa, sepáralos. Un PR de
más de unos 400 líneas cambiadas (sin contar lockfiles) es difícil de revisar bien.

## Plantilla

Para que GitHub la precargue en cada PR, guárdala en el repo como
`.github/pull_request_template.md`:

```markdown
## Qué cambia

<!-- Una o dos frases. Enlaza el ticket o la conversación si existe. -->

## Por qué

<!-- El problema que resuelve o la necesidad de negocio. -->

## Cómo probarlo

1.
2.

## Capturas

<!-- Si cambia algo visible: antes / después. -->

## Despliegue

- [ ] Tiene migraciones (¿alguna destructiva? → respaldo antes)
- [ ] Tiene seeders de producción que hay que correr
- [ ] Agrega o cambia variables de entorno (¿cuáles?)
- [ ] Cambia la configuración de `deploy/` (nginx, compose, MySQL)
- [ ] Nada de lo anterior

## Comprobaciones

- [ ] `composer test` pasa
- [ ] `pnpm lint` y `pnpm typecheck` pasan
- [ ] Probado en local con y sin el permiso correspondiente
```

La sección *Despliegue* es la que usará quien despliegue para saber qué pasos de
[Actualizar producción](/deploy/operations/update-production/#según-lo-que-cambió) aplican.

## Revisar un PR

Quien revisa (o tú mismo, si trabajas solo, después de un rato y leyendo la pestaña *Files
changed* completa):

| Revisa | Pregunta |
|---|---|
| Comportamiento | ¿Hace lo que dice la descripción? ¿Lo probé? |
| Permisos | ¿Cada endpoint nuevo tiene su middleware de módulo y de permiso? ¿Se valida que el usuario solo vea **sus** datos cuando corresponde? |
| Validación | ¿Toda entrada pasa por un Form Request? |
| Base de datos | ¿Migración nueva y compatible hacia atrás? ¿Consultas N+1? ¿Índices para los filtros nuevos? |
| Datos sensibles | ¿Algo nuevo en logs, respuestas o archivos públicos que no debería? |
| Pruebas | ¿Hay una prueba para la regla de negocio o el error que se corrige? |
| Despliegue | ¿La sección *Despliegue* está completa y es correcta? |

Comentarios concretos y con propuesta: *"Aquí falta `permission:hr.employees.update`; sin él
cualquier usuario del módulo puede editar"* en vez de *"revisar permisos"*. Usa *Request changes*
solo para lo que bloquea; lo demás, como sugerencia.

## Fusionar

| PR | Botón | Por qué |
|---|---|---|
| Rama de trabajo → `develop` | **Squash and merge** | Un commit limpio por cambio en `develop`; el título del PR queda como mensaje |
| `develop` → `main` (release) | **Create a merge commit** | Conserva los commits de `develop`. Con *squash* las dos ramas divergen y el siguiente PR arrastra conflictos |
| `hotfix/*` → `main` | **Squash and merge** | Y después llévalo a `develop` ([Hotfix](/development/git-workflow/#hotfix)) |

Después de fusionar, borra la rama (GitHub ofrece el botón) y en tu PC:

```powershell
git checkout develop; git pull; git branch -d feature/mi-cambio
```

## La release (`develop` → `main`)

1. Abre el PR `develop` → `main` con título `release: AAAA-MM-DD` y, en la descripción, la lista de
   PRs que incluye y la unión de sus secciones *Despliegue* (migraciones, seeders, variables).
2. Si hay migraciones destructivas, haz un respaldo antes ([Respaldos](/deploy/operations/backups/)).
3. Fusiona con *Create a merge commit*.
4. Espera el build en *Actions* y sigue [Actualizar producción](/deploy/operations/update-production/).

## Proteger las ramas

En GitHub → repo → *Settings → Branches* (o *Rules → Rulesets*), para `main` y `develop`:

- *Require a pull request before merging*.
- *Block force pushes*.
- Para `main`: *Restrict deletions*.

En repositorios privados, estas reglas requieren un plan de pago de GitHub (Pro o Team). Sin él,
la regla vale por acuerdo del equipo: nadie hace push directo a `main` ni a `develop`.
