/**
 * Telas cheias: menu, pausa, extrato do dia (o momento-chave) e fim de jogo.
 * Só mostram dados e devolvem a decisão pelos callbacks; não conhecem a sim.
 */
import { copy } from './copy.js';
import * as fmt from './format.js';
import { mount, refs, setAttr } from './phone/dom.js';
import { icons } from './phone/icons.js';

const NAMES = ['menu', 'pausa', 'extrato', 'fim'];
const s = copy.statement;
const g = copy.gameOver;

const keys = (list) => list.map((key) => `<span class="kbd">${key}</span>`).join('');
const controls = `
<ul class="controls">
  ${copy.controls.items
    .map(
      (item) => `
  <li>
    <span class="controls__keys">${keys(item.keys)}${item.alt ? `<i>${copy.controls.or}</i>${keys(item.alt)}` : ''}</span>
    <span>${item.label}</span>
  </li>`,
    )
    .join('')}
</ul>`;

const wordmark = (modifier = '') =>
  `<span class="wordmark ${modifier}">${icons.bolt}<span class="wordmark__text">${copy.brand.name}</span></span>`;

const receiptRow = (key, sign, index) => `
<div class="receipt__row" data-sign="${sign}" style="--i:${index}">
  <dt>${s.rows[key]}</dt><dd class="num" data-ref="st_${key}"></dd>
</div>`;

const template = `
<div class="ui screens" hidden>
  <section class="screen screen--menu" data-screen="menu">
    <div class="menu__main">
      <h1 class="menu__title"><span>GuIG</span> Economy</h1>
      <p class="menu__subtitle">${copy.game.subtitle}</p>
      <div class="menu__pitch">
        ${wordmark('wordmark--on-brand')}
        <strong>${copy.brand.pitchTitle}</strong>
        <p>${copy.brand.pitchText}</p>
        <small>${copy.brand.pitchFootnote}</small>
      </div>
      <div class="menu__actions">
        <button class="btn btn--brand btn--lg" type="button" data-action="onStart" data-primary>
          ${copy.menu.start}<span class="kbd">${copy.menu.hint}</span>
        </button>
        <span class="menu__goal">${copy.menu.goal}</span>
      </div>
    </div>
    <aside class="menu__controls panel">
      <h2 class="eyebrow">${copy.controls.title}</h2>
      ${controls}
    </aside>
  </section>

  <section class="screen screen--pausa" data-screen="pausa">
    <div class="panel pause">
      <h1>${copy.pause.title}</h1>
      <p>${copy.pause.text}</p>
      <div class="pause__actions">
        <button class="btn btn--brand btn--lg" type="button" data-action="onResume" data-primary>
          ${copy.pause.resume}<span class="kbd">Esc</span>
        </button>
        <button class="btn btn--ghost btn--lg" type="button" data-action="onRestart">${copy.pause.restart}</button>
      </div>
      <h2 class="eyebrow">${copy.controls.title}</h2>
      ${controls}
    </div>
  </section>

  <section class="screen screen--extrato" data-screen="extrato">
    <div class="receipt">
      <header class="receipt__head">
        ${wordmark('wordmark--on-brand')}
        <span>${s.receiptTitle} · <b data-ref="st_day"></b></span>
      </header>
      <dl class="receipt__rows">
        ${receiptRow('gross', 'plus', 0)}
        ${receiptRow('tips', 'plus', 1)}
        ${receiptRow('fuel', 'minus', 2)}
        ${receiptRow('rent', 'minus', 3)}
        ${receiptRow('fines', 'minus', 4)}
      </dl>
      <div class="receipt__total" style="--i:5" data-ref="st_total">
        <span>${s.net}</span><strong class="num" data-ref="st_net"></strong>
      </div>
      <dl class="receipt__meta" style="--i:6">
        <div><dt>${s.deliveries}</dt><dd class="num" data-ref="st_deliveries"></dd></div>
        <div><dt>${s.late}</dt><dd class="num" data-ref="st_late"></dd></div>
        <div data-ref="st_hoursRow"><dt>${s.hours}</dt><dd class="num" data-ref="st_hours"></dd></div>
      </dl>
      <p class="receipt__foot" style="--i:7">${s.footnote}</p>
    </div>

    <div class="summary">
      <span class="eyebrow" data-ref="st_eyebrow"></span>
      <h1>${s.title}</h1>
      <div class="summary__hour" data-ref="st_hourBox">
        <span class="summary__label">${s.perHourLabel}</span>
        <span class="summary__hour-value num"><b data-ref="st_perHour"></b><i>${s.perHourUnit}</i></span>
        <span class="summary__note">${s.perHourNote}</span>
      </div>
      <div class="panel summary__bills" data-ref="st_bills">
        <div class="summary__bills-head">
          <span class="summary__label">${s.billsTitle} · <b class="num" data-ref="st_billsValue"></b></span>
          <span class="tag" data-ref="st_billsTag"></span>
        </div>
        <div class="bar"><i data-ref="st_billsBar"></i></div>
        <p data-ref="st_billsText"></p>
        <p class="summary__warning" data-ref="st_warning">${s.evictionWarning}</p>
      </div>
      <button class="btn btn--brand btn--lg" type="button" data-action="onNextDay" data-primary>
        ${s.next}<span class="kbd">Enter</span>
      </button>
    </div>
  </section>

  <section class="screen screen--fim" data-screen="fim" data-ref="fim">
    <div class="panel over">
      <header class="over__from">${wordmark()}<span>${g.from}</span></header>
      <span class="tag tag--danger" data-ref="over_tag"></span>
      <h1 data-ref="over_title"></h1>
      <blockquote data-ref="over_message"></blockquote>
      <p class="over__aside" data-ref="over_aside"></p>
      <dl class="over__stats">
        <div><dt>${g.stats.days}</dt><dd class="num" data-ref="over_days"></dd></div>
        <div><dt>${g.stats.deliveries}</dt><dd class="num" data-ref="over_deliveries"></dd></div>
        <div><dt>${g.stats.earned}</dt><dd class="num" data-ref="over_earned"></dd></div>
        <div><dt>${g.stats.perHour}</dt><dd class="num" data-ref="over_perHour"></dd></div>
      </dl>
      <button class="btn btn--brand btn--lg" type="button" data-action="onRestart" data-primary>
        ${g.restart}<span class="kbd">Enter</span>
      </button>
    </div>
  </section>
</div>`;

export function createScreens(root, callbacks = {}) {
  const node = mount(root, template);
  const r = refs(node);
  let current = null;

  for (const button of node.querySelectorAll('[data-action]')) {
    button.addEventListener('click', () => callbacks[button.dataset.action]?.());
  }

  function fillStatement({ day = 1, statement = {}, bills = 0, metBills } = {}) {
    const { gross = 0, tips = 0, fuel = 0, rent = 0, fines = 0 } = statement;
    const net = statement.net ?? gross + tips - fuel - rent - fines;
    const perHour = statement.perHour ?? 0;
    const hours = statement.hours ?? (perHour ? net / perHour : null);
    const met = metBills ?? net >= bills;

    r.st_day.textContent = s.receiptDay(day);
    r.st_eyebrow.textContent = s.eyebrow(day);
    r.st_gross.textContent = fmt.signedMoney(gross, 1);
    r.st_tips.textContent = fmt.signedMoney(tips, 1);
    r.st_fuel.textContent = fmt.signedMoney(fuel, -1);
    r.st_rent.textContent = fmt.signedMoney(rent, -1);
    r.st_fines.textContent = fmt.signedMoney(fines, -1);
    r.st_net.textContent = fmt.money(net);
    setAttr(r.st_total, 'data-negative', net < 0);
    r.st_deliveries.textContent = fmt.integer(statement.deliveries);
    r.st_late.textContent = fmt.integer(statement.late);
    setAttr(r.st_hoursRow, 'hidden', hours == null);
    r.st_hours.textContent = fmt.hours(hours);

    r.st_perHour.textContent = fmt.money(perHour);
    setAttr(r.st_hourBox, 'data-negative', perHour < 0);
    r.st_billsValue.textContent = fmt.money(bills);
    r.st_billsTag.textContent = met ? s.billsMetTag : s.billsMissedTag;
    r.st_billsBar.style.transform = `scaleX(${bills > 0 ? Math.min(1, Math.max(0, net / bills)) : 1})`;
    r.st_billsText.textContent = met ? s.billsMet : s.billsMissed(bills - net);
    setAttr(r.st_bills, 'data-met', met);
    setAttr(r.st_warning, 'hidden', met);
  }

  function fillGameOver({ reason = 'acidente', stats = {} } = {}) {
    const text = g[reason] ?? g.acidente;
    setAttr(r.fim, 'data-reason', reason);
    r.over_tag.textContent = text.tag;
    r.over_title.textContent = text.title;
    r.over_message.textContent = text.message;
    r.over_aside.textContent = text.aside;
    r.over_days.textContent = fmt.integer(stats.days);
    r.over_deliveries.textContent = fmt.integer(stats.deliveries);
    r.over_earned.textContent = fmt.money(stats.earned);
    r.over_perHour.textContent = fmt.money(stats.perHour);
  }

  return {
    get current() {
      return current;
    },
    /** @param {'menu'|'pausa'|'extrato'|'fim'} name */
    show(name, data) {
      if (!NAMES.includes(name)) return;
      if (name === 'extrato') fillStatement(data);
      if (name === 'fim') fillGameOver(data);
      current = name;
      node.dataset.screen = name;
      node.hidden = false;
      // Enter/Espaço no botão focado = ação principal, sem ouvir teclado aqui
      node.querySelector(`[data-screen="${name}"] [data-primary]`)?.focus({ preventScroll: true });
    },
    hide() {
      current = null;
      node.hidden = true;
      delete node.dataset.screen;
      if (node.contains(document.activeElement)) document.activeElement.blur();
    },
  };
}
