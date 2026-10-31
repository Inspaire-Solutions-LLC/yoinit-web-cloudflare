// Logica pura del Pixel de Meta y del consentimiento (sin DOM), testeable con node --test.
import { metaPixelConfig } from './config.js';

export const CONSENT_KEY = 'yoinit_cookie_consent';

// ID del pixel segun el hostname; null si esta apagado o el host no es de produccion.
export function pixelIdForHost(hostname, cfg = metaPixelConfig) {
  if (!cfg || !cfg.enabled || !cfg.pixelId) return null;
  const host = String(hostname || '').toLowerCase();
  return Array.isArray(cfg.hosts) && cfg.hosts.includes(host) ? String(cfg.pixelId) : null;
}

// 'accepted' | 'rejected' | null (sin eleccion, o sin localStorage).
export function readConsent(storage) {
  try {
    const value = storage && storage.getItem(CONSENT_KEY);
    return value === 'accepted' || value === 'rejected' ? value : null;
  } catch { return null; }
}

export function writeConsent(storage, value) {
  if (value !== 'accepted' && value !== 'rejected') return false;
  try { storage.setItem(CONSENT_KEY, value); return true; } catch { return false; }
}

// El pixel solo se carga con host de produccion Y consentimiento aceptado.
export function shouldLoadPixel(consent, pixelId) {
  return Boolean(pixelId) && consent === 'accepted';
}

// El banner solo tiene sentido donde el pixel existe y mientras no haya eleccion.
export function shouldShowBanner(consent, pixelId) {
  return Boolean(pixelId) && consent === null;
}

// Parametros del evento Lead al pulsar un boton de tienda (data-store="ios"|"android").
export function storeLeadParams(store) {
  if (store !== 'ios' && store !== 'android') return null;
  return { content_name: 'descarga_app', content_category: store };
}
