import type { APIRoute } from 'astro';
import { apiLogin, apiLogout, createSession, isSameOrigin, safeNext } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
	if (!isSameOrigin(request, url.origin)) {
		return new Response('Forbidden', { status: 403 });
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return new Response('Bad Request', { status: 400 });
	}

	const email = String(form.get('email') ?? '').trim();
	const password = String(form.get('password') ?? '');
	const remember = form.get('remember') === 'on';
	const next = safeNext(form.get('next'), url.origin);

	const back = (error: string) =>
		redirect(`/login?error=${error}&next=${encodeURIComponent(next)}`, 303);

	if (!email || !password || email.length > 255 || password.length > 1024) {
		return back('invalid');
	}

	const userAgent = request.headers.get('user-agent');
	const result = await apiLogin(email, password, remember, userAgent);

	if (!result.ok) return back(result.error);

	if (result.user.password_change_required) {
		await apiLogout(result.token, userAgent);
		return back('password_change');
	}

	await createSession(cookies, result.token, remember);
	return redirect(next, 303);
};
