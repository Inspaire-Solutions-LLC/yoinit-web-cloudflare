// Banner de consentimiento de cookies de medicion. Sin eleccion o con "Rechazar" no se
// carga nada de Meta. La eleccion vive en localStorage (la web funciona sin el).
import { pixelIdForHost, readConsent, writeConsent, shouldLoadPixel, shouldShowBanner } from './meta-pixel-logic.js';

const pixelId = pixelIdForHost(location.hostname);

function storage() { try { return window.localStorage; } catch { return null; } }

if (!pixelId) {
  document.querySelectorAll('[data-cookie-prefs]').forEach((el) => { el.hidden = true; });
} else {
  let consent = readConsent(storage());
  let banner = null;

  const apply = async () => {
    if (!shouldLoadPixel(consent, pixelId)) return;
    const mod = await import('./meta-pixel.js');
    mod.loadMetaPixel(pixelId);
  };

  const closeBanner = () => { if (banner) { banner.remove(); banner = null; } };

  const choose = async (value) => {
    const previous = consent;
    consent = value;
    writeConsent(storage(), value);
    closeBanner();
    if (value === 'accepted') await apply();
    else if (previous === 'accepted' && window.fbq) (await import('./meta-pixel.js')).revokeMetaPixel();
  };

  const openBanner = () => {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookies de medición');
    const text = document.createElement('p');
    text.className = 'cookie-banner__text';
    text.textContent = 'Usamos cookies de medición para saber qué páginas ayudan a llegar a la app. Tú decides.';
    const actions = document.createElement('div');
    actions.className = 'cookie-banner__actions';
    for (const [value, label] of [['accepted', 'Aceptar'], ['rejected', 'Rechazar']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cookie-banner__btn';
      b.textContent = label;
      b.addEventListener('click', () => choose(value));
      actions.append(b);
    }
    banner.append(text, actions);
    document.body.append(banner);
  };

  // Enlace "Preferencias de cookies" en el pie (o al final de la pagina si no hay pie).
  let links = [...document.querySelectorAll('[data-cookie-prefs]')];
  if (!links.length) {
    const wrap = document.createElement('p');
    wrap.className = 'cookie-prefs-wrap';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cookie-prefs';
    b.dataset.cookiePrefs = '';
    b.textContent = 'Preferencias de cookies';
    wrap.append(b);
    document.body.append(wrap);
    links = [b];
  }
  links.forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); openBanner(); }));

  if (shouldShowBanner(consent, pixelId)) openBanner();
  apply();
}
