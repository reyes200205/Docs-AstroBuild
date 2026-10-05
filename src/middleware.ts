// Protección de rutas: todo requiere sesión salvo una lista explícita de rutas públicas.
// Si alguien añade una página nueva, queda protegida por defecto.

import { defineMiddleware } from 'astro:middleware';
import { apiMe, destroySession, readSession } from './lib/auth';

const PUBLIC_PATHS = new Set(['/login', '/login/', '/api/auth/login', '/api/auth/logout']);

const SECURITY_HEADERS: Record<string, string> = {
	// Nada de estas respuestas debe quedar en la caché del CDN ni del navegador.
	'Cache-Control': 'private, no-store, max-age=0',
	Vary: 'Cookie',
	'X-Robots-Tag': 'noindex, nofollow, noarchive',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'same-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
	// Starlight usa scripts y estilos inline (tema claro/oscuro), por eso 'unsafe-inline'.
	// Aun así, con un XSS no hay token que robar: la cookie es HttpOnly y la API nunca se llama desde el navegador.
	'Content-Security-Policy': [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self'",
		"connect-src 'self'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"base-uri 'self'",
		"object-src 'none'",
	].join('; '),
};

function withSecurityHeaders(response: Response): Response {
	let res = response;
	try {
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(name, value);
	} catch {
		// Headers inmutables: se copia la respuesta.
		res = new Response(response.body, response);
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(name, value);
	}
	return res;
}

export const onRequest = defineMiddleware(async (context, next) => {
	const { url, cookies, request, locals } = context;

	if (PUBLIC_PATHS.has(url.pathname)) {
		return withSecurityHeaders(await next());
	}

	const userAgent = request.headers.get('user-agent');
	const loginUrl = `/login?next=${encodeURIComponent(url.pathname + url.search)}`;

	const session = await readSession(cookies);
	if (!session) {
		destroySession(cookies);
		return withSecurityHeaders(
			request.method === 'GET' || request.method === 'HEAD'
				? context.redirect(loginUrl, 302)
				: new Response('Unauthorized', { status: 401 }),
		);
	}

	const me = await apiMe(session.token, userAgent);

	if (!me.ok) {
		if (me.reason === 'unavailable') {
			// Falla cerrado: sin poder validar contra la API no se entrega contenido.
			return withSecurityHeaders(
				new Response('Servicio de autenticación no disponible. Intenta de nuevo en unos minutos.', {
					status: 503,
					headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30' },
				}),
			);
		}
		// Token expirado o revocado (logout, "cerrar otras sesiones", reset de contraseña).
		destroySession(cookies);
		return withSecurityHeaders(context.redirect(`${loginUrl}&error=expired`, 302));
	}

	if (me.user.password_change_required) {
		destroySession(cookies);
		return withSecurityHeaders(context.redirect('/login?error=password_change', 302));
	}

	locals.user = me.user;
	return withSecurityHeaders(await next());
});
