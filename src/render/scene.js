/**
 * Base de renderização: renderer, câmera, luz do sol + hemisférica, neblina, céu, sombra que segue a moto
 * e pós-processamento (bloom + tone mapping ACES). A hora do dia vem de `setTimeOfDay(t)`:
 * 0 = fim de tarde dourado, 0,5 = crepúsculo magenta, 1 = noite. Os quadros ficam em `config.render.times`.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSky } from './sky.js';

const UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;

export function createScene(canvas, cfg) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // aplicado pelo OutputPass
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // já é suave; PCFSoftShadowMap foi removido do three

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, cfg.fog.near, cfg.fog.far);
  const camera = new THREE.PerspectiveCamera(cfg.camera.fov, 1, cfg.camera.near, cfg.camera.far);

  const hemi = new THREE.HemisphereLight();
  const sun = createSun(cfg.shadow);
  const sky = createSky(cfg.sky);
  scene.add(hemi, sun, sun.target, sky.mesh);

  const { composer, bloom, target } = createComposer(renderer, scene, camera, cfg);

  const frames = cfg.times.map(parseFrame);
  const frame = parseFrame(cfg.times[0]); // quadro interpolado, reaproveitado
  const sunDirection = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const nightListeners = [];

  function setTimeOfDay(t) {
    mixFrames(frame, frames, THREE.MathUtils.clamp(t, 0, 1));
    const elevation = frame.sunElevation * DEG;
    const azimuth = frame.sunAzimuth * DEG;
    sunDirection.set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth));

    sun.color.copy(frame.sunColor);
    sun.intensity = frame.sunIntensity;
    sun.shadow.intensity = frame.shadow;
    sun.castShadow = frame.shadow > 0.01;
    hemi.color.copy(frame.hemiSky);
    hemi.groundColor.copy(frame.hemiGround);
    hemi.intensity = frame.hemiIntensity;
    scene.fog.color.copy(frame.horizon);
    renderer.toneMappingExposure = frame.exposure;
    bloom.strength = frame.bloom;
    sky.apply(frame, sunDirection);
    placeSun();
    for (const listener of nightListeners) listener(frame.night);
  }

  /** Centro da sombra (a moto). */
  function setFocus(x, z) {
    focus.set(x, 0, z);
    placeSun();
  }

  function placeSun() {
    snapToShadowTexel(sun.target.position.copy(focus), sunDirection, (2 * cfg.shadow.extent) / cfg.shadow.mapSize);
    sun.position.copy(sun.target.position).addScaledVector(sunDirection, cfg.shadow.distance);
  }

  /** Chama `listener(nightFactor)` a cada mudança de hora (e uma vez agora). */
  function onNightChange(listener) {
    nightListeners.push(listener);
    listener(frame.night);
  }

  /** Liga a intensidade emissiva do material ao anoitecer: `maxIntensity × nightFactor`. */
  function registerNightMaterial(material, maxIntensity = 1) {
    onNightChange((night) => {
      material.emissiveIntensity = maxIntensity * night;
      if (material.userData.night) material.userData.night.value = night; // janelas sorteadas (assets.js)
    });
  }

  function render(frameDt = 0) {
    sky.update(camera, frameDt);
    composer.render(frameDt);
  }

  function resize(width = canvas.clientWidth || innerWidth, height = canvas.clientHeight || innerHeight) {
    const pixelRatio = Math.min(devicePixelRatio, cfg.pixelRatioMax);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    bloom.setSize(width * pixelRatio * cfg.bloom.scale, height * pixelRatio * cfg.bloom.scale);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    nightListeners.length = 0;
    sky.dispose();
    sun.shadow.dispose();
    bloom.dispose();
    composer.dispose();
    target.dispose();
    renderer.dispose();
  }

  setTimeOfDay(0);
  resize();

  return {
    scene,
    camera,
    renderer,
    get nightFactor() {
      return frame.night;
    },
    setTimeOfDay,
    setFocus,
    onNightChange,
    registerNightMaterial,
    render,
    resize,
    dispose,
  };
}

function createSun({ mapSize, extent, distance, bias, normalBias }) {
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.bias = bias;
  sun.shadow.normalBias = normalBias;
  const box = sun.shadow.camera;
  box.left = box.bottom = -extent;
  box.right = box.top = extent;
  box.near = 1;
  box.far = distance * 2;
  box.updateProjectionMatrix();
  return sun;
}

function createComposer(renderer, scene, camera, cfg) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: cfg.msaa });
  const composer = new EffectComposer(renderer, target);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, cfg.bloom.radius, cfg.bloom.threshold);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom, target };
}

/** Converte as cores (strings) de um quadro de `config.render.times` em THREE.Color. */
function parseFrame(source) {
  const parsed = {};
  for (const [key, value] of Object.entries(source)) parsed[key] = typeof value === 'string' ? new THREE.Color(value) : value;
  return parsed;
}

/** Interpola em `out` os dois quadros vizinhos de `t`. */
function mixFrames(out, frames, t) {
  let i = 0;
  while (i < frames.length - 2 && t > frames[i + 1].at) i++;
  const a = frames[i];
  const b = frames[i + 1];
  const u = THREE.MathUtils.clamp((t - a.at) / (b.at - a.at), 0, 1);
  for (const key in a) {
    if (a[key].isColor) out[key].lerpColors(a[key], b[key], u);
    else out[key] = a[key] + (b[key] - a[key]) * u;
  }
}

const right = new THREE.Vector3();
const up = new THREE.Vector3();

/** Arredonda `point` à grade de texels do mapa de sombra, para a sombra não tremer quando o foco anda. */
function snapToShadowTexel(point, lightDirection, texel) {
  right.crossVectors(UP, lightDirection).normalize();
  up.crossVectors(lightDirection, right);
  const x = point.dot(right);
  const y = point.dot(up);
  point.addScaledVector(right, Math.round(x / texel) * texel - x);
  point.addScaledVector(up, Math.round(y / texel) * texel - y);
  return point;
}
