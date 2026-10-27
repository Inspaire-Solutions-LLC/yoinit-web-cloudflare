// CRED-004: checkout de pelotas por Pago Movil. Supabase por REST, sin librerias
// (el CSP solo permite scripts propios). El access_token vive solo en memoria.
import { pelotasConfig } from './config.js';
import {
  checkoutAvailability, cleanEmail, cleanOtp, copyPhone, displayPhone, errorMessage, formatCountdown, formatUsd,
  formatVes, isSalesDisabled, isValidEmail, isValidOtp, normalizeIdDoc, normalizePhone, pelotasLabel, pickRate,
  POLL_INTERVAL_MS, pricePerMatch, purchaseState, STATE_COPY, vesForCopy,
} from './pelotas-logic.js';
import { buildOtpBody, captchaFailureMessage, isCaptchaError, siteKeyForHost } from './captcha-logic.js';
import { loadTurnstile } from './turnstile-loader.js';

const $ = (id) => document.getElementById(id);
const soon = $('pel-soon');
const checkout = $('pel-checkout');
const alertBox = $('pel-alert');

const state = { email: '', token: null, packs: [], rate: null, banks: [], profiles: [], pack: null, profileId: null, purchase: null, attempt: null, timer: null, tick: null, captchaToken: null, captchaId: null, captchaKey: siteKeyForHost(location.hostname) };

class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { apikey: pelotasConfig.anonKey, 'Content-Type': 'application/json' };
  headers.Authorization = `Bearer ${auth && state.token ? state.token : pelotasConfig.anonKey}`;
  let res;
  try {
    res = await fetch(pelotasConfig.supabaseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('network', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* cuerpo vacio */ }
  if (!res.ok) {
    const code = data?.error_code || data?.error || data?.code || data?.message || data?.msg || `http_${res.status}`;
    throw new ApiError(String(code), res.status);
  }
  return data;
}

// ---------- UI ----------
const STEP_GROUP = { correo: 'correo', codigo: 'correo', pack: 'pack', perfil: 'perfil', pago: 'pago', estado: 'pago' };
const ORDER = ['correo', 'pack', 'perfil', 'pago'];

function show(step) {
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== step; });
  const idx = ORDER.indexOf(STEP_GROUP[step]);
  document.querySelectorAll('#pel-steps li').forEach((li) => {
    const i = ORDER.indexOf(li.dataset.step);
    li.classList.toggle('is-done', i < idx);
    li.classList.toggle('is-current', i === idx);
    if (i === idx) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  setAlert('');
  const heading = document.querySelector(`[data-panel="${step}"] h3`);
  if (heading) heading.focus();
}

function setAlert(text) {
  alertBox.textContent = text;
  alertBox.hidden = !text;
}

function fieldError(id, text) {
  const el = $(id);
  el.textContent = text || '';
  el.hidden = !text;
}

function busy(btn, on, label) {
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
  btn.disabled = on;
}

function fail(err) {
  if (isSalesDisabled(err.code || err)) {
    stopPolling();
    checkout.hidden = true;
    soon.hidden = false;
    $('pel-soon-text').textContent = errorMessage('web_sales_disabled');
    return;
  }
  if (err.status === 401 || String(err.code).includes('unauthorized') || String(err.code).includes('JWT')) {
    state.token = null;
    show('correo');
    setAlert(errorMessage('unauthorized'));
    return;
  }
  setAlert(errorMessage(err));
}

// ---------- Captcha (APP-SEC-002) ----------
// Sin site key para este host no hay widget y el POST va sin token.
async function initCaptcha() {
  if (!state.captchaKey) return;
  const box = $('cf-widget');
  box.hidden = false;
  try {
    const ts = await loadTurnstile();
    state.captchaId = ts.render(box, {
      sitekey: state.captchaKey, theme: 'auto', size: 'normal',
      callback: (t) => { state.captchaToken = t; },
      'expired-callback': () => { state.captchaToken = null; },
      'timeout-callback': () => { state.captchaToken = null; },
      'error-callback': () => { state.captchaToken = null; return true; },
    });
  } catch {
    state.captchaId = null;
    setAlert(captchaFailureMessage('failed'));
  }
}

function resetCaptcha() {
  state.captchaToken = null;
  if (state.captchaId !== null && window.turnstile) {
    try { window.turnstile.reset(state.captchaId); } catch { /* widget ya no existe */ }
  }
}

// ---------- Paso 1 y 2: correo y codigo ----------
function initCorreo() {
  initCaptcha();
  $('form-correo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = cleanEmail($('in-email').value);
    if (!isValidEmail(email)) { fieldError('err-email', 'Escribe un correo válido.'); return; }
    fieldError('err-email', '');
    if (state.captchaKey && !state.captchaToken) { setAlert(captchaFailureMessage(state.captchaId === null ? 'failed' : 'missing')); if (state.captchaId === null) initCaptcha(); return; }
    const btn = e.target.querySelector('button[type=submit]');
    busy(btn, true, 'Enviando…');
    try {
      await api('/auth/v1/otp', { method: 'POST', auth: false, body: buildOtpBody(email, state.captchaToken) });
      resetCaptcha();
    } catch (err) {
      resetCaptcha();
      if (isCaptchaError(err)) { busy(btn, false); setAlert(captchaFailureMessage('rejected')); return; }
      // Respuesta generica: solo se distinguen limite de envios y falta de red; cualquier otro
      // error cuenta como enviado para no revelar si el correo existe.
      if (err.status === 429 || err.code === 'network') { busy(btn, false); setAlert(errorMessage(err)); return; }
    }
    busy(btn, false);
    state.email = email;
    show('codigo');
    $('in-otp').focus();
  });

  $('btn-otp-back').addEventListener('click', () => show('correo'));

  $('form-codigo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = cleanOtp($('in-otp').value);
    if (!isValidOtp(token)) { fieldError('err-otp', 'El código tiene entre 6 y 8 números.'); return; }
    fieldError('err-otp', '');
    const btn = e.target.querySelector('button[type=submit]');
    busy(btn, true, 'Entrando…');
    try {
      const data = await api('/auth/v1/verify', { method: 'POST', auth: false, body: { type: 'email', email: state.email, token } });
      state.token = data.access_token;
      await loadCatalog();
      show('pack');
    } catch (err) {
      if (err.status >= 400 && err.status < 500 && err.status !== 429 && !state.token) setAlert(errorMessage('invalid_otp'));
      else fail(err);
    } finally {
      busy(btn, false);
    }
  });
}

// ---------- Paso 3: pack ----------
async function loadCatalog() {
  const [packs, rates] = await Promise.all([
    api('/rest/v1/credit_packs?select=id,name,credits,price_usd,sort_order&is_active=eq.true&order=sort_order.asc'),
    api('/rest/v1/exchange_rates?select=rate&order=fetched_at.desc&limit=1').catch(() => []),
  ]);
  state.packs = packs || [];
  state.rate = pickRate(rates);
  renderPacks();
}

function renderPacks() {
  const list = $('pack-list');
  list.textContent = '';
  if (!state.packs.length) {
    $('pack-help').textContent = 'Por ahora no hay packs disponibles. Inténtalo más tarde.';
    $('btn-pack-next').hidden = true;
    return;
  }
  $('btn-pack-next').hidden = false;
  for (const p of state.packs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pel-option';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(state.pack?.id === p.id));
    b.innerHTML = '<span class="pel-option__main"><span class="pel-option__title"></span><span class="pel-option__sub"></span></span><span class="pel-option__price"><span class="pel-usd"></span></span>';
    b.querySelector('.pel-option__title').textContent = `${p.name} · ${pelotasLabel(p.credits)}`;
    b.querySelector('.pel-option__sub').textContent = `${pricePerMatch(p.price_usd, p.credits)} por partida`;
    b.querySelector('.pel-usd').textContent = formatUsd(p.price_usd);
    if (state.rate) {
      const small = document.createElement('small');
      small.textContent = formatVes(Number(p.price_usd) * state.rate);
      b.querySelector('.pel-option__price').appendChild(small);
    }
    b.addEventListener('click', () => { state.pack = p; renderPacks(); });
    list.appendChild(b);
  }
  $('btn-pack-next').disabled = !state.pack;
}

// ---------- Paso 4: perfil de Pago Movil ----------
async function loadProfiles() {
  const [banks, profiles] = await Promise.all([
    api('/rest/v1/bnc_bank_catalog?select=code,name&supports_p2p=eq.true&order=name.asc'),
    api('/rest/v1/payment_profiles?select=id,bank_code,phone,id_doc,label,is_default&order=created_at.asc'),
  ]);
  state.banks = banks || [];
  state.profiles = profiles || [];
  const sel = $('in-bank');
  sel.textContent = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = state.banks.length ? 'Elige tu banco' : 'No hay bancos disponibles';
  sel.appendChild(ph);
  for (const b of state.banks) {
    const o = document.createElement('option');
    o.value = b.code;
    o.textContent = `${b.name} (${b.code})`;
    sel.appendChild(o);
  }
  renderProfiles();
  if (!state.banks.length) setAlert('Por ahora no hay bancos disponibles para Pago Móvil. Inténtalo más tarde.');
}

function bankName(code) {
  return state.banks.find((b) => b.code === code)?.name || code;
}

function renderProfiles(showForm = false) {
  const list = $('profile-list');
  list.textContent = '';
  const has = state.profiles.length > 0;
  list.hidden = !has;
  $('btn-use-profile').hidden = !has || showForm;
  $('btn-new-profile').hidden = !has || showForm;
  $('form-perfil').hidden = has && !showForm;
  if (!has) return;
  if (!state.profileId || !state.profiles.some((p) => p.id === state.profileId)) {
    state.profileId = (state.profiles.find((p) => p.is_default) || state.profiles[0]).id;
  }
  for (const p of state.profiles) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pel-option';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(p.id === state.profileId));
    b.innerHTML = '<span class="pel-option__main"><span class="pel-option__title"></span><span class="pel-option__sub"></span></span>';
    b.querySelector('.pel-option__title').textContent = bankName(p.bank_code);
    b.querySelector('.pel-option__sub').textContent = `${displayPhone(p.phone)} · ${p.id_doc}`;
    b.addEventListener('click', () => { state.profileId = p.id; renderProfiles(showForm); });
    list.appendChild(b);
  }
}

function initPerfil() {
  $('btn-pack-next').addEventListener('click', async () => {
    const btn = $('btn-pack-next');
    busy(btn, true, 'Cargando…');
    try {
      await loadProfiles();
      show('perfil');
      if (!state.banks.length) setAlert('Por ahora no hay bancos disponibles para Pago Móvil. Inténtalo más tarde.');
    } catch (err) {
      fail(err);
    } finally {
      busy(btn, false);
    }
  });

  $('btn-new-profile').addEventListener('click', () => {
    renderProfiles(true);
    $('in-bank').focus();
  });

  $('form-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bank = $('in-bank').value;
    const phone = normalizePhone($('in-phone').value);
    const doc = normalizeIdDoc($('in-doc').value);
    fieldError('err-bank', bank ? '' : 'Elige tu banco.');
    fieldError('err-phone', phone ? '' : 'Escribe el teléfono con 11 dígitos, por ejemplo 0414-1234567.');
    fieldError('err-doc', doc ? '' : 'Escribe la cédula o RIF con letra V, E o J y de 6 a 9 números.');
    if (!bank || !phone || !doc) return;
    const btn = $('btn-perfil');
    busy(btn, true, 'Guardando…');
    try {
      const profile = await api('/rest/v1/rpc/save_payment_profile', {
        method: 'POST', body: { p_bank_code: bank, p_phone: phone, p_id_doc: doc, p_label: 'web' },
      });
      state.profileId = profile.id;
      await startPurchase();
    } catch (err) {
      fail(err);
    } finally {
      busy(btn, false);
    }
  });

  $('btn-use-profile').addEventListener('click', async () => {
    const btn = $('btn-use-profile');
    busy(btn, true, 'Preparando…');
    try { await startPurchase(); } catch (err) { fail(err); } finally { busy(btn, false); }
  });
}

// ---------- Paso 5: compra y coordenadas ----------
async function startPurchase() {
  const res = await api('/functions/v1/web-purchase-credit-pack', {
    method: 'POST', body: { pack_id: state.pack.id, method: 'pago_movil', payment_profile_id: state.profileId },
  });
  state.purchase = res.purchase;
  state.attempt = res.attempt || null;
  lastKind = null;
  render();
  startPolling();
}

function row(label, value, copy, key) {
  const d = document.createElement('div');
  if (key) d.className = 'pel-coords__key';
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd'); dd.textContent = value;
  d.append(dt, dd);
  if (copy) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pel-copy'; b.textContent = 'Copiar';
    b.setAttribute('aria-label', `Copiar ${label.toLowerCase()}`);
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(copy); b.textContent = 'Copiado'; } catch { b.textContent = 'No se pudo'; }
      setTimeout(() => { b.textContent = 'Copiar'; }, 1800);
    });
    d.appendChild(b);
  }
  return d;
}

let lastKind = null;
function render() {
  const st = purchaseState(state.purchase, state.attempt);
  const a = state.attempt;
  if (st.kind === 'instructions' && a) {
    if (lastKind !== 'instructions') {
      show('pago');
      const dl = $('pago-coords');
      dl.textContent = '';
      dl.append(
        row('Banco', bankName(a.payee_bank_code), a.payee_bank_code),
        row('Teléfono', displayPhone(a.payee_phone), copyPhone(a.payee_phone)),
        row('Cédula/RIF', a.payee_id_doc, a.payee_id_doc),
        row('Monto exacto', formatVes(a.expected_amount_ves), vesForCopy(a.expected_amount_ves)),
        row('Concepto', a.match_code, a.match_code, true),
      );
      $('pago-note').textContent = `Paga desde ${bankName(a.payer_bank_code)}, con ${displayPhone(a.payer_phone)} y ${a.payer_id_doc}. Envía el monto exacto.`;
    }
    updateTimer();
  } else if (lastKind !== st.kind) {
    showResult(st);
  }
  lastKind = st.kind;
}

function updateTimer() {
  const a = state.attempt;
  if (!a || !a.expires_at) return;
  const ms = new Date(a.expires_at).getTime() - Date.now();
  const t = $('pago-timer');
  t.textContent = 'Tiempo para pagar ';
  const s = document.createElement('strong');
  s.textContent = formatCountdown(ms);
  t.appendChild(s);
  $('btn-sent').disabled = ms <= 0;
}

function showResult(st) {
  const copy = STATE_COPY[st.kind] || STATE_COPY.review;
  show('estado');
  $('t-estado').textContent = copy.title;
  $('estado-body').textContent = copy.body;
  $('btn-retry').hidden = !(st.kind === 'rejected' || st.kind === 'expired');
}

function initPago() {
  $('btn-sent').addEventListener('click', async () => {
    const btn = $('btn-sent');
    busy(btn, true, 'Avisando…');
    try {
      await api('/functions/v1/mark-p2c-payment-sent', { method: 'POST', body: { payment_id: state.attempt.payment_id } });
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      busy(btn, false);
    }
  });

  $('btn-retry').addEventListener('click', () => {
    stopPolling();
    state.purchase = null; state.attempt = null; lastKind = null;
    show('pack');
  });
}

// ---------- Sondeo ----------
async function refresh() {
  if (!state.purchase) return;
  const id = encodeURIComponent(state.purchase.id);
  try {
    const [p, at] = await Promise.all([
      api(`/rest/v1/credit_pack_purchases?select=id,status,status_reason,credits&id=eq.${id}`),
      api(`/rest/v1/payment_attempts?select=*&credit_purchase_id=eq.${id}&order=created_at.desc&limit=1`),
    ]);
    if (p?.[0]) state.purchase = { ...state.purchase, ...p[0] };
    state.attempt = at?.[0] || state.attempt;
    render();
    if (purchaseState(state.purchase, state.attempt).terminal) stopPolling();
  } catch (err) {
    if (err.status === 401) { stopPolling(); fail(err); }
    // Un fallo suelto del sondeo no corta la espera: se reintenta en el siguiente ciclo.
  }
}

function startPolling() {
  stopPolling();
  state.timer = setInterval(refresh, POLL_INTERVAL_MS);
  state.tick = setInterval(() => { if (lastKind === 'instructions') updateTimer(); }, 1000);
}

function stopPolling() {
  clearInterval(state.timer);
  clearInterval(state.tick);
  state.timer = state.tick = null;
}

// ---------- Arranque ----------
if (checkoutAvailability(pelotasConfig).available) {
  soon.hidden = true;
  checkout.hidden = false;
  initCorreo();
  initPerfil();
  initPago();
  show('correo');
}
