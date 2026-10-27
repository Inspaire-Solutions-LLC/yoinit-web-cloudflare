// APP-SEC-002: pagina /captcha/, pensada para un WebView de la app Flutter.
// Contrato fijo: solo notifica por window.YoinitCaptcha.postMessage(texto) con JSON en texto.
import { captchaMessage, parseCaptchaParams, siteKeyForHost } from './captcha-logic.js';
import { loadTurnstile } from './turnstile-loader.js';

function notify(text) {
  try {
    if (window.YoinitCaptcha && typeof window.YoinitCaptcha.postMessage === 'function') window.YoinitCaptcha.postMessage(text);
  } catch { /* sin canal: navegador normal */ }
}

async function main() {
  const { theme, action } = parseCaptchaParams(location.search);
  const box = document.getElementById('cf-widget');
  const sitekey = siteKeyForHost(location.hostname);
  if (!sitekey) { notify(captchaMessage.error('no_sitekey')); return; }
  let ts;
  try { ts = await loadTurnstile(); } catch { notify(captchaMessage.error('script_load')); return; }
  try {
    ts.render(box, {
      sitekey, theme, action, size: 'normal',
      callback: (token) => notify(captchaMessage.token(token)),
      'expired-callback': () => notify(captchaMessage.expired()),
      'timeout-callback': () => notify(captchaMessage.expired()),
      'error-callback': (code) => { notify(captchaMessage.error(code)); return true; },
    });
    notify(captchaMessage.ready());
  } catch {
    notify(captchaMessage.error('render'));
  }
}
main();
