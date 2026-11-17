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
import { createJobs, bestPerMeter } from './sim/jobs.js';
import { createSignals } from './sim/signals.js';
import { createTraffic } from './sim/traffic.js';
import { createRules } from './sim/rules.js';
import { createShift } from './sim/shift.js';
import { createTrafficView, createSignalsView } from './render/trafficView.js';
import { nextManeuver } from './sim/navigation.js';
import { createMarkersView } from './render/markersView.js';
import { createPhone } from './ui/phone/phone.js';
import { copy } from './ui/copy.js';
import { createHud } from './ui/hud.js';
import { createWarning } from './ui/warning.js';
import { createTutorial } from './ui/tutorial.js';
import { createScreens } from './ui/screens.js';
import { createEffects } from './render/effects.js';
import { createAudio } from './audio/audio.js';

const canvas = document.getElementById('jogo');
const params = new URLSearchParams(location.search);
const debugMap = params.get('debug') === 'mapa';
// Modo robô, só para testes: `?bot=cauteloso|apressado|kamikaze` joga sozinho, dia após dia; `&vel=3` acelera o tempo.
const botProfile = config.autopilot.profiles[params.get('bot')] ? params.get('bot') : null;

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
const pilotConfig = { ...config.autopilot, ...(botProfile ? config.autopilot.profiles[botProfile] : {}) };
const pilot = createAutopilot({ city, graph, bike, config: pilotConfig, traffic, signals, cameras: rules.cameras });
const shift = createShift({ economy, jobs, events, config: config.shift });
const sim = { time: 0, phase: 'menu', city, graph, bike, pilot, economy, jobs, signals, traffic, rules, shift, nav: null, autopilot: !!botProfile };

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
const effects = createEffects({ scene: stage.scene, bike });
const audio = createAudio();
for (const type of ['pointerdown', 'keydown']) addEventListener(type, audio.unlock);
events.on('offer:new', () => sim.phase === 'turno' && audio.play('offer'));
events.on('job:pickup', () => audio.play('notify'));
events.on('job:delivered', () => audio.play('money'));
events.on('job:cancelled', () => audio.play('cancel'));
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
  chase.shake(1);
  effects.sparks();
  audio.play('crash');
  warning.show(null);
  phone.close();
  hud.flash('batida');
  setTimeout(() => shift.gameOver('acidente'), config.rules.crashScreenDelay * 1000);
});

/** Sai da rua: some o HUD, o celular e os avisos, e entra uma tela cheia. */
function leaveStreet(phase, screen, data) {
  sim.phase = phase;
  hud.setVisible(false);
  warning.show(null);
  phone.close();
  screens.show(screen, data);
}
events.on('shift:end', (data) => leaveStreet('extrato', 'extrato', data));
events.on('game:over', (data) => leaveStreet('fim', 'fim', data));
events.on('shift:start', () => {
  sim.phase = 'turno';
  bike.reset(spawn); // todo dia começa na porta de casa
  chase.snap();
  screens.hide();
  hud.setVisible(true);
  phone.open();
});

const screens = createScreens(ui, { onStart: firstShift, onResume: resume, onNextDay: () => shift.nextDay(), onRestart: () => location.reload() });
hud.setVisible(false);
if (botProfile) startBot();
else if (!debugMap) screens.show('menu');

/** Modo robô: começa direto, passa de dia sozinho e recomeça quando o jogo acaba. */
function startBot() {
  const badge = document.createElement('div');
  badge.className = 'ui bot-badge';
  badge.textContent = `🤖 Robô · ${botProfile}`;
  ui.append(badge);
  // Diário no console (F12): o que aconteceu e onde, para caçar problemas enquanto o robô joga.
  const where = () => ({ x: Math.round(bike.x), z: Math.round(bike.z), kmh: Math.round(bike.speed * 3.6), via: bike.road?.edge, limite: pilot.limitedBy });
  events.on('crash', ({ vehicleId, relSpeed }) => {
    const v = traffic.vehicles[vehicleId];
    console.warn('[robô] acidente', { ...where(), impacto: Math.round(relSpeed * 3.6), veiculo: v && { tipo: v.reckless ? 'moto imprudente' : v.type, kmh: Math.round(v.speed * 3.6), angulo: Math.round((Math.acos(Math.cos(v.heading - bike.heading)) * 180) / Math.PI) } });
  });
  events.on('fine', ({ kind, amount }) => console.info('[robô] multa', kind, amount, where()));
  events.on('damage', ({ kind }) => console.info('[robô] conserto', kind, where()));
  events.on('job:delivered', ({ lateBy }) => console.info('[robô] entrega', lateBy > 0 ? `atrasada ${Math.round(lateBy)} s` : 'no prazo'));
  events.on('shift:end', () => setTimeout(() => shift.nextDay(), 4000));
  events.on('game:over', () => setTimeout(() => location.reload(), 6000));
  shift.start();
}

/** Primeiro turno: passa pelas instruções (a não ser que o jogador já as tenha dispensado). */
function firstShift() {
  screens.hide();
  tutorial.show(() => shift.start());
}
function resume() {
  screens.hide();
  loop.timeScale = 1;
}
input.onAction((action) => {
  if (action === 'mute') return phone.notify(copy.notify.sound(audio.toggleMute()));
  if (sim.phase !== 'turno') return;
  if (action === 'phone') return phone.toggle();
  if (action !== 'pause') return;
  if (screens.current === 'pausa') return resume();
  loop.timeScale = 0;
  screens.show('pausa');
});
events.on('bump', ({ speed }) => {
  hud.flash('batida');
  effects.sparks();
  audio.play('bump');
  chase.shake(Math.min(1, speed / 12));
});
events.on('fine', () => {
  hud.flash('radar');
  audio.play('fine');
});
events.on('damage', ({ amount }) => phone.notify(copy.notify.repair(amount)));

/** Aviso do alto da tela: contador da calçada tem prioridade sobre o radar à frente. Cada aviso novo apita. */
let lastAlert = null;
function updateWarning() {
  const camera = rules.cameraAhead();
  const alert = rules.sidewalkLeft !== null ? `calcada${Math.ceil(rules.sidewalkLeft)}` : camera ? `radar${camera.id}` : null;
  if (alert && alert !== lastAlert) audio.play('beep');
  lastAlert = alert;
  if (rules.sidewalkLeft !== null) {
    return warning.show('calcada', rules.sidewalkLeft, rules.sidewalkLeft / config.rules.sidewalkGrace);
  }
  if (camera) return warning.show('radar', camera.distance, camera.distance / config.rules.cameraWarnDistance);
  warning.show(null);
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

/** Se pilotando o quadro passar de ~30 ms por alguns segundos, baixa a qualidade (uma vez só). */
const QUALITY = { slowFrame: 1 / 33, patience: 3 };
let slowFor = 0;
function watchFrameRate(frameDt, riding) {
  if (slowFor < 0 || !riding || document.hidden) return;
  slowFor = frameDt > QUALITY.slowFrame ? slowFor + frameDt : Math.max(0, slowFor - frameDt);
  if (slowFor < QUALITY.patience) return;
  slowFor = -1;
  stage.lowerQuality();
  console.info('[jogo] quadros lentos: sombras desligadas e resolução reduzida');
}

/** Hora do dia: o turno vai do fim de tarde à noite; o menu fica no crepúsculo, com as luzes acesas. */
function daylight() {
  if (sim.phase === 'menu') return 0.6;
  return 1 - shift.timeLeft / config.shift.duration;
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
    if (botProfile && !jobs.active && shift.timeLeft > 0) {
      const ready = jobs.offers.length >= config.jobs.offerCount || jobs.offers.some((o) => o.expiresIn < 2);
      if (ready) jobs.accept(bestPerMeter(jobs.offers).id, bike);
    }
    jobs.step(dt, bike);
    signals.step(dt);
    traffic.step(dt, bike);
    rules.step(dt);
    shift.step(dt);
  },
  render(alpha, frameDt) {
    const riding = (sim.phase === 'turno' || sim.phase === 'acidente') && !debugMap;
    const view = riding ? chase : aerial;
    watchFrameRate(frameDt, riding);
    view.update(frameDt);
    bikeView.update(frameDt);
    trafficView.update();
    signalsView.update();
    const running = loop.timeScale > 0;
    effects.update(frameDt * loop.timeScale, sim.phase === 'turno');
    const driver = sim.autopilot || pilot.active ? pilot.input : input.state;
    audio.update({ speed: bike.speed, throttle: driver.throttle, horn: input.state.horn, riding: sim.phase === 'turno' && running });
    markers.update(jobs.active?.target, sim.time, sim.phase === 'turno' ? jobs.active?.route : null);
    if (sim.phase === 'turno' && !debugMap) {
      hud.update(sim);
      updateWarning();
      phone.update(sim);
    }
    stage.setDaylight(daylight());
    cityView.setNight(stage.night);
    trafficView.setNight(stage.night);
    bikeView.setNight(stage.night);
    stage.render(view.camera, riding ? bike : null);
  },
});
loop.start();
if (botProfile) loop.timeScale = Number(params.get('vel')) || 1;

/** Porta de verificação: permite exercitar o jogo sem um humano pilotando. */
window.__game = {
  sim,
  config,
  events,
  rng,
  input,
  loop,
  view: { stage, cityView, aerial, chase, bikeView },
  start: () => shift.start(),
  phone,
  audio,
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
    shift: { day: shift.day, timeLeft: shift.timeLeft, bills: shift.bills, missedDays: shift.missedDays },
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
