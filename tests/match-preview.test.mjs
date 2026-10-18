import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyPreview, escapeHtml, formatLevel, ogDescription, ogTitle, parseSummary } from '../functions/_lib/matchPreview.js';

// APP-SHARE-003: etiquetas OG y bloque de resumen. node --test tests/
const landing = readFileSync(new URL('../partidas.html', import.meta.url), 'utf8');
const raw = {
  sport: 'Pádel', sport_slug: 'padel',
  starts_at: '2026-10-08T23:00:00.000Z', // jue 19:00 en Venezuela (UTC-4)
  venue_name: 'Club Altamira', zone: 'Caracas',
  level_min: 3, level_max: 3.5, match_type: 'competitive',
  total_slots: 4, free_slots: 1, status: 'open',
};
const ctx = { pageUrl: 'https://yoinit.app/partidas/abc', origin: 'https://yoinit.app' };

test('titulo y descripcion siguen el formato del brief', () => {
  const s = parseSummary(raw);
  assert.equal(ogTitle(s), 'Falta 1 · jue 19:00');
  assert.equal(ogDescription(s), 'Pádel · Nivel 3–3,5 · Club Altamira');
});

test('plurales, completa y terminada', () => {
  assert.equal(ogTitle(parseSummary({ ...raw, free_slots: 3 })), 'Faltan 3 · jue 19:00');
  assert.equal(ogTitle(parseSummary({ ...raw, free_slots: 0, status: 'full' })), 'Partida completa · jue 19:00');
  assert.equal(ogTitle(parseSummary({ ...raw, status: 'completed' })), 'Partida terminada · jue 19:00');
});

test('hora de Venezuela (UTC-4) en 24 h, incluido el cambio de dia', () => {
  assert.equal(ogTitle(parseSummary({ ...raw, starts_at: '2026-10-09T02:30:00Z' })), 'Falta 1 · jue 22:30');
  assert.equal(ogTitle(parseSummary({ ...raw, starts_at: '2026-10-09T03:59:00Z' })), 'Falta 1 · jue 23:59');
  assert.equal(ogTitle(parseSummary({ ...raw, starts_at: '2026-10-09T04:00:00Z' })), 'Falta 1 · vie 00:00');
});

test('nivel: decimales con coma, rango igual y ausente', () => {
  assert.equal(formatLevel(3.5), '3,5');
  assert.equal(formatLevel(2.1), '2,1');
  assert.equal(ogDescription(parseSummary({ ...raw, level_min: 3, level_max: 3 })), 'Pádel · Nivel 3 · Club Altamira');
  assert.equal(ogDescription(parseSummary({ ...raw, level_min: null, level_max: null })), 'Pádel · Club Altamira');
});

test('applyPreview inyecta og:title, og:description, og:image, og:url y el resumen', () => {
  const html = applyPreview(landing, parseSummary(raw), ctx);
  assert.match(html, /<meta property="og:title" content="Falta 1 · jue 19:00">/);
  assert.match(html, /<meta property="og:description" content="Pádel · Nivel 3–3,5 · Club Altamira">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/yoinit\.app\/assets\/images\/og-yoinit-1200x630\.png">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/yoinit\.app\/partidas\/abc">/);
  assert.match(html, /<title>Falta 1 · jue 19:00 — YoinIt<\/title>/);
  assert.match(html, /class="partida-summary-when">jue 8 oct · 19:00</);
  assert.match(html, /1 plaza libre de 4/);
  assert.match(html, /Pádel · Nivel 3–3,5 · Competitivo/);
  assert.match(html, /Club Altamira · Caracas/);
  assert.equal((html.match(/property="og:title"/g) || []).length, 1, 'sin og:title duplicado (el generico se sustituye)');
  assert.ok(!html.includes('Te invitaron a una partida'), 'el og generico no debe quedar');
  assert.ok(!html.includes('<!--MATCH-SUMMARY-->'));
});

test('el nombre del sitio es texto libre del jugador: se escapa', () => {
  const evil = '"><script>alert(1)</script><b x="';
  const html = applyPreview(landing, parseSummary({ ...raw, venue_name: evil }), ctx);
  assert.ok(!html.includes('<script>alert(1)'), 'no debe colarse markup');
  assert.ok(html.includes(escapeHtml(evil)));
});

test('la landing estatica ya trae og generico y marcadores', () => {
  assert.match(landing, /<!--OG-START-->[\s\S]*og:image[\s\S]*<!--OG-END-->/);
  assert.ok(landing.includes('<!--MATCH-SUMMARY-->'));
});

test('parseSummary descarta formas invalidas', () => {
  assert.equal(parseSummary(null), null);
  assert.equal(parseSummary({}), null);
  assert.equal(parseSummary({ ...raw, starts_at: 'nunca' }), null);
  assert.equal(parseSummary({ ...raw, status: 'cancelled' }), null);
  assert.equal(parseSummary({ ...raw, total_slots: '4' }), null);
});

// APP-SHARE-009: americanas
const am = { ...raw, format: 'americana', total_slots: 12, free_slots: 3 };

test('americana: titulo con jugadores en lugar de "Falta N"; descripcion igual', () => {
  const s = parseSummary(am);
  assert.equal(s.format, 'americana');
  assert.equal(ogTitle(s), 'Americana · 12 jugadores · jue 19:00');
  assert.equal(ogDescription(s), 'Pádel · Nivel 3–3,5 · Club Altamira');
  assert.equal(ogTitle(parseSummary({ ...am, free_slots: 0, status: 'full' })), 'Americana completa · jue 19:00');
  assert.equal(ogTitle(parseSummary({ ...am, status: 'completed' })), 'Americana terminada · jue 19:00');
});

test('americana: etiquetas OG y bloque de resumen', () => {
  const html = applyPreview(landing, parseSummary(am), ctx);
  assert.match(html, /<meta property="og:title" content="Americana · 12 jugadores · jue 19:00">/);
  assert.match(html, /Americana · Pádel · Nivel 3–3,5 · Competitivo/);
  assert.match(html, /12 jugadores · 3 cupos libres/);
  assert.doesNotMatch(html, /Faltan?\s/);
  assert.doesNotMatch(ogTitle(parseSummary(am)), /!/);
});

test('sin format (funcion sin desplegar) o format desconocido: partida normal', () => {
  for (const f of [undefined, null, 'standard', 'otra']) {
    const s = parseSummary({ ...raw, format: f });
    assert.equal(s.format, 'standard');
    assert.equal(ogTitle(s), 'Falta 1 · jue 19:00');
  }
  assert.match(applyPreview(landing, parseSummary(raw), ctx), /1 plaza libre de 4/);
});
