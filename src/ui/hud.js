/**
 * HUD mínimo de pilotagem: velocímetro, cronômetro da entrega, próxima curva, dinheiro/nota/turno.
 * A rota completa só existe no celular; aqui é o que dá para ler num relance.
 */
import { config } from '../config.js';
import { copy } from './copy.js';
import * as fmt from './format.js';
import { mount, refs, setText, setKeyed, setAttr, replay } from './phone/dom.js';
import { icons } from './phone/icons.js';

const t = copy.hud;

// Arco de 270° do velocímetro (raio 52 num viewBox de 120)
const ARC_LENGTH = 2 * Math.PI * 52 * 0.75;
const CIRCLE_LENGTH = 2 * Math.PI * 52;
const GAUGE_MAX_KMH = Math.ceil((config.bike.maxSpeed * 3.6) / 10) * 10;
const FAST_KMH = 80; // a partir daqui a câmera treme; o arco fica coral

const template = `
<div class="ui hud" data-visible="true">
  <div class="hud__flash hud__flash--radar" data-ref="radar"></div>
  <div class="hud__flash hud__flash--batida" data-ref="batida"></div>

  <div class="hud__left">
    <div class="hud__plate hud__status">
      <span class="hud__stat" data-ref="shiftBox">${icons.clock}<b class="num" data-ref="shift">0:00</b></span>
      <span class="hud__stat hud__stat--money"><b class="num" data-ref="money"></b></span>
      <span class="hud__stat hud__stat--rating">${icons.star}<b class="num" data-ref="rating"></b></span>
    </div>

    <div class="hud__plate hud__job" data-ref="job" data-heat="ok" data-phase="coleta" hidden>
      <div class="hud__job-head">
        <span class="hud__job-phase" data-ref="jobPhase"></span>
        <span class="hud__job-dest" data-ref="jobDest"></span>
      </div>
      <div class="hud__job-main">
        <span class="hud__job-time num" data-ref="jobTime">0:00</span>
        <span class="hud__job-late" data-ref="jobLate" hidden>${t.late}</span>
        <span class="hud__job-pay num" data-ref="jobPay"></span>
      </div>
      <div class="bar"><i data-ref="jobBar"></i></div>
    </div>
  </div>

  <div class="hud__plate hud__nav" data-ref="nav" data-turn="reto" hidden>
    <div class="hud__nav-arrow">
      <span data-turn-icon="esquerda">${icons.turnLeft}</span>
      <span data-turn-icon="direita">${icons.turnRight}</span>
      <span data-turn-icon="reto">${icons.straight}</span>
      <span data-turn-icon="retorno">${icons.uturn}</span>
      <span data-turn-icon="chegada">${icons.arrive}</span>
    </div>
    <div class="hud__nav-text">
      <span class="hud__nav-distance num" data-ref="navDistance"></span>
      <span class="hud__nav-street" data-ref="navStreet"></span>
    </div>
  </div>

  <div class="hud__speed" data-ref="speedBox">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="hud__speed-track" cx="60" cy="60" r="52" stroke-dasharray="${ARC_LENGTH} ${CIRCLE_LENGTH}" />
      <circle class="hud__speed-arc" data-ref="arc" cx="60" cy="60" r="52" stroke-dasharray="0 ${CIRCLE_LENGTH}" />
    </svg>
    <span class="hud__speed-value num" data-ref="speed">0</span>
    <span class="hud__speed-unit">${t.speedUnit}</span>
  </div>
</div>`;

const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
const dashFor = (kmh) => `${(clamp01(kmh / GAUGE_MAX_KMH) * ARC_LENGTH).toFixed(1)} ${CIRCLE_LENGTH}`;
const moneyFromCents = (cents) => fmt.money(cents / 100);
const ratingFromHundredths = (v) => fmt.rating(v / 100);

export function createHud(root) {
  const node = mount(root, template);
  const r = refs(node);
  let lastKmh = -1;
  let lastJobPermille = -1;

  function updateSpeed(bike) {
    const kmh = fmt.kmh(bike?.speed);
    if (kmh === lastKmh) return;
    lastKmh = kmh;
    r.speed.textContent = kmh;
    r.arc.setAttribute('stroke-dasharray', dashFor(kmh));
    setAttr(r.speedBox, 'data-fast', kmh >= FAST_KMH);
  }

  function updateStatus(sim) {
    const timeLeft = sim.shift?.timeLeft ?? 0;
    setKeyed(r.shift, Math.ceil(timeLeft), fmt.clock);
    setAttr(r.shiftBox, 'data-ending', timeLeft <= 30 && sim.shift != null);
    setKeyed(r.money, Math.round((sim.economy?.money ?? 0) * 100), moneyFromCents);
    setKeyed(r.rating, Math.round((sim.economy?.rating ?? 0) * 100), ratingFromHundredths);
  }

  function updateJob(active) {
    setAttr(r.job, 'hidden', !active);
    if (!active) return;
    const timeLeft = active.timeLeft ?? 0;
    const share = timeLeft / (active.offer?.deadline || 1);
    const heat = timeLeft < 0 ? 'late' : share < 0.15 ? 'hot' : share < 0.35 ? 'warm' : 'ok';
    setAttr(r.job, 'data-heat', heat);
    setAttr(r.job, 'data-phase', active.phase);
    setText(r.jobPhase, t.phase[active.phase] ?? '');
    setText(r.jobDest, active.target?.name ?? '');
    setKeyed(r.jobTime, timeLeft < 0 ? Math.floor(timeLeft) : Math.ceil(timeLeft), fmt.clock);
    setAttr(r.jobLate, 'hidden', timeLeft >= 0);
    setKeyed(r.jobPay, Math.round((active.offer?.pay ?? 0) * 100), moneyFromCents);
    const permille = Math.round(clamp01(share) * 1000);
    if (permille !== lastJobPermille) {
      lastJobPermille = permille;
      r.jobBar.style.transform = `scaleX(${permille / 1000})`;
    }
  }

  function updateNav(nav) {
    setAttr(r.nav, 'hidden', !nav);
    if (!nav) return;
    const distance = nav.distance ?? 0;
    setAttr(r.nav, 'data-turn', nav.turn in t.turn ? nav.turn : 'reto');
    setAttr(r.nav, 'data-near', distance < 40);
    setKeyed(r.navDistance, distance < 20 ? Math.round(distance) : Math.round(distance / 10) * 10, fmt.distance);
    setText(r.navStreet, nav.turn === 'chegada' ? t.arriving : nav.street || t.turn[nav.turn] || '');
  }

  return {
    update(sim) {
      if (!sim) return;
      updateSpeed(sim.bike);
      updateStatus(sim);
      updateJob(sim.jobs?.active ?? null);
      updateNav(sim.nav ?? null);
    },
    setVisible(visible) {
      setAttr(node, 'data-visible', String(!!visible));
    },
    /** 'radar' = clarão branco duplo de radar de multa; 'batida' = vinheta vermelha. */
    flash(kind) {
      const overlay = r[kind];
      if (overlay?.classList.contains('hud__flash')) replay(overlay, 'is-on');
    },
  };
}
