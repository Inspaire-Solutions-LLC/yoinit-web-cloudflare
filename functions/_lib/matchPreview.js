// APP-SHARE-003 — Generador puro de la vista previa (Open Graph) y del resumen de /partidas/:id.
// Sin dependencias de Workers: se prueba con `node --test tests/`.

export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const OG_IMAGE_PATH = '/assets/images/og-yoinit-1200x630.png';
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const VE_OFFSET_MS = -4 * 3600 * 1000; // Venezuela: UTC-4 todo el año, sin horario de verano.

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Valida la forma del resumen que devuelve la edge function. Todo lo que no encaje se
// descarta (null): ante la duda, la landing genérica.
export function parseSummary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const startsAt = new Date(raw.starts_at);
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const total = num(raw.total_slots);
  const free = num(raw.free_slots);
  if (Number.isNaN(startsAt.getTime()) || !str(raw.sport) || total === null || free === null) return null;
  if (!['open', 'full', 'completed'].includes(raw.status)) return null;
  return {
    sport: str(raw.sport),
    startsAt,
    venueName: str(raw.venue_name),
    zone: str(raw.zone),
    levelMin: num(raw.level_min),
    levelMax: num(raw.level_max),
    matchType: raw.match_type === 'competitive' ? 'competitive' : 'friendly',
    totalSlots: total,
    freeSlots: free,
    status: raw.status,
  };
}

function venueParts(date) {
  const d = new Date(date.getTime() + VE_OFFSET_MS); // getUTC* sobre la hora corrida = hora de Venezuela
  const pad = (n) => String(n).padStart(2, '0');
  return {
    day: DAYS[d.getUTCDay()],
    dayOfMonth: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`, // 24 h
  };
}

export function formatLevel(n) {
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

export function levelLabel(s) {
  const { levelMin: lo, levelMax: hi } = s;
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null) return lo === hi ? `Nivel ${formatLevel(lo)}` : `Nivel ${formatLevel(lo)}–${formatLevel(hi)}`;
  return lo !== null ? `Nivel desde ${formatLevel(lo)}` : `Nivel hasta ${formatLevel(hi)}`;
}

function slotsHeadline(s) {
  if (s.status === 'completed') return 'Partida terminada';
  if (s.freeSlots <= 0) return 'Partida completa';
  return s.freeSlots === 1 ? 'Falta 1' : `Faltan ${s.freeSlots}`;
}

export function ogTitle(s) {
  const p = venueParts(s.startsAt);
  return `${slotsHeadline(s)} · ${p.day} ${p.time}`;
}

export function ogDescription(s) {
  return [s.sport, levelLabel(s), s.venueName].filter(Boolean).join(' · ');
}

export function ogTags(s, pageUrl, origin) {
  const title = escapeHtml(ogTitle(s));
  const desc = escapeHtml(ogDescription(s));
  return [
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Yoin It">',
    '<meta property="og:locale" content="es_VE">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
    `<meta property="og:image" content="${escapeHtml(origin + OG_IMAGE_PATH)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
  ].join('\n');
}

export function summaryBlock(s) {
  const p = venueParts(s.startsAt);
  const when = `${p.day} ${p.dayOfMonth} ${p.month} · ${p.time}`;
  const place = [s.venueName, s.zone].filter(Boolean).join(' · ');
  const kind = s.matchType === 'competitive' ? 'Competitivo' : 'Amistoso';
  const meta = [s.sport, levelLabel(s), kind].filter(Boolean).join(' · ');
  const slots =
    s.status === 'completed'
      ? 'Esta partida ya terminó.'
      : s.freeSlots <= 0
        ? `Completa: ${s.totalSlots} de ${s.totalSlots} plazas ocupadas.`
        : `${s.freeSlots} ${s.freeSlots === 1 ? 'plaza libre' : 'plazas libres'} de ${s.totalSlots}`;
  return [
    '<div class="partida-summary">',
    `  <p class="partida-summary-when">${escapeHtml(when)}</p>`,
    `  <p class="partida-summary-meta">${escapeHtml(meta)}</p>`,
    place ? `  <p class="partida-summary-place">${escapeHtml(place)}</p>` : '',
    `  <p class="partida-summary-slots">${escapeHtml(slots)}</p>`,
    '</div>',
  ].filter(Boolean).join('\n');
}

const OG_RANGE = /<!--OG-START-->[\s\S]*?<!--OG-END-->/;
const SUMMARY_MARK = '<!--MATCH-SUMMARY-->';

// Inyecta título, descripción, etiquetas OG y bloque de resumen en la landing. Si falta
// algún marcador devuelve el HTML tal cual en esa parte (nunca lanza).
export function applyPreview(html, summary, { pageUrl, origin }) {
  const title = escapeHtml(`${ogTitle(summary)} — Yoin It`);
  const desc = escapeHtml(ogDescription(summary));
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${desc}">`)
    .replace(OG_RANGE, () => `<!--OG-START-->\n${ogTags(summary, pageUrl, origin)}\n<!--OG-END-->`)
    .replace(SUMMARY_MARK, () => summaryBlock(summary));
  return out;
}
