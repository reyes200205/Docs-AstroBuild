// Capa BFF de autenticación: el token de Sanctum solo vive en el servidor de docs.
// El navegador recibe una cookie HttpOnly con el token cifrado (AES-GCM); robarla no
// da un token utilizable directamente contra la API.

import type { AstroCookies } from 'astro';
import { API_BASE_URL, SESSION_SECRET } from 'astro:env/server';

export const SESSION_COOKIE = import.meta.env.DEV ? 'docs_session' : '__Host-docs_session';

// Mismos valores por defecto que config('auth.token_expiry_days*') en la API.
// Si la API los acorta, /me devolverá 401 antes y la sesión se cerrará igual.
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;
const DEFAULT_MAX_AGE = 60 * 60 * 24;

// Cuánto tiempo se confía en una validación de /me antes de volver a preguntar a la API.
// Es también el retraso máximo con el que se nota una sesión revocada desde el dashboard.
const ME_CACHE_TTL_MS = 60_000;
const ME_CACHE_MAX_ENTRIES = 500;

const API_TIMEOUT_MS = 10_000;

export interface DocsUser {
	id: number;
	name: string;
	email: string;
	roles: string[];
	permissions: string[];
	password_change_required: boolean;
}

interface SessionPayload {
	token: string;
	exp: number; // epoch ms
}

/* ------------------------------------------------------------------ */
/* Cifrado de la cookie                                                */
/* ------------------------------------------------------------------ */

let keyPromise: Promise<CryptoKey> | undefined;

function getKey(): Promise<CryptoKey> {
	keyPromise ??= crypto.subtle
		.digest('SHA-256', new TextEncoder().encode(SESSION_SECRET))
		.then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
	return keyPromise;
}

function toBase64Url(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	return new Uint8Array(Buffer.from(value, 'base64url'));
}

async function seal(payload: SessionPayload): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plain = new TextEncoder().encode(JSON.stringify(payload));
	const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(), plain));
	const out = new Uint8Array(iv.length + cipher.length);
	out.set(iv);
	out.set(cipher, iv.length);
	return toBase64Url(out);
}

async function unseal(value: string): Promise<SessionPayload | null> {
	try {
		const bytes = fromBase64Url(value);
		if (bytes.length < 13) return null;
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: bytes.subarray(0, 12) },
			await getKey(),
			bytes.subarray(12),
		);
		const payload = JSON.parse(new TextDecoder().decode(plain)) as SessionPayload;
		if (typeof payload.token !== 'string' || typeof payload.exp !== 'number') return null;
		return payload;
	} catch {
		// Cookie manipulada, cifrada con otra clave o corrupta.
		return null;
	}
}

/* ------------------------------------------------------------------ */
/* Cookie de sesión                                                    */
/* ------------------------------------------------------------------ */

export async function createSession(cookies: AstroCookies, token: string, remember: boolean): Promise<void> {
	const maxAge = remember ? REMEMBER_MAX_AGE : DEFAULT_MAX_AGE;
	const value = await seal({ token, exp: Date.now() + maxAge * 1000 });
	cookies.set(SESSION_COOKIE, value, {
		httpOnly: true,
		secure: !import.meta.env.DEV,
		sameSite: 'lax',
		path: '/',
		maxAge,
	});
}

export async function readSession(cookies: AstroCookies): Promise<SessionPayload | null> {
	const raw = cookies.get(SESSION_COOKIE)?.value;
	if (!raw) return null;
	const payload = await unseal(raw);
	if (!payload || payload.exp <= Date.now()) return null;
	return payload;
}

export function destroySession(cookies: AstroCookies): void {
	cookies.delete(SESSION_COOKIE, {
		httpOnly: true,
		secure: !import.meta.env.DEV,
		sameSite: 'lax',
		path: '/',
	});
}

/* ------------------------------------------------------------------ */
/* Llamadas a la API existente (Laravel + Sanctum)                     */
/* ------------------------------------------------------------------ */

function apiUrl(path: string): string {
	return new URL(`/api/v1/${path}`, API_BASE_URL).toString();
}

function apiHeaders(userAgent: string | null, token?: string): HeadersInit {
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
	};
	// La API guarda el user agent en el token para "Dispositivos" de la cuenta.
	if (userAgent) headers['User-Agent'] = userAgent.slice(0, 512);
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

export type LoginResult =
	| { ok: true; token: string; user: DocsUser }
	| { ok: false; error: 'invalid' | 'inactive' | 'throttled' | 'unavailable' };

export async function apiLogin(email: string, password: string, remember: boolean, userAgent: string | null): Promise<LoginResult> {
	let res: Response;
	try {
		res = await fetch(apiUrl('login'), {
			method: 'POST',
			headers: apiHeaders(userAgent),
			body: JSON.stringify({ email, password, remember }),
			signal: AbortSignal.timeout(API_TIMEOUT_MS),
			redirect: 'error',
		});
	} catch {
		return { ok: false, error: 'unavailable' };
	}

	if (res.status === 401 || res.status === 422) return { ok: false, error: 'invalid' };
	if (res.status === 403) return { ok: false, error: 'inactive' };
	if (res.status === 429) return { ok: false, error: 'throttled' };
	if (!res.ok) return { ok: false, error: 'unavailable' };

	try {
		const body = (await res.json()) as { data?: { token?: unknown; user?: DocsUser } };
		const token = body.data?.token;
		const user = body.data?.user;
		if (typeof token !== 'string' || !token || !user) return { ok: false, error: 'unavailable' };
		return { ok: true, token, user };
	} catch {
		return { ok: false, error: 'unavailable' };
	}
}

/** Revoca el token en la API (borra el PersonalAccessToken). Best-effort. */
export async function apiLogout(token: string, userAgent: string | null): Promise<void> {
	meCache.delete(await tokenKey(token));
	try {
		await fetch(apiUrl('logout'), {
			method: 'POST',
			headers: apiHeaders(userAgent, token),
			signal: AbortSignal.timeout(API_TIMEOUT_MS),
			redirect: 'error',
		});
	} catch {
		// La cookie se borra igualmente; el token expirará solo.
	}
}

// Caché por instancia de la función serverless. La clave es un hash del token,
// nunca el token en claro.
const meCache = new Map<string, { user: DocsUser; until: number }>();

async function tokenKey(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return toBase64Url(new Uint8Array(digest));
}

export type MeResult = { ok: true; user: DocsUser } | { ok: false; reason: 'unauthorized' | 'unavailable' };

/** Comprueba contra la API que el token sigue siendo válido (no expirado ni revocado). */
export async function apiMe(token: string, userAgent: string | null): Promise<MeResult> {
	const key = await tokenKey(token);
	const cached = meCache.get(key);
	if (cached && cached.until > Date.now()) return { ok: true, user: cached.user };
	meCache.delete(key);

	let res: Response;
	try {
		res = await fetch(apiUrl('me'), {
			headers: apiHeaders(userAgent, token),
			signal: AbortSignal.timeout(API_TIMEOUT_MS),
			redirect: 'error',
		});
	} catch {
		return { ok: false, reason: 'unavailable' };
	}

	if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' };
	if (!res.ok) return { ok: false, reason: 'unavailable' };

	try {
		const body = (await res.json()) as { data?: DocsUser };
		if (!body.data || typeof body.data.id !== 'number') return { ok: false, reason: 'unavailable' };

		if (meCache.size >= ME_CACHE_MAX_ENTRIES) {
			const oldest = meCache.keys().next().value;
			if (oldest !== undefined) meCache.delete(oldest);
		}
		meCache.set(key, { user: body.data, until: Date.now() + ME_CACHE_TTL_MS });
		return { ok: true, user: body.data };
	} catch {
		return { ok: false, reason: 'unavailable' };
	}
}

/* ------------------------------------------------------------------ */
/* Redirects                                                           */
/* ------------------------------------------------------------------ */

/**
 * Devuelve una ruta interna segura para redirigir tras el login.
 * Cualquier cosa que apunte a otro origen (//evil.com, /\evil.com, https://…) cae a "/".
 */
export function safeNext(next: unknown, origin: string): string {
	if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
		return '/';
	}
	if (/[\u0000-\u001f\u007f]/.test(next)) return '/';
	try {
		const url = new URL(next, origin);
		if (url.origin !== origin) return '/';
		if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/login')) return '/';
		return url.pathname + url.search + url.hash;
	} catch {
		return '/';
	}
}

/** Comprobación explícita de mismo origen para los POST de auth (además de security.checkOrigin). */
export function isSameOrigin(request: Request, origin: string): boolean {
	return request.headers.get('origin') === origin;
}
