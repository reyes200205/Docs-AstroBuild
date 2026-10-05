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
		build: {
			// Sin source maps en producción.
			sourcemap: false,
		},
	},

	integrations: [
		starlight({
			title: 'My Docs',
			// Starlight prerenderiza por defecto; aquí cada página pasa por el middleware.
			prerender: false,
			// Pagefind genera un índice estático público con todo el contenido: incompatible con docs privadas.
			pagefind: false,
			components: {
				// Añade el botón "Cerrar sesión" al header y al menú móvil.
				SocialIcons: './src/components/LogoutButton.astro',
			},
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Example Guide', slug: 'guides/example' },
					],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
		}),
	],
});
