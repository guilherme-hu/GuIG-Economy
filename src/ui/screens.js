/**
 * Telas cheias: menu, pausa, extrato do dia (o momento-chave) e fim de jogo, no visual de app do Rapidão.
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

export const wordmark = () =>
  `<span class="wordmark">${icons.bolt}<span class="wordmark__text"><i>rapi</i>dão</span></span>`;

const statRow = (icon, label, ref) => `
<div class="sheet__row"><span class="sheet__icon">${icons[icon]}</span><dt>${label}</dt><dd class="num" data-ref="${ref}"></dd></div>`;

const template = `
<div class="ui screens" hidden>
  <section class="screen screen--menu" data-screen="menu">
    <div class="menu__main">
      <h1 class="menu__title"><span>G</span>u<span>IG</span> Economy</h1>
      <p class="menu__subtitle">${copy.game.subtitle}</p>
      <div class="sheet light menu__promo">
        ${wordmark()}
        <h2>${copy.brand.pitchTitle}</h2>
        <p>${copy.brand.pitchText}</p>
        <div class="menu__perks">${copy.brand.perks.map((perk, i) => `<span class="chip${i ? '' : ' chip--green'}">${perk}</span>`).join('')}</div>
        <small>${copy.brand.pitchFootnote}</small>
        <button class="btn btn--brand btn--lg btn--block" type="button" data-action="onStart" data-primary>
          ${copy.menu.start}<span class="kbd">${copy.menu.hint}</span>
        </button>
      </div>
      <p class="menu__goal"><span>${icons.target}</span>${copy.menu.goal}</p>
    </div>
    <aside class="menu__controls">
      <h2>${copy.controls.title}</h2>
      ${controls}
    </aside>
  </section>

  <section class="screen screen--pausa" data-screen="pausa">
    <div class="sheet light pause">
      <h1>${copy.pause.title}</h1>
      <p>${copy.pause.text}</p>
      <button class="btn btn--dark btn--lg btn--block" type="button" data-action="onResume" data-primary>
        ${copy.pause.resume}<span class="kbd">Esc</span>
      </button>
      <button class="btn btn--ghost btn--lg btn--block" type="button" data-action="onRestart">${copy.pause.restart}</button>
      <h2>${copy.controls.title}</h2>
      ${controls}
    </div>
  </section>

  <section class="screen screen--extrato" data-screen="extrato">
    <div class="sheet light statement">
      <header class="sheet__head">${wordmark()}<span class="chip" data-ref="st_day"></span></header>
      <p class="sheet__eyebrow">${s.eyebrow}</p>
      <h1>${s.title}</h1>
      <div class="statement__totals">
        <div class="statement__net" data-ref="st_total">
          <small>${s.net}</small><strong class="num" data-ref="st_net"></strong>
          <small><span data-ref="st_deliveries"></span> · <span data-ref="st_late"></span><span data-ref="st_hoursRow"> · <span data-ref="st_hours"></span></span></small>
        </div>
        <div class="statement__hour" data-ref="st_hourBox"><small>${s.perHourLabel}</small><strong class="num" data-ref="st_perHour"></strong></div>
      </div>
      <dl class="statement__rows">
        <div><dt>${s.rows.gross}</dt><dd class="num" data-ref="st_gross"></dd></div>
        <div><dt>${s.rows.tips}</dt><dd class="num" data-ref="st_tips"></dd></div>
        <div data-sign="minus"><dt>${s.rows.fuel}</dt><dd class="num" data-ref="st_fuel"></dd></div>
        <div data-sign="minus"><dt>${s.rows.rent}</dt><dd class="num" data-ref="st_rent"></dd></div>
        <div data-sign="minus"><dt>${s.rows.fines}</dt><dd class="num" data-ref="st_fines"></dd></div>
      </dl>
      <div class="statement__bills" data-ref="st_bills">
        <div class="statement__bills-head"><b>${s.billsTitle} · <span class="num" data-ref="st_billsValue"></span></b><span class="chip" data-ref="st_billsTag"></span></div>
        <div class="bar"><i data-ref="st_billsBar"></i></div>
        <p data-ref="st_billsText"></p>
        <p class="statement__warning" data-ref="st_warning">${s.evictionWarning}</p>
      </div>
      <button class="btn btn--dark btn--lg btn--block" type="button" data-action="onNextDay" data-primary>
        ${s.next}<span class="kbd">Enter</span>
      </button>
      <p class="sheet__fine">${s.footnote}</p>
    </div>
  </section>

  <section class="screen screen--fim" data-screen="fim" data-ref="fim">
    <div class="sheet light over">
      <header class="over__hero">
        ${wordmark()}
        <span class="chip chip--red" data-ref="over_tag"></span>
        <h1 data-ref="over_title"></h1>
        ${icons.courier}
      </header>
      <div class="over__body">
        <p data-ref="over_message"></p>
        <p class="over__aside" data-ref="over_aside"></p>
        <dl class="over__stats">
          ${statRow('calendar', g.stats.days, 'over_days')}
          ${statRow('offers', g.stats.deliveries, 'over_deliveries')}
          ${statRow('cash', g.stats.earned, 'over_earned')}
          ${statRow('clock', g.stats.perHour, 'over_perHour')}
        </dl>
        <button class="btn btn--dark btn--lg btn--block" type="button" data-action="onRestart" data-primary>
          ${g.restart}<span class="kbd">Enter</span>
        </button>
      </div>
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
    r.st_gross.textContent = fmt.signedMoney(gross, 1);
    r.st_tips.textContent = fmt.signedMoney(tips, 1);
    r.st_fuel.textContent = fmt.signedMoney(fuel, -1);
    r.st_rent.textContent = fmt.signedMoney(rent, -1);
    r.st_fines.textContent = fmt.signedMoney(fines, -1);
    r.st_net.textContent = fmt.money(net);
    setAttr(r.st_total, 'data-negative', net < 0);
    r.st_deliveries.textContent = s.deliveries(statement.deliveries ?? 0);
    r.st_late.textContent = s.late(statement.late ?? 0);
    setAttr(r.st_hoursRow, 'hidden', hours == null);
    r.st_hours.textContent = fmt.hours(hours);

    r.st_perHour.textContent = fmt.money(perHour);
    setAttr(r.st_hourBox, 'data-negative', perHour < 0);
    r.st_billsValue.textContent = fmt.money(bills);
    r.st_billsTag.textContent = met ? s.billsMetTag : s.billsMissedTag(bills - net);
    r.st_billsTag.className = `chip ${met ? 'chip--green' : 'chip--red'}`;
    r.st_billsBar.style.transform = `scaleX(${bills > 0 ? Math.min(1, Math.max(0, net / bills)) : 1})`;
    r.st_billsText.textContent = met ? s.billsMet : s.billsMissed;
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
