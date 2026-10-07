// APP-SHARE-004 — Enlace diferido y App Links (Android). Funciones puras, sin DOM:
// se prueban con `node --test tests/`.
//
// Flujo: la landing arma la URL de Google Play con un `referrer` que lleva el destino
// (`link=/partidas/<id>` o `link=/r/<codigo>`) y el codigo de invitacion (`ref=`). Tras
// instalar, la app lee el Install Referrer en el primer arranque y navega alli.

export const PACKAGE_NAME = 'com.yoinit.app';
export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const CODE_RE = /^[A-Za-z0-9_-]{3,32}$/;

export function cleanMatchId(raw) {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw.toLowerCase() : '';
}

export function cleanCode(raw) {
  return typeof raw === 'string' && CODE_RE.test(raw) ? raw.toUpperCase() : '';
}

// Valor del parametro `referrer` (aun sin codificar). '' si no hay nada que recordar.
export function referrerValue({ matchId, code } = {}) {
  const id = cleanMatchId(matchId);
  const ref = cleanCode(code);
  const parts = [];
  if (id) parts.push(`link=/partidas/${id}`);
  else if (ref) parts.push(`link=/r/${ref}`);
  if (ref && id) parts.push(`ref=${ref}`);
  return parts.join('&');
}

// URL de la ficha de Play con el referrer. `storeUrl` vacio => '' (boton no disponible).
export function playStoreUrl(storeUrl, params) {
  if (!storeUrl) return '';
  let url;
  try {
    url = new URL(storeUrl);
  } catch {
    return '';
  }
  const value = referrerValue(params);
  if (value) url.searchParams.set('referrer', value);
  return url.toString();
}

// Intent de Chrome para Android: abre la app y, si no esta instalada, va a
// `fallbackUrl` (ficha de Play) en vez de no hacer nada. `path` es la ruta de la app,
// p. ej. `/partidas/<id>` o `/r/<codigo>`. Sin fallback, el intent no lo lleva.
export function androidIntentUrl(path, fallbackUrl) {
  const clean = String(path).replace(/^\/+/, '');
  const fallback = fallbackUrl ? `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};` : '';
  return `intent://open/${clean}#Intent;scheme=${PACKAGE_NAME};package=${PACKAGE_NAME};${fallback}end`;
}

export function isAndroid(userAgent) {
  return /\bAndroid\b/i.test(userAgent || '');
}
