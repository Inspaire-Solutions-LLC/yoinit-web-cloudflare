// CRED-004: logica pura de /pelotas/ (validacion, formato, estados). Sin DOM ni red,
// para poder probarla con `node --test tests/`. Las reglas de telefono y cedula/RIF
// replican save_payment_profile (migracion 051 del backend).

export const PELOTAS_STEPS = ['correo', 'codigo', 'pack', 'perfil', 'pago', 'estado'];

export const POLL_INTERVAL_MS = 5000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value) {
  const email = cleanEmail(value);
  return email.length <= 254 && EMAIL_RE.test(email);
}

export function cleanOtp(value) {
  return String(value ?? '').replace(/\D/g, '');
}

// Supabase envia 6 u 8 digitos segun la configuracion del proyecto.
export function isValidOtp(value) {
  return /^[0-9]{6,8}$/.test(cleanOtp(value));
}

// Devuelve '58XXXXXXXXXX' (12 digitos) o null. Igual que el backend: solo digitos,
// quita un '00' inicial y convierte '0414...' (11 digitos) a '58414...'. Admite '+58'.
export function normalizePhone(value) {
  let digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = '58' + digits.slice(1);
  return /^58[0-9]{10}$/.test(digits) ? digits : null;
}

export function isValidPhone(value) {
  return normalizePhone(value) !== null;
}

// Devuelve 'V12345678' o null: letra V/E/J y 6 a 9 digitos.
export function normalizeIdDoc(value) {
  const doc = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[VEJ][0-9]{6,9}$/.test(doc) ? doc : null;
}

export function isValidIdDoc(value) {
  return normalizeIdDoc(value) !== null;
}

// '584141234567' -> '0414-1234567'
export function displayPhone(phone) {
  const p = String(phone ?? '');
  return /^58[0-9]{10}$/.test(p) ? `0${p.slice(2, 5)}-${p.slice(5)}` : p;
}

// Telefono tal como se escribe en la app del banco: '04141234567'.
export function copyPhone(phone) {
  const p = String(phone ?? '');
  return /^58[0-9]{10}$/.test(p) ? `0${p.slice(2)}` : p;
}

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// '$8', '$12,50', '$1.250'. Sin ceros de relleno cuando son centavos exactos.
export function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  const cents = Math.round(Math.abs(n) * 100);
  const sign = n < 0 ? '-' : '';
  const whole = groupThousands(String(Math.floor(cents / 100)));
  if (cents % 100 === 0) return `${sign}$${whole}`;
  return `${sign}$${whole},${String(cents % 100).padStart(2, '0')}`;
}

// 'Bs. 9.420,83'
export function formatVes(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `${n < 0 ? '-' : ''}Bs. ${vesBody(Math.abs(n), true)}`;
}

// '9420,83': para pegar en el campo Monto del banco (sin separador de miles).
export function vesForCopy(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return vesBody(Math.abs(n), false);
}

function vesBody(abs, grouped) {
  const [int, dec] = abs.toFixed(2).split('.');
  return `${grouped ? groupThousands(int) : int},${dec}`;
}

export function pelotasLabel(n) {
  return n === 1 ? '1 pelota' : `${n} pelotas`;
}

// Precio por partida de un pack (1 pelota = 1 partida jugada).
export function pricePerMatch(priceUsd, credits) {
  const c = Number(credits);
  return c > 0 ? formatUsd(Number(priceUsd) / c) : '';
}

// Segundos -> 'mm:ss'.
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// El checkout solo se pinta con URL y clave publica cargadas y el interruptor encendido.
export function checkoutAvailability(cfg, serverDisabled = false) {
  const c = cfg || {};
  if (serverDisabled) return { available: false, reason: 'web_sales_disabled' };
  if (!c.enabled) return { available: false, reason: 'not_enabled' };
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(String(c.supabaseUrl || '')) || !String(c.anonKey || '').trim()) {
    return { available: false, reason: 'not_configured' };
  }
  return { available: true, reason: null };
}

const ERROR_COPY = {
  web_sales_disabled: 'La compra por la web aún no está disponible.',
  unauthorized: 'Tu sesión venció. Vuelve a entrar con tu correo.',
  no_exchange_rate: 'Hoy no tenemos la tasa del día. Inténtalo de nuevo en un rato.',
  payment_method_unavailable: 'Pago Móvil no está disponible por ahora. Inténtalo más tarde.',
  similar_payment_pending: 'Ya tienes un pago parecido en curso. Espera a que se confirme o venza.',
  payment_already_reported: 'Ese pago ya fue reportado.',
  payment_attempt_expired: 'El tiempo para pagar venció. Puedes intentarlo de nuevo.',
  payment_attempt_not_found: 'No encontramos ese intento de pago.',
  credit_purchase_not_payable: 'Esa compra ya no se puede pagar. Empieza una nueva.',
  pack_inactive: 'Ese pack ya no está disponible. Elige otro.',
  pack_not_found: 'No encontramos ese pack.',
  payment_profile_not_found: 'No encontramos ese perfil de pago.',
  bank_not_available_for_p2p: 'Ese banco no admite Pago Móvil por ahora. Elige otro.',
  invalid_payment_profile: 'Revisa el teléfono y la cédula o RIF.',
  invalid_otp: 'El código no es válido o ya venció. Pide uno nuevo.',
  otp_rate_limited: 'Pediste demasiados códigos. Espera un momento e inténtalo de nuevo.',
  network: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  default: 'Algo salió mal. Inténtalo de nuevo.',
};

// Acepta el codigo de error del backend (cuerpo { error }), un mensaje de PostgREST
// o un estado HTTP, y devuelve copy es-VE.
export function errorMessage(input) {
  const raw = typeof input === 'string' ? input : String(input?.code ?? input?.error ?? input?.message ?? '');
  for (const key of Object.keys(ERROR_COPY)) {
    if (key !== 'default' && key !== 'network' && raw.includes(key)) return ERROR_COPY[key];
  }
  if (input?.status === 429) return ERROR_COPY.otp_rate_limited;
  if (input?.status === 0 || raw === 'network') return ERROR_COPY.network;
  return ERROR_COPY.default;
}

export function isSalesDisabled(input) {
  const raw = typeof input === 'string' ? input : String(input?.code ?? input?.error ?? '');
  return raw.includes('web_sales_disabled');
}

// Estado de pantalla segun la compra y el ultimo intento (mismas reglas que la app).
// kind: credited | rejected | expired | late | instructions | waiting | review | loading
export function purchaseState(purchase, attempt) {
  if (!purchase) return { kind: 'loading', terminal: false };
  if (purchase.status === 'paid') return { kind: 'credited', terminal: true };
  if (purchase.status === 'rejected') {
    return { kind: 'rejected', terminal: true, reason: purchase.status_reason || null };
  }
  if (purchase.status === 'cancelled') return { kind: 'expired', terminal: true };
  const s = attempt?.status;
  if (s === 'instructions') return { kind: 'instructions', terminal: false };
  if (s === 'waiting') return { kind: 'waiting', terminal: false };
  if (s === 'late') return { kind: 'late', terminal: true };
  if (s === 'expired' || s === 'cancelled') return { kind: 'expired', terminal: true };
  return { kind: 'review', terminal: false };
}

export const STATE_COPY = {
  credited: { title: 'Pelotas acreditadas', body: 'Ya sumamos las pelotas a tu cuenta. Las verás en la app.' },
  waiting: { title: 'Estamos verificando tu pago', body: 'Cuando el banco lo confirme, acreditamos tus pelotas. Puedes dejar esta página abierta.' },
  review: { title: 'Estamos verificando tu pago', body: 'Acreditamos tus pelotas en cuanto confirmemos el pago.' },
  rejected: { title: 'No pudimos confirmar el pago', body: 'No pudimos verificar tu pago. Inténtalo de nuevo.' },
  expired: { title: 'El tiempo para pagar venció', body: 'Puedes intentarlo de nuevo con un pago nuevo.' },
  late: { title: 'El pago llegó fuera de tiempo', body: 'El pago llegó fuera de la ventana de esta compra. Escríbenos desde la app, en Ayuda, para revisarlo.' },
};

// Lectura de la tasa Bs/USD de la fila mas reciente (o null).
export function pickRate(rows) {
  const r = Array.isArray(rows) ? rows[0] : null;
  const n = Number(r?.rate);
  return Number.isFinite(n) && n > 0 ? n : null;
}
