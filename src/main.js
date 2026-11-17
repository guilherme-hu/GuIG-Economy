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
import { createEconomy } from './sim/economy.js';
import { createHud } from './ui/hud.js';
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
const sim = { time: 0, phase: 'menu', city, graph, bike, economy };

const stage = createScene(canvas);
const cityView = createCityView({ city, config: config.city, scene: stage.scene, assets: createAssets() });
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
const screens = createScreens(ui, { onStart: startShift, onResume: resume, onNextDay: startShift, onRestart: () => location.reload() });
hud.setVisible(false);
if (!debugMap) screens.show('menu');

function startShift() {
  sim.phase = 'turno';
  economy.startDay();
  screens.hide();
  hud.setVisible(true);
}
function resume() {
  screens.hide();
  loop.timeScale = 1;
}
input.onAction((action) => {
  if (action !== 'pause' || sim.phase !== 'turno') return;
  if (screens.current === 'pausa') return resume();
  loop.timeScale = 0;
  screens.show('pausa');
});
events.on('bump', () => hud.flash('batida'));

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
    bike.step(input.state, dt);
    economy.tick(dt);
    if (bike.wallHit) events.emit('bump', { kind: 'parede', speed: bike.wallHit });
  },
  render(alpha, frameDt) {
    const riding = sim.phase === 'turno' && !debugMap;
    const view = riding ? chase : aerial;
    view.update(frameDt);
    bikeView.update();
    if (riding) hud.update(sim);
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
    money: economy.money,
    rating: economy.rating,
    city: { nodes: city.nodes.length, edges: city.edges.length, pois: city.pois.length, lots: city.lots.length },
    view: { buildingsLoaded: cityView.loaded, drawCalls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles },
  }),
  setTimeScale: (n) => (loop.timeScale = n),
};
