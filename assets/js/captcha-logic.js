// APP-SEC-002: logica pura de Turnstile (sin DOM), compartida por /pelotas/ y /captcha/.
import { turnstileConfig } from './config.js';

export const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Site key segun el hostname; null si el host no esta en la tabla (sin captcha).
export function siteKeyForHost(hostname, cfg = turnstileConfig) {
  const env = cfg.hosts[String(hostname || '').toLowerCase()];
  return env && cfg[env] ? cfg[env] : null;
}

// Cuerpo del POST /auth/v1/otp. Sin token no se agrega gotrue_meta_security.
export function buildOtpBody(email, captchaToken) {
  const body = { email, create_user: false };
  if (captchaToken) body.gotrue_meta_security = { captcha_token: captchaToken };
  return body;
}

export const CAPTCHA_COPY = {
  missing: 'Completa la verificación antes de pedir el código.',
  failed: 'No pudimos cargar la verificación. Revisa tu conexión e inténtalo de nuevo.',
  expired: 'La verificación venció. Complétala otra vez.',
  rejected: 'La verificación no pasó. Complétala otra vez.',
};

export function captchaFailureMessage(kind) {
  return CAPTCHA_COPY[kind] || CAPTCHA_COPY.failed;
}

// GoTrue responde con error_code captcha_failed (u otro texto con "captcha") si el token no sirve.
export function isCaptchaError(err) {
  return /captcha/i.test(String(err?.code ?? err ?? ''));
}

// Parametros de /captcha/: theme dark|light|auto (por defecto auto) y action corto opcional.
export function parseCaptchaParams(search) {
  const p = new URLSearchParams(search || '');
  const t = p.get('theme');
  const theme = t === 'dark' || t === 'light' ? t : 'auto';
  const raw = (p.get('action') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  return { theme, action: raw || undefined };
}

// Mensajes hacia la app (contrato fijo, JSON en texto).
export const captchaMessage = {
  token: (token) => JSON.stringify({ type: 'token', token }),
  expired: () => JSON.stringify({ type: 'expired' }),
  error: (code) => JSON.stringify({ type: 'error', code: String(code ?? 'unknown') }),
  ready: () => JSON.stringify({ type: 'ready' }),
};
