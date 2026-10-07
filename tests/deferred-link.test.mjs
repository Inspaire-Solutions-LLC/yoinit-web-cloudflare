import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { androidIntentUrl, cleanCode, cleanMatchId, isAndroid, playStoreUrl, referrerValue } from '../assets/js/deferred-link.js';

// APP-SHARE-004: referrer de Play, intent de Chrome y assetlinks.json. node --test tests/
const ID = '123e4567-e89b-12d3-a456-426614174000';
const STORE = 'https://play.google.com/store/apps/details?id=com.yoinit.app';

test('referrer con partida y codigo', () => {
  assert.equal(referrerValue({ matchId: ID, code: 'ab12cd' }), `link=/partidas/${ID}&ref=AB12CD`);
  assert.equal(referrerValue({ matchId: ID }), `link=/partidas/${ID}`);
});

test('referrer solo con codigo usa la ruta /r', () => {
  assert.equal(referrerValue({ code: 'ab12cd' }), 'link=/r/AB12CD');
});

test('entradas invalidas se descartan', () => {
  assert.equal(cleanMatchId('no-uuid'), '');
  assert.equal(cleanMatchId(undefined), '');
  assert.equal(cleanCode('<script>'), '');
  assert.equal(cleanCode('a b'), '');
  assert.equal(referrerValue({ matchId: 'x', code: '!' }), '');
  assert.equal(referrerValue(), '');
});

test('URL de Play: el referrer va codificado como un solo parametro', () => {
  const url = new URL(playStoreUrl(STORE, { matchId: ID, code: 'AB12CD' }));
  assert.equal(url.searchParams.get('id'), 'com.yoinit.app');
  assert.equal(url.searchParams.get('referrer'), `link=/partidas/${ID}&ref=AB12CD`);
  assert.ok(url.search.includes('referrer=link%3D%2Fpartidas%2F'));
  assert.ok(!url.search.includes('&ref='));
});

test('sin URL de tienda configurada no hay enlace', () => {
  assert.equal(playStoreUrl('', { matchId: ID }), '');
  assert.equal(playStoreUrl('no es url', { matchId: ID }), '');
});

test('sin datos, la URL de Play queda tal cual', () => {
  assert.equal(playStoreUrl(STORE, {}), STORE);
});

test('intent de Chrome con y sin destino de reserva', () => {
  assert.equal(
    androidIntentUrl(`/partidas/${ID}`, STORE),
    `intent://open/partidas/${ID}#Intent;scheme=com.yoinit.app;package=com.yoinit.app;S.browser_fallback_url=${encodeURIComponent(STORE)};end`,
  );
  assert.equal(
    androidIntentUrl('/r/AB12CD', ''),
    'intent://open/r/AB12CD#Intent;scheme=com.yoinit.app;package=com.yoinit.app;end',
  );
});

test('deteccion de Android', () => {
  assert.equal(isAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120'), true);
  assert.equal(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), false);
  assert.equal(isAndroid(undefined), false);
});

test('assetlinks.json: paquete, relacion y las dos huellas del brief', () => {
  const links = JSON.parse(readFileSync(new URL('../.well-known/assetlinks.json', import.meta.url), 'utf8'));
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(links[0].target.namespace, 'android_app');
  assert.equal(links[0].target.package_name, 'com.yoinit.app');
  const fp = links[0].target.sha256_cert_fingerprints;
  assert.equal(fp.length, 2);
  for (const f of fp) assert.match(f, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});

test('_headers sirve assetlinks.json como application/json', () => {
  const headers = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/\.well-known\/assetlinks\.json\n\s+Content-Type: application\/json/);
});
