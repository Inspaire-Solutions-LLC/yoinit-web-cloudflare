import { UUID_RE, applyPreview, parseSummary } from '../_lib/matchPreview.js';

// APP-SHARE-003 — /partidas/:id. Sirve la landing de siempre (partidas.html) y, si la
// partida es pública, le inyecta las etiquetas Open Graph y el resumen. Si el resumen
// falla por cualquier motivo (id raro, partida privada, edge function caída, tiempo
// agotado), sirve la landing genérica: nunca error.
//
// Variable de entorno (Pages > Settings > Environment variables):
//   SUMMARY_API_URL  URL completa de la edge function, p. ej.
//                    https://<ref>.supabase.co/functions/v1/public-match-summary
// Sin ella, todo sale como landing genérica.

const TIMEOUT_MS = 2500;

async function landing(env, url) {
  // Se pide /partidas (partidas.html sin extensión); sin seguir redirecciones por si Pages
  // reescribe la ruta.
  const res = await env.ASSETS.fetch(new Request(new URL('/partidas', url), { redirect: 'manual' }));
  return res.status >= 300 && res.status < 400
    ? env.ASSETS.fetch(new Request(new URL('/partidas.html', url), { redirect: 'manual' }))
    : res;
}

async function fetchSummary(env, id) {
  if (!env.SUMMARY_API_URL || !UUID_RE.test(id)) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const api = new URL(env.SUMMARY_API_URL);
    api.searchParams.set('id', id);
    const res = await fetch(api, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (res.status !== 200) return null; // 404 de privada/cancelada/inexistente incluido
    return parseSummary(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  const base = await landing(env, url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return base;
  let summary = null;
  try {
    summary = await fetchSummary(env, String(params.id ?? ''));
  } catch {
    summary = null;
  }
  if (!summary || !base.ok) return base;

  try {
    const html = await base.text();
    const pageUrl = `${url.origin}/partidas/${encodeURIComponent(params.id)}`;
    const out = applyPreview(html, summary, { pageUrl, origin: url.origin });
    const headers = new Headers(base.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=60');
    headers.delete('Content-Length');
    headers.delete('ETag');
    return new Response(out, { status: 200, headers });
  } catch {
    return landing(env, url);
  }
}
