import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// APP-LEGAL-001: paginas legales publicas. node --test tests/
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('/terminos existe con correo, comunidad y enlace a eliminar cuenta', () => {
  assert.ok(existsSync(new URL('../terminos/index.html', import.meta.url)));
  const html = read('terminos/index.html');
  assert.match(html, /hello@yoinit\.app/);
  assert.match(html, /comunidad/i);
  assert.match(html, /\/eliminar-cuenta\/|\.\.\/eliminar-cuenta\//);
  assert.match(html, /Venezuela/);
});

test('privacidad enlaza a terminos', () => {
  const html = read('privacidad/index.html');
  assert.match(html, /\.\.\/terminos\//);
});

test('el pie de la home enlaza a /terminos', () => {
  assert.match(read('index.html'), /href="\.\/terminos\/"/);
});
