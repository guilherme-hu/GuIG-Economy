/**
 * Aviso de trânsito no canto esquerdo: placa + texto grande, entra deslizando, barra que esvazia.
 * `show('radar', metros, fração)` · `show('calcada', segundos, fração)` · `show(null)` esconde.
 */
import { copy } from './copy.js';
import { distance } from './format.js';

// Placas no padrão brasileiro: advertência é losango amarelo; proibição é círculo vermelho com tarja.
const SIGNS = {
  radar: `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect x="15" y="15" width="70" height="70" rx="7" transform="rotate(45 50 50)" fill="#ffc72c" stroke="#111" stroke-width="5"/>
    <g fill="#111"><rect x="29" y="41" width="33" height="21" rx="3"/><path d="M62 46l11-6v23l-11-6z"/></g>
    <circle cx="45" cy="51.5" r="6.5" fill="#ffc72c"/>
  </svg>`,
  calcada: `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="43" fill="#fff" stroke="#d7261e" stroke-width="10"/>
    <g fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="32" cy="61" r="9"/><circle cx="68" cy="61" r="9"/><path d="M32 61l13-17h15l8 17M57 44l3-10h8"/>
    </g>
    <line x1="21" y1="79" x2="79" y2="21" stroke="#d7261e" stroke-width="10"/>
  </svg>`,
};

const format = {
  radar: (meters) => distance(meters),
  calcada: (seconds) => `${seconds.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`,
};

export function createWarning(root) {
  const el = document.createElement('div');
  el.className = 'ui warning';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="warning__sign"></div>
    <div class="warning__body">
      <p class="warning__title"></p>
      <p class="warning__value num"></p>
      <p class="warning__hint"></p>
      <div class="warning__bar"><i></i></div>
    </div>`;
  root.append(el);
  const [sign, title, value, hint] = ['.warning__sign', '.warning__title', '.warning__value', '.warning__hint'].map((s) => el.querySelector(s));
  let kind = null;
  let shownValue = '';

  return {
    /** `fraction` (0..1) enche a barra; abaixo de 1/3 o aviso pulsa. */
    show(next, amount = 0, fraction = 1) {
      if (next !== kind) {
        kind = next;
        el.classList.toggle('is-visible', !!kind);
        if (!kind) return;
        el.dataset.kind = kind;
        sign.innerHTML = SIGNS[kind];
        title.textContent = copy.warning[kind].title;
        hint.textContent = copy.warning[kind].hint;
      }
      if (!kind) return;
      const text = format[kind](amount);
      if (text !== shownValue) value.textContent = shownValue = text;
      el.style.setProperty('--fill', Math.max(0, Math.min(1, fraction)).toFixed(3));
      el.classList.toggle('is-urgent', fraction < 1 / 3);
    },
  };
}
