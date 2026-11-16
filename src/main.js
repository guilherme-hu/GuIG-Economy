/**
 * Composição: o único arquivo que conhece todos os módulos.
 * Cria a simulação, as visões e a interface, e liga tudo pelo barramento de eventos.
 */
import * as THREE from 'three';
import { config } from './config.js';
import { createEvents } from './core/events.js';
import { createRng } from './core/rng.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';

const canvas = document.getElementById('jogo');
const events = createEvents();
const rng = createRng(config.seed);
const input = createInput();

const sim = { time: 0, phase: 'menu' };

// Cena provisória do M0; a onda 1 troca por render/scene.js.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d29);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
camera.position.set(6, 5, 8);
camera.lookAt(0, 0.5, 0);
scene.add(new THREE.HemisphereLight(0xffe2b8, 0x2a2f45, 2));
const marker = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff5a1f }),
);
marker.position.y = 0.5;
scene.add(marker, new THREE.GridHelper(40, 40, 0x3a4060, 0x262a3d));

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const loop = createLoop({
  step(dt) {
    sim.time += dt;
  },
  render() {
    marker.rotation.y = sim.time;
    renderer.render(scene, camera);
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
  state: () => ({ time: sim.time, phase: sim.phase }),
  setTimeScale: (n) => (loop.timeScale = n),
};
