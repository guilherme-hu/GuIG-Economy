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
import { createAerialCamera } from './render/camera.js';

const canvas = document.getElementById('jogo');
const params = new URLSearchParams(location.search);
const debugMap = params.get('debug') === 'mapa';

const events = createEvents();
const rng = createRng(config.seed);
const input = createInput();

const city = generateCity(config.city, rng.fork('cidade'));
const graph = createGraph(city);
const sim = { time: 0, phase: 'menu', city, graph };

const stage = createScene(canvas);
const cityView = createCityView({ city, config: config.city, scene: stage.scene, assets: createAssets() });
const aerial = createAerialCamera({
  size: city.size,
  focus: { x: config.city.centro.x * city.size, z: config.city.centro.z * city.size },
  canvas,
  interactive: debugMap,
  pose: debugPose(params.get('cam')),
});
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
  },
  render(alpha, frameDt) {
    aerial.update(frameDt);
    stage.render(aerial.camera);
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
  view: { stage, cityView, aerial },
  state: () => ({
    time: sim.time,
    phase: sim.phase,
    city: { nodes: city.nodes.length, edges: city.edges.length, pois: city.pois.length, lots: city.lots.length },
    view: { buildingsLoaded: cityView.loaded, drawCalls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles },
  }),
  setTimeScale: (n) => (loop.timeScale = n),
};
