// APP-SHARE-004 — Enlace diferido y App Links (Android). Funciones puras, sin DOM:
// se prueban con `node --test tests/`.
//
// Flujo: la landing arma la URL de Google Play con un `referrer` que lleva el destino
// (`link=/partidas/<id>`, `link=/r/<codigo>` o `link=/grupos/<codigo>`) y el codigo de invitacion (`ref=`). Tras
// instalar, la app lee el Install Referrer en el primer arranque y navega alli.

export const PACKAGE_NAME = 'com.yoinit.app';
export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const CODE_RE = /^[A-Za-z0-9_-]{3,32}$/;
// Codigo de grupo (APP-GROUP-008): 8 caracteres A-Z 2-9 sin 0 O 1 I, igual que groups.code
// del backend (migracion 0074) y que la validacion de la app.
export const GROUP_CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

export function cleanGroupCode(raw) {
  if (typeof raw !== 'string') return '';
  const up = raw.toUpperCase();
  return GROUP_CODE_RE.test(up) ? up : '';
}

export function cleanMatchId(raw) {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw.toLowerCase() : '';
}

export function cleanCode(raw) {
  return typeof raw === 'string' && CODE_RE.test(raw) ? raw.toUpperCase() : '';
}

// Valor del parametro `referrer` (aun sin codificar). '' si no hay nada que recordar.
export function referrerValue({ matchId, code, groupCode } = {}) {
  const id = cleanMatchId(matchId);
  const group = cleanGroupCode(groupCode);
  const ref = cleanCode(code);
  const parts = [];
  if (id) parts.push(`link=/partidas/${id}`);
  else if (group) parts.push(`link=/grupos/${group}`);
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
