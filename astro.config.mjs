// @ts-check
import { defineConfig, envField } from 'astro/config';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
	// Todo se renderiza bajo demanda: la documentación es privada y el middleware
	// (src/middleware.ts) tiene que poder bloquear cada página antes de entregarla.
	// No hay HTML prerenderado en el CDN que pueda saltarse la autenticación.
	output: 'server',
	adapter: vercel(),

	// Sin `site`: Starlight no genera sitemap con la lista de URLs privadas.

	security: {
		// Rechaza POST/PUT/PATCH/DELETE de formularios cuyo Origin no sea este sitio (CSRF).
		checkOrigin: true,
	},

	env: {
		schema: {
			// Base de la API existente, p. ej. https://api.mdmexico.online
			API_BASE_URL: envField.string({ context: 'server', access: 'secret', url: true }),
			// Clave para cifrar la cookie de sesión. Mínimo 32 caracteres aleatorios.
			SESSION_SECRET: envField.string({ context: 'server', access: 'secret', min: 32 }),
		},
		validateSecrets: true,
	},

	vite: {
		ssr: {
			// satteri (lo usan <Tabs>, <Steps> y <FileTree> de Starlight al renderizar en servidor)
			// carga un binario nativo .node con require() relativo a su propio paquete. Si Vite lo
			// mete en un chunk, ese require falla y la página responde 500. Se deja como import externo
			// para que se resuelva desde node_modules y el adaptador de Vercel copie el binario.
			external: ['satteri'],
		},
		build: {
			// Sin source maps en producción.
			sourcemap: false,
		},
	},

	integrations: [
		starlight({
			title: 'Master Drilling Docs',
			// Archivo de estilos personalizados (color de acento #4782cb)
			customCss: ['./src/styles/custom.css'],
			// Interfaz de Starlight en español (búsqueda, "En esta página", navegación...).
			defaultLocale: 'root',
			locales: { root: { label: 'Español', lang: 'es' } },
			// Starlight prerenderiza por defecto; aquí cada página pasa por el middleware.
			prerender: false,
			// Pagefind genera un índice estático público con todo el contenido: incompatible con docs privadas.
			pagefind: false,
			components: {
				// Añade el botón "Cerrar sesión" al header y al menú móvil.
				SocialIcons: './src/components/LogoutButton.astro',
			},
			sidebar: [
				{ label: 'Introducción', slug: 'index' },
				{
					label: 'Documentación API',
					collapsed: true,
					items: [
						{
							label: 'Autenticación',
							collapsed: true,
							items: [
								{ label: 'Inicio de sesión', slug: 'api-docs/auth/login' },
								{ label: 'Cerrar sesión', slug: 'api-docs/auth/logout' },
								{ label: 'Usuario actual', slug: 'api-docs/auth/me' },
							],
						},
						{
							label: 'Módulos y Funcionalidades',
							collapsed: true,
							items: [
								{ label: 'Visión general', slug: 'api-docs/modules/overview' },
								{ label: 'Listar módulos', slug: 'api-docs/modules/list' },
								{ label: 'Estado del módulo', slug: 'api-docs/modules/module-status' },
								{ label: 'Estado de funcionalidad', slug: 'api-docs/modules/feature-status' },
							],
						},
					],
				},
				{
					label: 'Producción',
					collapsed: true,
					items: [
						{ label: 'Visión general', slug: 'deploy' },
						{
							label: 'Instalación',
							collapsed: true,
							items: [{ label: 'Despliegue Servidor', slug: 'deploy/instalacion' }],
						},
						{
							label: 'Infraestructura',
							collapsed: true,
							items: [
								{ label: 'Servidor', slug: 'deploy/infraestructura/servidor' },
								{ label: 'Contenedores', slug: 'deploy/infraestructura/contenedores' },
								{ label: 'Red y TLS', slug: 'deploy/infraestructura/red-y-tls' },
								{ label: 'Base de datos', slug: 'deploy/infraestructura/base-de-datos' },
							],
						},
						{
							label: 'Configuración',
							collapsed: true,
							items: [{ label: 'Variables de entorno', slug: 'deploy/configuracion/variables' }],
						},
						{
							label: 'Mantenimiento y Despliegue',
							collapsed: true,
							items: [
								{ label: 'Comandos útiles', slug: 'deploy/operacion/useful-commands' },
								{ label: 'Actualizar producción', slug: 'deploy/operacion/actualizar' },
								{ label: 'Migraciones', slug: 'deploy/operacion/migraciones' },
								{ label: 'Rollback', slug: 'deploy/operacion/rollback' },
								{ label: 'Tareas programadas', slug: 'deploy/operacion/tareas-programadas' },
								{ label: 'Respaldos', slug: 'deploy/operacion/respaldos' },
								{ label: 'Diagnóstico', slug: 'deploy/operacion/diagnostico' },
							],
						},
					],
				},
				{
					label: 'Buenas Prácticas',
					collapsed: true,
					items: [
						{ label: 'Introducción', slug: 'best-practices' },
						{ label: 'Laravel', slug: 'best-practices/laravel' },
					],
				},
			],
		}),
	],
});
