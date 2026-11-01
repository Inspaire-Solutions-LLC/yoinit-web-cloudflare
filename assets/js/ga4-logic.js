// Logica pura de Google Analytics 4 (sin DOM), testeable con node --test.
// El consentimiento (CONSENT_KEY, shouldLoadPixel...) se comparte con meta-pixel-logic.js.
import { ga4Config } from './config.js';

// Consent Mode v2: todo denegado por defecto; solo analytics_storage pasa a granted al aceptar.
export const CONSENT_DEFAULT = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
export const CONSENT_GRANTED = { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
export const CONSENT_DENIED = CONSENT_DEFAULT;

// ID de medicion segun el hostname; null si esta apagado o el host no es de produccion.
export function ga4IdForHost(hostname, cfg = ga4Config) {
  if (!cfg || !cfg.enabled || !cfg.measurementId) return null;
  const host = String(hostname || '').toLowerCase();
  return Array.isArray(cfg.hosts) && cfg.hosts.includes(host) ? String(cfg.measurementId) : null;
}

// Parametros del evento store_click al pulsar un boton de tienda.
export function storeClickParams(store) {
  if (store !== 'ios' && store !== 'android') return null;
  return { platform: store };
}
