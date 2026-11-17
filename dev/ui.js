/**
 * Demonstração da interface com dados falsos (http://localhost:5173/dev/ui.html).
 * `window.__ui` expõe sim, phone, hud, screens e `parado` para inspecionar pelo console.
 */
import { config } from '../src/config.js';
import { copy } from '../src/ui/copy.js';
import * as fmt from '../src/ui/format.js';
import { createHud } from '../src/ui/hud.js';
import { createPhone } from '../src/ui/phone/phone.js';
import { projectToMinimap } from '../src/ui/phone/minimap.js';
import { createScreens } from '../src/ui/screens.js';

// ───────────── Checagens mínimas (falham no console se a lógica quebrar) ─────────────
const same = (a, b) => a.replace(/\s/g, ' ') === b;
console.assert(same(fmt.money(12.4), 'R$ 12,40'), 'money');
console.assert(fmt.clock(250) === '4:10' && fmt.clock(-12) === '-0:12' && fmt.clock(0.4) === '0:00', 'clock');
console.assert(fmt.km(2300) === '2,3 km' && fmt.distance(124) === '120 m' && fmt.distance(1400) === '1,4 km', 'distance');
console.assert(fmt.hours(6) === '6h00' && fmt.rating(4.8) === '4,80' && fmt.percent(0.86) === '86%', 'hours/rating/percent');
{
  // moto virada para leste: o que está à frente aparece acima; o que está à direita (sul, +z), à direita
  const bike = { x: 0, z: 0, heading: 0 };
  const ahead = projectToMinimap({ x: 10, z: 0 }, bike, 1, 100, 100);
  const right = projectToMinimap({ x: 0, z: 10 }, bike, 1, 100, 100);
  console.assert(Math.abs(ahead.x - 50) < 1e-6 && ahead.y < 68, 'minimapa: frente para cima');
  console.assert(right.x > 50 && Math.abs(right.y - 68) < 1e-6, 'minimapa: direita à direita');
}

// ───────────── Cidade falsa: 4×4 cruzamentos tortos, uma avenida e um rio ─────────────
function fakeCity() {
  const nodes = [];
  const edges = [];
  const wobble = (i, j) => ((i * 37 + j * 61) % 40) - 20;
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      nodes.push({ id: nodes.length, x: (i - 1.5) * 95 + wobble(i, j), z: (j - 1.5) * 95 + wobble(j, i), edges: [] });
    }
  }
  const link = (a, b, kind = 'rua') => {
    const dx = nodes[b].x - nodes[a].x;
    const dz = nodes[b].z - nodes[a].z;
    const length = Math.hypot(dx, dz);
    edges.push({ id: edges.length, a, b, length, dir: { x: dx / length, z: dz / length }, kind, halfWidth: kind === 'avenida' ? 7 : 3.6 });
  };
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) link(j * 4 + i, j * 4 + i + 1, j === 1 ? 'avenida' : 'rua');
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) if ((i + j) % 5 !== 4) link(j * 4 + i, (j + 1) * 4 + i);
  const pois = [
    { id: 0, type: 'restaurante', name: 'Sabor da Vila', x: nodes[6].x + 30, z: nodes[6].z },
    { id: 1, type: 'cliente', name: 'Rua das Acácias, 120', x: nodes[15].x - 20, z: nodes[15].z },
    { id: 2, type: 'restaurante', name: 'Pastelaria do Seu Juca Gourmet & Cia.', x: nodes[2].x, z: nodes[2].z },
    { id: 3, type: 'cliente', name: 'Av. Marginal, 2040, bloco B, apto. 71', x: nodes[12].x, z: nodes[12].z },
    { id: 4, type: 'restaurante', name: 'Temaki Já', x: nodes[9].x, z: nodes[9].z },
    { id: 5, type: 'cliente', name: 'Travessa do Sol, 8', x: nodes[3].x, z: nodes[3].z },
  ];
  return {
    size: 400,
    nodes,
    edges,
    river: { points: [{ x: -260, z: 150 }, { x: -60, z: 60 }, { x: 80, z: -40 }, { x: 260, z: -150 }], width: 46 },
    pois,
  };
}

const city = fakeCity();
const P = city.pois;
const N = city.nodes;
const routePoints = [N[0], N[1], N[5], N[6], P[0], N[7], N[11], N[15], P[1]].map(({ x, z }) => ({ x, z }));
const offer = (id, restaurant, customer, distance, pay, deadline, surge, expiresIn) => ({
  id, restaurant, customer, distance, pay, deadline, surge, expiresIn,
});
let nextOfferId = 10;
const seedOffers = () => [
  offer(nextOfferId++, P[0], P[1], 2300, 12.4, 250, 1.45, 11.2),
  offer(nextOfferId++, P[2], P[3], 4120, 9.8, 310, 0.9, 7.5),
  offer(nextOfferId++, P[4], P[5], 860, 5.9, 108, 1.1, 3.4),
];

const sim = {
  phase: 'turno',
  bike: { x: N[0].x, z: N[0].z, heading: 0, speed: 12 },
  city,
  jobs: { offers: seedOffers(), active: null },
  economy: { money: 84.2, rating: 4.8, acceptance: 0.86, day: { gross: 71.6, tips: 9.4, fuel: 6.35, rent: 40, fines: 0, deliveries: 7, late: 1 } },
  shift: { phase: 'turno', day: 2, timeLeft: 212, bills: 103.5 },
  nav: null,
};

const startJob = (o) => {
  sim.jobs.active = { offer: o, phase: 'coleta', timeLeft: o.deadline, route: { points: routePoints, length: o.distance }, target: o.restaurant };
  sim.nav = { turn: 'direita', distance: 180, street: 'Av. Brigadeiro Faria', remaining: o.distance };
};

const root = document.getElementById('ui');
const cena = document.getElementById('cena');
const hud = createHud(root);
const phone = createPhone(root, {
  onAccept: (id) => {
    const o = sim.jobs.offers.find((x) => x.id === id);
    if (o) startJob(o);
    sim.jobs.offers = sim.jobs.offers.filter((x) => x.id !== id);
  },
  onDecline: (id) => (sim.jobs.offers = sim.jobs.offers.filter((x) => x.id !== id)),
});
const screens = createScreens(root, {
  onStart: () => screens.hide(),
  onResume: () => screens.hide(),
  onNextDay: () => screens.hide(),
  onRestart: () => screens.hide(),
});

// ───────────── Animação falsa ─────────────
const ui = { sim, phone, hud, screens, parado: false };
window.__ui = ui;
let routeAt = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!ui.parado) {
    const a = routePoints[routeAt % routePoints.length];
    const b = routePoints[(routeAt + 1) % routePoints.length];
    const want = Math.atan2(b.z - a.z, b.x - a.x);
    const diff = Math.atan2(Math.sin(want - sim.bike.heading), Math.cos(want - sim.bike.heading));
    sim.bike.heading += diff * Math.min(1, dt * 4);
    sim.bike.speed = 9 + 8 * (0.5 + 0.5 * Math.sin(now / 1700));
    sim.bike.x += Math.cos(sim.bike.heading) * sim.bike.speed * dt;
    sim.bike.z += Math.sin(sim.bike.heading) * sim.bike.speed * dt;
    if (Math.hypot(b.x - sim.bike.x, b.z - sim.bike.z) < 8) routeAt++;
    sim.shift.timeLeft = Math.max(0, sim.shift.timeLeft - dt);
    for (const o of sim.jobs.offers) o.expiresIn -= dt;
    sim.jobs.offers = sim.jobs.offers.filter((o) => o.expiresIn > 0);
    if (sim.jobs.active) sim.jobs.active.timeLeft -= dt;
    if (sim.nav) {
      sim.nav.distance = sim.nav.distance > 0 ? sim.nav.distance - sim.bike.speed * dt : 220;
      sim.nav.remaining = Math.max(0, sim.nav.remaining - sim.bike.speed * dt);
    }
  }
  hud.update(sim);
  phone.update(sim);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('keydown', (event) => {
  if (event.code === 'Tab' || event.code === 'KeyE') {
    event.preventDefault();
    phone.toggle();
  }
});

// ───────────── Painel de botões ─────────────
const statement = { gross: 71.6, tips: 9.4, fuel: 6.35, rent: 40, fines: 60, net: -25.35, perHour: -4.23, hours: 6, deliveries: 7, late: 1 };
const goodStatement = { gross: 142.8, tips: 21.3, fuel: 9.1, rent: 40, fines: 0, net: 115, perHour: 19.17, hours: 6, deliveries: 12, late: 0 };
const stats = { days: 4, deliveries: 31, earned: 412.6, perHour: 8.87 };
const n = copy.notify;
const actions = {
  'celular': () => phone.toggle(),
  'aba ofertas': () => phone.showTab('ofertas'),
  'aba corrida': () => phone.showTab('corrida'),
  'aba carteira': () => phone.showTab('carteira'),
  'novas ofertas': () => (sim.jobs.offers = seedOffers()),
  'sem ofertas': () => (sim.jobs.offers = []),
  'corrida: coleta': () => startJob(offer(1, P[0], P[1], 2300, 12.4, 250, 1.45, 0)),
  'corrida: entrega': () => {
    if (!sim.jobs.active) actions['corrida: coleta']();
    Object.assign(sim.jobs.active, { phase: 'entrega', target: sim.jobs.active.offer.customer });
    sim.nav.turn = 'esquerda';
  },
  'prazo: apertado': () => sim.jobs.active && (sim.jobs.active.timeLeft = 60),
  'prazo: crítico': () => sim.jobs.active && (sim.jobs.active.timeLeft = 20),
  'prazo: atrasado': () => sim.jobs.active && (sim.jobs.active.timeLeft = -14),
  'sem corrida': () => ((sim.jobs.active = null), (sim.nav = null)),
  'curva →': () => {
    if (!sim.nav) return;
    const turns = ['esquerda', 'direita', 'reto', 'retorno', 'chegada'];
    sim.nav.turn = turns[(turns.indexOf(sim.nav.turn) + 1) % turns.length];
  },
  'carteira: ruim': () => {
    Object.assign(sim.economy, { rating: 4.31, acceptance: 0.4 });
    Object.assign(sim.economy.day, { fines: 90, gross: 22 });
  },
  'carteira: boa': () => {
    Object.assign(sim.economy, { rating: 4.96, acceptance: 0.95 });
    Object.assign(sim.economy.day, { fines: 0, gross: 162 });
  },
  'notif: multa': () => phone.notify(n.fineRedLight(config.rules.fineRedLight)),
  'notif: gorjeta': () => phone.notify(n.tip(3.7)),
  'notif: nota': () => phone.notify(n.ratingDown(4.62)),
  'notif: info': () => phone.notify(n.offerExpired()),
  'notif: pagamento': () => phone.notify(n.payment(12.4)),
  'flash: radar': () => hud.flash('radar'),
  'flash: batida': () => hud.flash('batida'),
  'hud on/off': () => hud.setVisible((ui.hudVisible = !ui.hudVisible)),
  'tela: menu': () => screens.show('menu'),
  'tela: pausa': () => screens.show('pausa'),
  'tela: extrato (ruim)': () => screens.show('extrato', { day: 2, statement, bills: 103.5, metBills: false }),
  'tela: extrato (bom)': () => screens.show('extrato', { day: 3, statement: goodStatement, bills: 103.5, metBills: true }),
  'fim: acidente': () => screens.show('fim', { reason: 'acidente', stats }),
  'fim: desativado': () => screens.show('fim', { reason: 'desativado', stats }),
  'fim: despejado': () => screens.show('fim', { reason: 'despejado', stats }),
  'fechar tela': () => screens.hide(),
  'fundo': () => (cena.dataset.bg = cena.dataset.bg === 'tarde' ? 'noite' : 'tarde'),
  'parar/andar': () => (ui.parado = !ui.parado),
};
ui.actions = actions;
ui.hudVisible = true;
const painel = document.getElementById('painel');
for (const [label, run] of Object.entries(actions)) {
  const button = document.createElement('button');
  button.textContent = label;
  button.addEventListener('click', run);
  painel.appendChild(button);
}
