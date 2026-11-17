/**
 * Celular do Rapidão: sobe do canto inferior direito e tapa parte da visão de propósito.
 * Só lê `sim`; aceitar/recusar saem pelos callbacks injetados.
 */
import { config } from '../../config.js';
import { copy } from '../copy.js';
import * as fmt from '../format.js';
import { mount, refs, setText, setKeyed, setAttr, setStyle, replay } from './dom.js';
import { icons } from './icons.js';
import { drawMinimap } from './minimap.js';

const TABS = ['ofertas', 'corrida', 'carteira'];
const NOTIFY_MS = 4500;
const NOTIFY_MAX = 3;
const SHIFT_START_MIN = 17 * 60; // o turno começa às 17h
const NOTIFY_ICON = { multa: icons.fine, gorjeta: icons.tip, nota: icons.star, pagamento: icons.cash, info: icons.info };

const t = copy.phone;
const wordmark = `<span class="wordmark">${icons.bolt}<span class="wordmark__text"><i>rapi</i>dão</span></span>`;

const template = `
<div class="ui phone" data-open="false" data-tab="ofertas">
  <div class="phone__toasts light" data-ref="toasts" aria-live="polite"></div>

  <button class="phone__handle light" data-ref="handle" type="button" aria-label="${t.closed.open} ${copy.brand.name}">
    ${wordmark}
    <span class="phone__handle-badge num" data-ref="handleBadge" hidden></span>
    <span class="phone__handle-key"><span class="kbd">${t.closed.key}</span></span>
  </button>

  <div class="phone__closehint"><span class="kbd">${t.closed.key}</span>${t.closed.close}</div>

  <div class="phone__device" data-ref="device">
    <div class="phone__screen light">
      <div class="phone__status">
        <span class="phone__status-shift num"><span data-ref="shift">17:00</span></span>
        <span class="phone__island"></span>
        <span class="phone__status-icons">${icons.signal}${icons.battery}</span>
      </div>

      <header class="phone__appbar">
        ${wordmark}
        <span class="phone__online"><i></i>${t.online}</span>
        <span class="phone__rating num">${icons.star}<span data-ref="rating">–</span></span>
      </header>

      <div class="phone__pushes" data-ref="pushes" aria-live="polite"></div>

      <main class="phone__views">
        <section class="view view--ofertas" data-view="ofertas">
          <p class="offers__busy" data-ref="busy" hidden>${t.offers.busy}</p>
          <div class="offers" data-ref="offers"></div>
          <div class="empty" data-ref="offersEmpty" hidden>
            <span class="empty__radar"><i></i><i></i>${icons.offers}</span>
            <strong>${t.offers.emptyTitle}</strong>
            <span>${t.offers.emptyText}</span>
          </div>
        </section>

        <section class="view view--corrida" data-view="corrida">
          <div class="ride__map">
            <canvas data-ref="map"></canvas>
            <span class="ride__chip" data-ref="ridePhase" hidden></span>
          </div>
          <div class="ride__panel" data-ref="ridePanel" data-heat="ok" hidden>
            <div class="ride__steps" data-ref="rideSteps" data-phase="coleta">
              <span class="ride__step ride__step--coleta"><i>${icons.check}</i>${t.ride.stepColeta}</span>
              <span class="ride__steps-line"></span>
              <span class="ride__step ride__step--entrega"><i></i>${t.ride.stepEntrega}</span>
            </div>
            <div class="ride__timer">
              <div>
                <span class="label" data-ref="rideTimerLabel">${t.ride.timeLeft}</span>
                <span class="ride__time num" data-ref="rideTime">0:00</span>
              </div>
              <div class="ride__pay">
                <span class="label">${t.ride.pay}</span>
                <span class="ride__pay-value num" data-ref="ridePay"></span>
              </div>
            </div>
            <div class="bar ride__bar"><i data-ref="rideBar"></i></div>
            <div class="ride__dest">
              <span class="ride__dest-icon" data-ref="rideDestIcon"></span>
              <div class="ride__dest-name">
                <span class="label" data-ref="rideDestLabel"></span>
                <strong data-ref="rideDest"></strong>
              </div>
              <div class="ride__remaining" data-ref="rideRemainingBox">
                <span class="label">${t.ride.remaining}</span>
                <strong class="num" data-ref="rideRemaining"></strong>
              </div>
            </div>
            <p class="ride__hint" data-ref="rideHint"></p>
          </div>
          <div class="empty empty--compact" data-ref="rideEmpty">
            <strong>${t.ride.emptyTitle}</strong>
            <span>${t.ride.emptyText}</span>
            <button class="btn btn--dark" data-ref="rideEmptyAction" type="button">${t.ride.emptyAction}</button>
          </div>
        </section>

        <section class="view view--carteira" data-view="carteira">
          <div class="wallet__hero" data-ref="walletHero">
            <span class="label">${t.wallet.netLabel}</span>
            <span class="wallet__net num" data-ref="walletNet"></span>
            <span class="wallet__chips">
              <span class="chip num" data-ref="walletDeliveries"></span>
              <span class="chip chip--warn num" data-ref="walletLate" hidden></span>
            </span>
          </div>

          <dl class="wallet__rows">
            ${['gross', 'tips', 'fuel', 'rent', 'fines']
              .map(
                (key) => `
            <div class="wallet__row" data-sign="${key === 'gross' || key === 'tips' ? 'plus' : 'minus'}">
              <dt>${t.wallet.rows[key]}</dt><dd class="num" data-ref="wallet_${key}"></dd>
            </div>`,
              )
              .join('')}
          </dl>

          <div class="wallet__card" data-ref="bills">
            <div class="wallet__card-head">
              <span class="label">${t.wallet.billsTitle}</span>
              <span class="wallet__card-value num" data-ref="billsValue"></span>
            </div>
            <div class="bar"><i data-ref="billsBar"></i></div>
            <span class="wallet__note" data-ref="billsNote"></span>
          </div>

          <div class="wallet__card wallet__rep">
            <div class="wallet__rep-col" data-ref="ratingBox">
              <span class="label">${t.wallet.ratingLabel}</span>
              <span class="wallet__rep-value num" data-ref="walletRating"></span>
              <span class="stars" aria-hidden="true">
                <span class="stars__row">${icons.star.repeat(5)}</span>
                <span class="stars__row stars__row--fill" data-ref="stars">${icons.star.repeat(5)}</span>
              </span>
            </div>
            <div class="wallet__rep-col" data-ref="acceptBox">
              <span class="label">${t.wallet.acceptance}</span>
              <span class="wallet__rep-value num" data-ref="walletAccept"></span>
              <div class="bar"><i data-ref="acceptBar"></i></div>
            </div>
            <span class="wallet__note" data-ref="ratingNote"></span>
          </div>
        </section>
      </main>

      <nav class="phone__tabs">
        ${TABS.map(
          (name) => `
        <button class="phone__tab" type="button" data-tab-button="${name}">
          <span class="phone__tab-icon">${icons[{ ofertas: 'offers', corrida: 'ride', carteira: 'wallet' }[name]]}<i class="phone__tab-dot" data-ref="dot_${name}" hidden></i></span>
          ${t.tabs[name]}
        </button>`,
        ).join('')}
      </nav>
    </div>
  </div>
</div>`;

const offerTemplate = (index) => `
<article class="offer" hidden>
  <div class="offer__route">
    <div class="offer__from">
      <strong data-ref="restaurant"></strong>
      <span class="offer__surge" data-ref="surge" hidden>${t.offers.surge}</span>
    </div>
    <div class="offer__to">${icons.home}<span data-ref="customer"></span></div>
  </div>
  <div class="offer__mid">
    <span class="offer__pay num" data-ref="pay"></span>
    <span class="offer__stat"><b class="num" data-ref="distance"></b></span>
    <span class="offer__stat">${icons.clock}<b class="num" data-ref="deadline"></b></span>
  </div>
  <div class="offer__actions">
    <button class="btn btn--ghost" data-ref="decline" type="button">${t.offers.decline}</button>
    <button class="btn btn--dark" data-ref="accept" type="button">${t.offers.accept}<span class="kbd">${index + 1}</span></button>
  </div>
  <span class="offer__expires num" data-ref="expires"></span>
  <div class="offer__bar"><i data-ref="bar"></i></div>
</article>`;

const notifyTemplate = `
<div class="push">
  <span class="push__icon" data-ref="icon"></span>
  <div class="push__body"><strong data-ref="title"></strong><span data-ref="text"></span></div>
</div>`;

const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
const scaleX = (permille) => `scaleX(${permille / 1000})`;
const setBar = (node, fraction) => {
  const permille = Math.round(clamp01(fraction) * 1000);
  if (node.__permille !== permille) {
    node.__permille = permille;
    node.style.transform = scaleX(permille);
  }
};
const setHidden = (node, hidden) => setAttr(node, 'hidden', hidden);

export function createPhone(root, { onAccept = () => {}, onDecline = () => {} } = {}) {
  const node = mount(root, template);
  const r = refs(node);
  const cards = Array.from({ length: config.jobs.offerCount }, (_, i) => {
    const card = mount(r.offers, offerTemplate(i));
    const cr = refs(card);
    cr.accept.addEventListener('click', () => card.__offerId != null && onAccept(card.__offerId));
    cr.decline.addEventListener('click', () => card.__offerId != null && onDecline(card.__offerId));
    return { card, r: cr };
  });

  let open = false;
  let tab = 'ofertas';
  let lastSim = null;
  let lastActiveKey = null;
  const seenOffers = new Set(); // ofertas que o jogador já viu com o celular aberto na aba Ofertas

  function showTab(name) {
    if (!TABS.includes(name) || name === tab) return;
    tab = name;
    node.dataset.tab = name;
  }

  function setOpen(value) {
    if (open === value) return;
    open = value;
    node.dataset.open = String(open);
    setAttr(r.handle, 'aria-label', `${open ? t.closed.close : t.closed.open} ${copy.brand.name}`);
  }

  // ───────────── Ofertas ─────────────
  function updateOffers(offers, busy) {
    setHidden(r.busy, !busy || offers.length === 0);
    setHidden(r.offersEmpty, offers.length > 0);
    for (let i = 0; i < cards.length; i++) {
      const { card, r: c } = cards[i];
      const offer = offers[i];
      setHidden(card, !offer);
      if (!offer) {
        card.__offerId = null;
        continue;
      }
      if (card.__offerId !== offer.id) {
        card.__offerId = offer.id;
        replay(card, 'is-new');
      }
      seenOffers.add(offer.id);
      setText(c.restaurant, offer.restaurant?.name ?? '—');
      setText(c.customer, offer.customer?.name ?? '—');
      setKeyed(c.pay, Math.round((offer.pay || 0) * 100), (cents) => fmt.money(cents / 100));
      setKeyed(c.distance, Math.round((offer.distance || 0) / 100), (hm) => fmt.km(hm * 100));
      setKeyed(c.deadline, Math.round(offer.deadline || 0), fmt.clock);
      setHidden(c.surge, !(offer.surge > config.jobs.surgeBadge));
      setAttr(card, 'data-surge', offer.surge > config.jobs.surgeBadge);
      const seconds = Math.max(0, Math.ceil(offer.expiresIn ?? 0));
      setKeyed(c.expires, seconds, t.offers.expires);
      setAttr(card, 'data-urgent', seconds <= 4);
      setBar(c.bar, (offer.expiresIn ?? 0) / config.jobs.offerLifetime);
      setAttr(c.accept, 'disabled', busy);
    }
  }

  // ───────────── Corrida ─────────────
  function updateRide(sim, active) {
    drawMinimap(r.map, { city: sim.city, bike: sim.bike, route: active?.route, target: active?.target });
    setHidden(r.ridePanel, !active);
    setHidden(r.rideEmpty, !!active);
    setHidden(r.ridePhase, !active);
    if (!active) return;
    const remaining = sim.nav?.remaining ?? active.route?.length;
    setHidden(r.rideRemainingBox, remaining == null);

    const pickup = active.phase === 'coleta';
    const timeLeft = active.timeLeft ?? 0;
    const deadline = active.offer?.deadline || 1;
    const share = timeLeft / deadline;
    const heat = timeLeft < 0 ? 'late' : share < 0.15 ? 'hot' : share < 0.35 ? 'warm' : 'ok';

    setText(r.ridePhase, pickup ? t.ride.phaseColeta : t.ride.phaseEntrega);
    setAttr(r.ridePhase, 'data-phase', active.phase);
    setAttr(r.rideSteps, 'data-phase', active.phase);
    setAttr(r.ridePanel, 'data-heat', heat);
    setText(r.rideTimerLabel, timeLeft < 0 ? t.ride.late : t.ride.timeLeft);
    setKeyed(r.rideTime, timeLeft < 0 ? Math.floor(timeLeft) : Math.ceil(timeLeft), fmt.clock);
    setBar(r.rideBar, share);
    setKeyed(r.ridePay, Math.round((active.offer?.pay || 0) * 100), (cents) => fmt.money(cents / 100));
    setText(r.rideDestLabel, pickup ? t.ride.pickupAt : t.ride.deliverTo);
    setText(r.rideDest, active.target?.name ?? '—');
    if (r.rideDestIcon.__phase !== active.phase) {
      r.rideDestIcon.__phase = active.phase;
      r.rideDestIcon.innerHTML = pickup ? icons.store : icons.home;
    }
    setText(r.rideHint, timeLeft < 0 ? t.ride.cancelHint : t.ride.lateHint);
    if (remaining != null) setKeyed(r.rideRemaining, Math.round(remaining / 10), (dam) => fmt.distance(dam * 10));
  }

  // ───────────── Carteira ─────────────
  function updateWallet(sim) {
    const economy = sim.economy ?? {};
    const day = economy.day ?? {};
    const cents = (v) => Math.round((v || 0) * 100);
    const net = (day.gross || 0) + (day.tips || 0) - (day.fuel || 0) - (day.rent || 0) - (day.fines || 0);
    const bills = sim.shift?.bills ?? 0;
    const minRating = config.economy.minRating;
    const ratingValue = economy.rating ?? config.economy.startRating;
    const acceptance = economy.acceptance ?? 1;

    setKeyed(r.walletNet, cents(net), (c) => fmt.money(c / 100));
    setAttr(r.walletHero, 'data-negative', net < 0);
    setKeyed(r.walletDeliveries, day.deliveries || 0, t.wallet.deliveries);
    setHidden(r.walletLate, !(day.late > 0));
    setKeyed(r.walletLate, day.late || 0, t.wallet.late);

    setKeyed(r.wallet_gross, cents(day.gross), (c) => fmt.signedMoney(c / 100, 1));
    setKeyed(r.wallet_tips, cents(day.tips), (c) => fmt.signedMoney(c / 100, 1));
    setKeyed(r.wallet_fuel, cents(day.fuel), (c) => fmt.signedMoney(c / 100, -1));
    setKeyed(r.wallet_rent, cents(day.rent), (c) => fmt.signedMoney(c / 100, -1));
    setKeyed(r.wallet_fines, cents(day.fines), (c) => fmt.signedMoney(c / 100, -1));
    setAttr(r.wallet_fines.parentElement, 'data-alert', day.fines > 0);

    const met = bills > 0 && net >= bills;
    setKeyed(r.billsValue, cents(bills), (c) => fmt.money(c / 100));
    setBar(r.billsBar, bills > 0 ? net / bills : 0);
    setAttr(r.bills, 'data-met', met);
    if (met) setText(r.billsNote, t.wallet.billsMet);
    else setKeyed(r.billsNote, cents(bills - net), (c) => t.wallet.billsLeft(c / 100));

    const atRisk = ratingValue < minRating + 0.2;
    const lowAcceptance = acceptance < config.economy.acceptanceFloor;
    setKeyed(r.walletRating, Math.round(ratingValue * 100), (v) => fmt.rating(v / 100));
    setStyle(r.stars, 'width', `${Math.round(clamp01(ratingValue / config.economy.maxRating) * 1000) / 10}%`);
    setAttr(r.ratingBox, 'data-alert', atRisk);
    setKeyed(r.walletAccept, Math.round(acceptance * 100), (v) => fmt.percent(v / 100));
    setBar(r.acceptBar, acceptance);
    setAttr(r.acceptBox, 'data-alert', lowAcceptance);
    if (atRisk) setText(r.ratingNote, t.wallet.ratingRisk);
    else if (lowAcceptance) setText(r.ratingNote, t.wallet.acceptanceLow);
    else setKeyed(r.ratingNote, minRating, t.wallet.ratingMin);
    setAttr(r.ratingNote, 'data-alert', atRisk || lowAcceptance);
  }

  function update(sim) {
    if (!sim) return;
    lastSim = sim;
    const offers = sim.jobs?.offers ?? [];
    const active = sim.jobs?.active ?? null;

    // Aceitou uma corrida → mostra o GPS; terminou → volta para as ofertas.
    const activeKey = active ? (active.offer?.id ?? true) : null;
    if (activeKey !== lastActiveKey) {
      lastActiveKey = activeKey;
      if (active) showTab('corrida');
      else if (tab === 'corrida') showTab('ofertas');
    }

    let unseen = 0;
    if (!active) for (let i = 0; i < offers.length; i++) if (!seenOffers.has(offers[i].id)) unseen++;
    setHidden(r.handleBadge, unseen === 0 || open);
    setKeyed(r.handleBadge, unseen, String);
    setAttr(r.handle, 'title', unseen > 0 ? t.newOffers(unseen) : null);
    setHidden(r.dot_ofertas, unseen === 0 || tab === 'ofertas');
    setHidden(r.dot_corrida, !active || tab === 'corrida');

    if (!open) return;
    // o relógio do celular mostra a hora do dia: o turno vai das 17h até quase 21h
    const worked = 1 - (sim.shift?.timeLeft ?? 0) / config.shift.duration;
    setKeyed(r.shift, Math.floor(SHIFT_START_MIN + worked * config.economy.shiftHours * 60), fmt.timeOfDay);
    setKeyed(r.rating, Math.round((sim.economy?.rating ?? 0) * 100), (v) => fmt.rating(v / 100));
    if (tab === 'ofertas') updateOffers(offers, !!active);
    else if (tab === 'corrida') updateRide(sim, active);
    else updateWallet(sim);
  }

  function notify({ kind = 'info', title = '', text = '' } = {}) {
    const host = open ? r.pushes : r.toasts;
    const push = mount(host, notifyTemplate);
    const pr = refs(push);
    push.dataset.kind = kind in NOTIFY_ICON ? kind : 'info';
    pr.icon.innerHTML = NOTIFY_ICON[push.dataset.kind];
    pr.title.textContent = title;
    pr.text.textContent = text;
    while (host.children.length > NOTIFY_MAX) host.firstElementChild.remove();
    setTimeout(() => {
      push.classList.add('is-leaving');
      setTimeout(() => push.remove(), 320);
    }, NOTIFY_MS);
  }

  // ───────────── Entrada ─────────────
  r.handle.addEventListener('click', () => setOpen(!open));
  r.rideEmptyAction.addEventListener('click', () => showTab('ofertas'));
  for (const button of node.querySelectorAll('[data-tab-button]')) {
    button.addEventListener('click', () => showTab(button.dataset.tabButton));
  }

  // 1/2/3 aceitam a oferta e Q troca de aba, só com o celular na mão. Tab/E ficam com quem chama toggle().
  addEventListener('keydown', (event) => {
    if (!open || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'KeyQ') {
      showTab(TABS[(TABS.indexOf(tab) + 1) % TABS.length]);
      return;
    }
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    if (!digit || tab !== 'ofertas' || lastSim?.jobs?.active) return;
    const offer = lastSim?.jobs?.offers?.[Number(digit[1]) - 1];
    if (offer) onAccept(offer.id);
  });

  return {
    get isOpen() {
      return open;
    },
    get tab() {
      return tab;
    },
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    showTab,
    update,
    notify,
  };
}
