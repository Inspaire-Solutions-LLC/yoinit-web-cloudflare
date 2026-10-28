import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// SEO: home, terminos y privacidad indexables; utilidades fuera del indice. node --test tests/
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('home, terminos y privacidad son indexables', () => {
  for (const p of ['index.html', 'terminos/index.html', 'privacidad/index.html']) {
    assert.doesNotMatch(read(p), /noindex/, p);
  }
});

test('home: canonical, Open Graph, app de Apple y JSON-LD valido', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/yoinit\.app\/">/);
  assert.match(html, /property="og:image" content="https:\/\/yoinit\.app\//);
  assert.match(html, /apple-itunes-app" content="app-id=6824063226"/);
  const blocks = [...html.matchAll(/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.deepEqual(blocks.map((b) => b['@type']), ['Organization', 'WebSite', 'MobileApplication', 'FAQPage']);
});

test('robots.txt cierra las utilidades y apunta al sitemap', () => {
  const robots = read('robots.txt');
  for (const p of ['/pelotas/', '/captcha/', '/auth/', '/r/', '/grupos/', '/partidas/', '/eliminar-cuenta/']) {
    assert.match(robots, new RegExp(`Disallow: ${p}\\n`));
  }
  assert.match(robots, /Sitemap: https:\/\/yoinit\.app\/sitemap\.xml/);
});
