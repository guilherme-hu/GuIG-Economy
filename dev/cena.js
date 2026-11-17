/**
 * Vitrine de desenvolvimento da base de renderização: uma rua com prédios dos três kits, carros, postes,
 * semáforos, árvores e pedestres. Slider de hora do dia e botão "auto". Não faz parte do jogo.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from '../src/config.js';
import { createScene } from '../src/render/scene.js';
import { createAssets } from '../src/render/assets.js';
import { createGlowPoints, createLightPools, createEmissiveMaterial } from '../src/render/lights.js';

const S = config.render.modelScale;
const ROAD_HALF = 7;
const SIDEWALK = 4;
const LOT_EDGE = ROAD_HALF + SIDEWALK;
const STREET_LENGTH = 260;
const LAMP_COLOR = 0xffb870;

const view = createScene(document.getElementById('cena'), config.render);
const assets = createAssets(config.render, '/assets/models/');
const mixers = [];

const KEYS = [
  ...assets.listKeys('commercial/building-'),
  ...assets.listKeys('suburban/building-type-').slice(0, 8),
  ...assets.listKeys('industrial/building-').slice(0, 6),
  ...['sedan', 'taxi', 'suv', 'van', 'hatchback-sports', 'delivery', 'truck', 'police', 'garbage-truck'].map((n) => `cars/${n}`),
  ...['light-curved', 'traffic-light', 'road-sign-stop'].map((n) => `street/${n}`),
  ...['tree-large', 'tree-small', 'fence-1x3', 'planter'].map((n) => `suburban/${n}`),
  'industrial/water-tower',
  'industrial/chimney-medium',
  'characters/character-male-a',
  'characters/character-female-b',
  'characters/character-worker',
];

const batches = new Map();

/** Põe uma instância do modelo no chão, na escala do kit. */
function put(key, x, z, rotationY = 0, scale = S[key.split('/')[0]]) {
  if (!batches.has(key)) {
    batches.set(key, assets.instanced(key, 64));
    view.scene.add(batches.get(key).object);
  }
  const batch = batches.get(key);
  batch.setTransform(batch.count, x, 0, z, rotationY, scale);
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function noisy(base, spread) {
  return (ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
      const shade = Math.random() < 0.5 ? 255 : 0;
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * spread})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  };
}

function slab(width, depth, height, x, z, texture, repeat) {
  texture.repeat.set(width / repeat, depth / repeat);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshLambertMaterial({ map: texture }));
  mesh.position.set(x, height / 2 - 0.02, z);
  mesh.receiveShadow = true;
  view.scene.add(mesh);
  return mesh;
}

function buildGround() {
  slab(900, 900, 0.02, 0, 0, canvasTexture(256, noisy('#4b4c58', 0.07)), 8);
  const paving = () => canvasTexture(256, noisy('#8f8a92', 0.05));
  slab(STREET_LENGTH, SIDEWALK, 0.18, 0, -(ROAD_HALF + SIDEWALK / 2), paving(), 4);
  slab(STREET_LENGTH, SIDEWALK, 0.18, 0, ROAD_HALF + SIDEWALK / 2, paving(), 4);
  slab(STREET_LENGTH, 60, 0.1, 0, -(LOT_EDGE + 30), canvasTexture(256, noisy('#5d5a66', 0.05)), 6);
  slab(120, 40, 0.1, -70, LOT_EDGE + 20, canvasTexture(256, noisy('#5f9160', 0.08)), 6);
  slab(140, 40, 0.1, 60, LOT_EDGE + 20, canvasTexture(256, noisy('#6a6770', 0.06)), 6);

  const dashes = canvasTexture(64, (ctx) => {
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(0, 24, 40, 16);
  });
  dashes.repeat.set(STREET_LENGTH / 6, 1);
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(STREET_LENGTH, 0.6).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: dashes, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  line.position.y = 0.01;
  line.receiveShadow = true;
  view.scene.add(line);
}

/** Enfileira prédios ao longo de X com a frente virada para a rua. `side`: −1 = lado norte (z negativo). */
function buildRow(keys, startX, side, setback = 0, gap = 1.5) {
  let x = startX;
  for (const key of keys) {
    const { size } = assets.info(key);
    const scale = S[key.split('/')[0]];
    const width = size.x * scale;
    const z = side * (LOT_EDGE + setback + (size.z * scale) / 2);
    put(key, x + width / 2, z, side < 0 ? 0 : Math.PI);
    x += width + gap;
  }
  return x;
}

function buildCity() {
  const commercial = assets.listKeys('commercial/building-').filter((k) => !k.includes('skyscraper'));
  buildRow(commercial, -110, -1);
  buildRow(assets.listKeys('commercial/building-skyscraper'), -70, -1, 26, 9);

  const houses = assets.listKeys('suburban/building-type-').slice(0, 8);
  const endOfHouses = buildRow(houses, -125, 1, 5, 4);
  for (let x = -122; x < endOfHouses; x += 13.5) put(x % 2 ? 'suburban/tree-large' : 'suburban/tree-small', x, LOT_EDGE + 2.2);
  for (let x = -118; x < endOfHouses; x += 27) put('suburban/planter', x, ROAD_HALF + 1.2);

  const end = buildRow(assets.listKeys('industrial/building-').slice(0, 6), endOfHouses + 8, 1, 3, 3);
  put('industrial/water-tower', end + 6, LOT_EDGE + 10);
  put('industrial/chimney-medium', end - 20, LOT_EDGE + 26);

  for (let x = -100; x <= 100; x += 20) put('suburban/tree-large', x + 6, -(ROAD_HALF + 1.3), x, 9);
}

function buildTraffic() {
  const cars = KEYS.filter((k) => k.startsWith('cars/'));
  cars.forEach((key, i) => {
    const eastbound = i % 2 === 0;
    const x = -64 + i * 15 + (eastbound ? 0 : 6);
    put(key, x, eastbound ? 3.4 : -3.4, eastbound ? Math.PI / 2 : -Math.PI / 2);
  });
}

function buildLights() {
  const glows = createGlowPoints(64, { size: 3.2 });
  const pools = createLightPools(64);
  const lampHeight = assets.info('street/light-curved').size.y * S.street;
  let n = 0;
  for (let x = -120; x <= 120; x += 24) {
    for (const side of [-1, 1]) {
      const px = x + (side > 0 ? 12 : 0);
      const z = side * (ROAD_HALF + 0.8);
      put('street/light-curved', px, z, side < 0 ? Math.PI : 0);
      const bulbZ = z - side * 0.15 * S.street;
      glows.set(n, px, lampHeight - 0.35, bulbZ, LAMP_COLOR, 2.2);
      pools.set(n, px, bulbZ - side * 1.5, 9, LAMP_COLOR, 0.24);
      n++;
    }
  }
  glows.commit();
  pools.commit();
  view.scene.add(glows.object, pools.object);
  view.onNightChange((night) => {
    glows.intensity = night;
    pools.intensity = night;
  });
}

/** Dois semáforos num cruzamento imaginário em x = 0; a lente acesa é uma esfera emissiva + halo. */
function buildSignals() {
  const lensY = { red: 0.475, yellow: 0.435, green: 0.395 };
  const colors = { red: 0xff3b30, yellow: 0xffc02e, green: 0x38e07b };
  const halos = createGlowPoints(8, { size: 1.6 });
  const lensGeometry = new THREE.SphereGeometry(0.16, 12, 8);
  const lit = [
    { x: -4, z: ROAD_HALF + 0.9, rotation: 0, state: 'red' },
    { x: 4, z: -(ROAD_HALF + 0.9), rotation: Math.PI, state: 'green' },
  ];
  lit.forEach(({ x, z, rotation, state }, i) => {
    put('street/traffic-light', x, z, rotation);
    const facing = Math.cos(rotation); // lentes nativas olham para −X
    const lens = new THREE.Mesh(lensGeometry, createEmissiveMaterial(colors[state], 4));
    lens.position.set(x - facing * 0.058 * S.street, lensY[state] * S.street, z);
    view.scene.add(lens);
    halos.set(i, lens.position.x - facing * 0.15, lens.position.y, z, colors[state], 1.6);
  });
  halos.commit();
  view.scene.add(halos.object);
  put('street/road-sign-stop', 22, ROAD_HALF + 0.9, 0);
}

function buildPeople() {
  const people = [
    { key: 'characters/character-male-a', x: -12, z: ROAD_HALF + 2.2, rotation: -1.2, clip: 'idle' },
    { key: 'characters/character-female-b', x: -9.5, z: ROAD_HALF + 2.6, rotation: 2.4, clip: 'emote-yes' },
    { key: 'characters/character-worker', x: 14, z: -(ROAD_HALF + 2), rotation: Math.PI / 2, clip: 'walk' },
  ];
  for (const { key, x, z, rotation, clip } of people) {
    const person = assets.clone(key);
    person.scale.setScalar(S.characters);
    person.position.set(x, 0.16, z);
    person.rotation.y = rotation;
    view.scene.add(person);
    const mixer = new THREE.AnimationMixer(person);
    mixer.clipAction(THREE.AnimationClip.findByName(person.animations, clip)).play();
    mixers.push(mixer);
  }
}

function buildWorld() {
  buildGround();
  buildCity();
  buildTraffic();
  buildLights();
  buildSignals();
  buildPeople();
  for (const batch of batches.values()) batch.commit();
  for (const { material, intensity } of assets.nightMaterials()) view.registerNightMaterial(material, intensity);
}

// ---------- interface ----------
const slider = document.getElementById('hora');
const output = document.getElementById('valor');
const autoButton = document.getElementById('auto');
const fpsLabel = document.getElementById('fps');
let auto = false;
let time = 0;

function setTime(t) {
  time = t;
  slider.value = t;
  output.textContent = t.toFixed(2);
  view.setTimeOfDay(t);
}
slider.addEventListener('input', () => setTime(Number(slider.value)));
autoButton.addEventListener('click', () => {
  auto = !auto;
  autoButton.textContent = auto ? 'parar' : 'auto';
});

const controls = new OrbitControls(view.camera, view.renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
view.camera.position.set(-46, 7, 15);
controls.target.set(0, 7, -6);
addEventListener('resize', () => view.resize());

const clock = new THREE.Clock();
const fps = { frames: 0, since: performance.now(), value: 0 };

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (auto) setTime((time + dt / 24) % 1);
  for (const mixer of mixers) mixer.update(dt);
  controls.update();
  view.setFocus(controls.target.x, controls.target.z);
  view.renderer.info.reset();
  view.render(dt);
  countFps();
}

function countFps() {
  fps.frames++;
  const now = performance.now();
  if (now - fps.since < 500) return;
  fps.value = (fps.frames * 1000) / (now - fps.since);
  fps.frames = 0;
  fps.since = now;
  const { calls, triangles } = view.renderer.info.render;
  fpsLabel.textContent = `${fps.value.toFixed(0)} fps · ${calls} draws · ${(triangles / 1000).toFixed(0)}k tris`;
}

await assets.load(KEYS, (done, total) => (fpsLabel.textContent = `carregando ${done}/${total}`));
buildWorld();
setTime(0);
view.renderer.info.autoReset = false;
frame();

window.__cena = { view, assets, controls, setTime, fps, THREE };
