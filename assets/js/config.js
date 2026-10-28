// Complete these values when the public destinations are ready.
// Empty values keep the corresponding action visibly unavailable.
export const siteConfig = {
  downloads: { ios: 'https://apps.apple.com/app/id6824063226', android: 'https://play.google.com/store/apps/details?id=com.yoinit.app' },
  contact: { email: '', whatsapp: '' }, // WhatsApp: international digits, no + or spaces.
  legal: { terms: '', privacy: '', cookies: '' },
  // Paths are relative to index.html. Use real app captures for UI slots.
  images: {
    '01': 'assets/images/01-hero-app-draft.webp', '02': 'assets/images/02-explorar-v2.webp', '03': 'assets/images/03-crear-partido.webp', '04': 'assets/images/04-invitar.webp', '05': 'assets/images/05-perfil.webp', '06': 'assets/images/06-pago-individual.webp',
    '07': 'assets/images/07-jugadora.webp', '08': 'assets/images/08-comunidad-v2.webp', '09': 'assets/images/09-panel-club.webp', '10': 'assets/images/10-cobros.webp', '11': 'assets/images/11-panel-movil.webp',
  },
};

// CRED-004: compra de pelotas por web (/pelotas/). Los pone Freddy; vacios o enabled:false
// dejan la pagina en "Proximamente" sin pintar el checkout. La anon key es publica por diseno.
export const pelotasConfig = {
  supabaseUrl: '', // https://<ref>.supabase.co (produccion)
  anonKey: '',
  enabled: false,
};

// APP-SEC-002: site keys publicas de Cloudflare Turnstile, por hostname. Host que no
// esta en la tabla = sin captcha (la pagina sigue funcionando sin widget).
export const turnstileConfig = {
  prod: '0x4AAAAAAFoOB9AoraeQQoPG',
  dev: '0x4AAAAAAFoN5z-Z2V-FxJfj',
  hosts: {
    'yoinit.app': 'prod',
    'www.yoinit.app': 'prod',
    'panel.yoinit.app': 'prod',
    'localhost': 'dev',
    '127.0.0.1': 'dev',
    'yoinit-web-cloudflare-develop.joselinods-is.workers.dev': 'dev',
    'yoinit-web-cloudflare-pages-dev.pages.dev': 'dev',
    'yoinit-backend-dev.vercel.app': 'dev',
  },
};
