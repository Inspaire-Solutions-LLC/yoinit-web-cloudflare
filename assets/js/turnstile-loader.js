// APP-SEC-002: carga api.js de Turnstile una sola vez y resuelve con window.turnstile.
import { TURNSTILE_SRC } from './captcha-logic.js';

let pending = null;
export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TURNSTILE_SRC;
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile_missing')));
      s.onerror = () => { pending = null; reject(new Error('turnstile_load')); };
      document.head.appendChild(s);
    });
  }
  return pending;
}
