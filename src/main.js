/**
 * Composição: o único arquivo que conhece todos os módulos.
 * Cria a simulação, as visões e a interface, e liga tudo pelo barramento de eventos.
 */
import { config } from './config.js';
import { createEvents } from './core/events.js';
import { createRng } from './core/rng.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { generateCity } from './sim/city/generator.js';
import { createGraph } from './sim/city/graph.js';
import { createScene } from './render/scene.js';
import { createAssets } from './render/assets.js';
import { createCityView } from './render/cityView.js';
import { createAerialCamera, createChaseCamera } from './render/camera.js';
import { createBikeView } from './render/bikeView.js';
import { createBike } from './sim/bike.js';
import { createAutopilot } from './sim/autopilot.js';
import { createEconomy } from './sim/economy.js';
import { createJobs } from './sim/jobs.js';
import { createSignals } from './sim/signals.js';
import { createTraffic } from './sim/traffic.js';
import { createRules } from './sim/rules.js';
import { createTrafficView, createSignalsView } from './render/trafficView.js';
import { nextManeuver } from './sim/navigation.js';
import { createMarkersView } from './render/markersView.js';
import { createPhone } from './ui/phone/phone.js';
import { copy } from './ui/copy.js';
import { createHud } from './ui/hud.js';
import { createWarning } from './ui/warning.js';
import { createTutorial } from './ui/tutorial.js';
import { distance as meters } from './ui/format.js';
import { createScreens } from './ui/screens.js';

const canvas = document.getElementById('jogo');
const params = new URLSearchParams(location.search);
const debugMap = params.get('debug') === 'mapa';

const events = createEvents();
const rng = createRng(config.seed);
const input = createInput();

const city = generateCity(config.city, rng.fork('cidade'));
const graph = createGraph(city);
const home = city.pois[city.homeId];
const homeDir = city.edges[home.edge].dir;
const spawn = { ...graph.pointOnEdge(home.edge, home.t, home.side * config.city.street.laneWidth * 0.5), heading: Math.atan2(homeDir.z, homeDir.x) };
const bike = createBike(config.bike, { city, graph }, spawn);
const economy = createEconomy(config.economy, events);
const jobs = createJobs({ city, graph, rng: rng.fork('ofertas'), events, economy, config: config.jobs });
const signals = createSignals(city, config.signals);
const traffic = createTraffic({ city, graph, signals, rng: rng.fork('trânsito'), config: config.traffic });
const rules = createRules({ city, signals, traffic, bike, economy, events, rng: rng.fork('radares'), config: config.rules });
const pilot = createAutopilot({ city, graph, bike, config: config.autopilot });
const sim = { time: 0, phase: 'menu', city, graph, bike, pilot, economy, jobs, signals, traffic, rules, nav: null, autopilot: false };

/** Com o piloto ligado, ele vai sozinho ao destino da corrida ativa (restaurante, depois cliente). */
let pilotTarget = null;
function pilotInput(dt) {
  const target = jobs.active?.target ?? null;
  if (target !== pilotTarget) {
    pilotTarget = target;
    if (target) pilot.goTo(target);
    else pilot.stop();
  }
  return pilot.step(dt);
}

const stage = createScene(canvas);
const assets = createAssets();
const cityView = createCityView({ city, config: config.city, scene: stage.scene, assets });
const trafficView = createTrafficView({ scene: stage.scene, assets, traffic, fleet: config.traffic.fleet });
const signalsView = createSignalsView({ scene: stage.scene, city, signals, cameras: rules.cameras });
const aerial = createAerialCamera({
  size: city.size,
  focus: { x: config.city.centro.x * city.size, z: config.city.centro.z * city.size },
  canvas,
  interactive: debugMap,
  pose: debugPose(params.get('cam')),
});
const bikeView = createBikeView({ scene: stage.scene, bike });
const chase = createChaseCamera({ bike, maxSpeed: config.bike.maxSpeed });
stage.onResize(chase.resize);

const ui = document.getElementById('ui');
const hud = createHud(ui);
const warning = createWarning(ui);
const tutorial = createTutorial(ui);
const markers = createMarkersView({ scene: stage.scene });
const phone = createPhone(ui, { onAccept: (id) => jobs.accept(id, bike), onDecline: (id) => jobs.decline(id) });
events.on('job:pickup', ({ job }) => phone.notify(copy.notify.pickup(job.offer.customer.name)));
events.on('job:delivered', ({ pay, tip, lateBy }) => {
  phone.notify(copy.notify.payment(pay));
  if (tip > 0) phone.notify(copy.notify.tip(tip));
  if (lateBy > 0) phone.notify(copy.notify.late(Math.round(lateBy)));
});
events.on('job:cancelled', () => phone.notify(copy.notify.cancelled()));
events.on('offer:expired', () => phone.notify(copy.notify.offerExpired()));
const fineNotice = { sinal: copy.notify.fineRedLight, contramao: copy.notify.fineWrongWay, calcada: copy.notify.fineSidewalk };
events.on('fine', ({ kind, amount }) => phone.notify(fineNotice[kind](amount)));
events.on('crash', ({ relSpeed }) => {
  sim.phase = 'acidente'; // a simulação para; o efeito roda e só depois vem a tela
  bikeView.crash(relSpeed);
  warning.show('');
  phone.close();
  hud.flash('batida');
  setTimeout(showAccident, config.rules.crashScreenDelay * 1000);
});
function showAccident() {
  sim.phase = 'fim';
  hud.setVisible(false);
  const { perHour } = economy.statement();
  const stats = { days: economy.career.days + 1, deliveries: economy.career.deliveries + economy.day.deliveries, earned: economy.money, perHour };
  screens.show('fim', { reason: 'acidente', stats });
}
const screens = createScreens(ui, { onStart: firstShift, onResume: resume, onNextDay: startShift, onRestart: () => location.reload() });
hud.setVisible(false);
if (!debugMap) screens.show('menu');

/** Primeiro turno: passa pelas instruções (a não ser que o jogador já as tenha dispensado). */
function firstShift() {
  screens.hide();
  tutorial.show(startShift);
}
function startShift() {
  sim.phase = 'turno';
  economy.startDay();
  screens.hide();
  hud.setVisible(true);
  phone.open();
}
function resume() {
  screens.hide();
  loop.timeScale = 1;
}
input.onAction((action) => {
  if (sim.phase !== 'turno') return;
  if (action === 'phone') return phone.toggle();
  if (action !== 'pause') return;
  if (screens.current === 'pausa') return resume();
  loop.timeScale = 0;
  screens.show('pausa');
});
events.on('bump', () => hud.flash('batida'));
events.on('fine', () => hud.flash('radar'));
events.on('damage', ({ amount }) => phone.notify(copy.notify.repair(amount)));

/** Aviso do alto da tela: contador da calçada tem prioridade sobre o radar à frente. */
function updateWarning() {
  if (rules.sidewalkLeft !== null) {
    return warning.show(`Você está na calçada: infração de trânsito. Multa em ${rules.sidewalkLeft.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`);
  }
  const camera = rules.cameraAhead();
  warning.show(camera ? `Radar de sinal vermelho em ${meters(camera.distance)}` : '', 'radar');
}

stage.setFog(!debugMap);
stage.onResize(aerial.resize);
stage.resize();

/** `?debug=mapa&cam=x,z,distância,inclinação,giro` fixa a vista aérea (ângulos em graus). */
function debugPose(text) {
  if (!text) return undefined;
  const [x, z, distance, tilt = 0, turn = 0] = text.split(',').map(Number);
  const radians = (degrees) => (Math.max(degrees, 0.03) * Math.PI) / 180;
  return { x, z, distance, tilt: radians(tilt), turn: (turn * Math.PI) / 180 };
}

const loop = createLoop({
  step(dt) {
    sim.time += dt;
    if (sim.phase !== 'turno') return;
    const before = bike.distance;
    sim.nav = nextManeuver(jobs.active?.route, city);
    bike.step(sim.autopilot ? pilotInput(dt) : pilot.active ? pilot.step(dt) : input.state, dt);
    economy.chargeFuel(bike.distance - before);
    economy.tick(dt);
    jobs.step(dt, bike);
    signals.step(dt);
    traffic.step(dt, bike);
    rules.step(dt);
  },
  render(alpha, frameDt) {
    const riding = (sim.phase === 'turno' || sim.phase === 'acidente') && !debugMap;
    const view = riding ? chase : aerial;
    view.update(frameDt);
    bikeView.update(frameDt);
    trafficView.update();
    signalsView.update();
    markers.update(jobs.active?.target, sim.time);
    if (sim.phase === 'turno' && !debugMap) {
      hud.update(sim);
      updateWarning();
      phone.update(sim);
    }
    stage.render(view.camera);
  },
});
loop.start();

/** Porta de verificação: permite exercitar o jogo sem um humano pilotando. */
window.__game = {
  sim,
  config,
  events,
  rng,
  input,
  loop,
  view: { stage, cityView, aerial, chase, bikeView },
  start: startShift,
  phone,
  /** Liga ou desliga o piloto automático: ligado, ele faz sozinho a corrida ativa. */
  autopilot(on) {
    sim.autopilot = on;
    pilotTarget = null;
    if (!on) pilot.stop();
  },
  acceptOffer: (i) => jobs.accept(jobs.offers[i]?.id, bike),
  /** Põe a moto no cruzamento `nodeId`, parada. */
  teleport(nodeId) {
    const node = city.nodes[nodeId];
    bike.reset({ x: node.x, z: node.z, heading: bike.heading });
    chase.snap();
  },
  state: () => ({
    time: sim.time,
    phase: sim.phase,
    bike: { x: bike.x, z: bike.z, heading: bike.heading, kmh: bike.speed * 3.6, road: bike.road?.edge },
    autopilot: { active: pilot.active, arrived: pilot.arrived },
    money: economy.money,
    offers: jobs.offers.length,
    job: jobs.active && { phase: jobs.active.phase, timeLeft: jobs.active.timeLeft, pay: jobs.active.offer.pay, remaining: jobs.active.route?.length },
    deliveries: economy.day.deliveries,
    traffic: traffic.vehicles.filter((v) => v.active).length,
    rating: economy.rating,
    city: { nodes: city.nodes.length, edges: city.edges.length, pois: city.pois.length, lots: city.lots.length },
    view: { buildingsLoaded: cityView.loaded, drawCalls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles },
  }),
  setTimeScale: (n) => (loop.timeScale = n),
  /** Piloto automático até o POI `poiId`. Devolve false se não há rota. */
  goTo: (poiId) => pilot.goTo({ edge: city.pois[poiId].edge, t: city.pois[poiId].t }),
};
