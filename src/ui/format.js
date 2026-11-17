/** Formatadores pt-BR. Todos toleram valor ausente (a sim pode não ter o campo ainda). */
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dec1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const num = (v) => (Number.isFinite(v) ? v : 0);

/** "R$ 12,40" */
export const money = (v) => brl.format(num(v));

/** "+ R$ 12,40" / "− R$ 3,10": o sinal vem do papel da linha (crédito/débito), não do valor. */
export const signedMoney = (v, sign) => `${sign < 0 ? '−' : '+'} ${brl.format(Math.abs(num(v)))}`;

/** metros → "2,3 km" */
export const km = (meters) => `${dec1.format(num(meters) / 1000)} km`;

/** metros → "120 m" (de 10 em 10) ou "1,4 km" */
export function distance(meters) {
  const m = num(meters);
  if (m >= 1000) return km(m);
  return `${Math.max(0, m < 20 ? Math.round(m) : Math.round(m / 10) * 10)} m`;
}

/** segundos → "4:10"; negativo → "-0:12" */
export function clock(seconds) {
  const s = num(seconds);
  const abs = Math.abs(s);
  const whole = s < 0 ? Math.ceil(abs) : Math.floor(abs);
  const mm = Math.floor(whole / 60);
  const ss = String(whole % 60).padStart(2, '0');
  return `${s < 0 && whole > 0 ? '-' : ''}${mm}:${ss}`;
}

/** minutos desde a meia-noite → "19:05" */
export const timeOfDay = (minutes) => `${Math.floor(minutes / 60) % 24}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;

/** m/s → km/h inteiro */
export const kmh = (ms) => Math.round(Math.abs(num(ms)) * 3.6);

/** 4.8 → "4,80" */
export const rating = (v) => dec2.format(num(v));

/** 0.86 → "86%" */
export const percent = (v) => `${int.format(num(v) * 100)}%`;

/** horas decimais → "6h00" */
export function hours(h) {
  const total = Math.round(num(h) * 60);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

export const integer = (v) => int.format(num(v));
