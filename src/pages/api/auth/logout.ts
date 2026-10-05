import type { APIRoute } from 'astro';
import { apiLogout, destroySession, isSameOrigin, readSession } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
	if (!isSameOrigin(request, url.origin)) {
		return new Response('Forbidden', { status: 403 });
	}

	const session = await readSession(cookies);
	if (session) {
		await apiLogout(session.token, request.headers.get('user-agent'));
	}

	// Se borra siempre, aunque la API no haya respondido.
	destroySession(cookies);
	return redirect('/login', 303);
};
