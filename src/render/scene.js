/**
 * Renderer, cena, luz e céu. Não sabe nada do jogo: só desenha o que puserem na cena.
 * `setDaylight(p)` leva a luz do fim de tarde (0) até a noite (1); `night` diz quanto as luzes da cidade acendem.
 */
import * as THREE from 'three';

// Paleta ao longo do turno (17h00 → 20h45). Entre dois quadros a cor é interpolada.
const KEYS = [
  { at: 0.0, top: 0x6fa3d8, horizon: 0xf4cfa2, sun: 0xffd2a0, sunPower: 3.2, elevation: 0.62, hemiSky: 0xffe9c9, hemiGround: 0x4a4f5e, hemiPower: 1.0, exposure: 1.05, fogNear: 260, fogFar: 1500 },
  { at: 0.3, top: 0x4d5f9e, horizon: 0xff9a5c, sun: 0xff8f52, sunPower: 2.6, elevation: 0.2, hemiSky: 0xffc7a0, hemiGround: 0x433f58, hemiPower: 0.95, exposure: 1.05, fogNear: 220, fogFar: 1300 },
  { at: 0.5, top: 0x222a5c, horizon: 0x9c5c86, sun: 0xff7a6e, sunPower: 0.8, elevation: 0.06, hemiSky: 0x9c8cc4, hemiGround: 0x2b2944, hemiPower: 1.0, exposure: 1.05, fogNear: 180, fogFar: 1100 },
  { at: 0.72, top: 0x060918, horizon: 0x1c2250, sun: 0x9fb2ff, sunPower: 0.45, elevation: 0.55, hemiSky: 0x4a5a9c, hemiGround: 0x161724, hemiPower: 0.75, exposure: 1.15, fogNear: 140, fogFar: 950 },
];
const NIGHT = { from: 0.38, to: 0.62 }; // trecho do turno em que as luzes da cidade acendem
const COLORS = new Set(['top', 'horizon', 'sun', 'hemiSky', 'hemiGround']);
const SUN_AZIMUTH = Math.atan2(0.56, -0.55);
const SHADOW = { size: 70, map: 2048, height: 220, minPower: 0.6 }; // caixa de sombra (m) em volta da moto

const SKY_SHADER = {
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; uniform float night;
    varying vec3 vDir;
    float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
    void main() {
      vec3 dir = normalize(vDir);
      vec3 color = mix(horizon, top, pow(clamp(dir.y, 0.0, 1.0), 0.55));
      float sun = max(dot(dir, sunDir), 0.0);
      color += sunColor * (pow(sun, 8.0) * 0.35 + pow(sun, 600.0) * 1.5) * (1.0 - night);
      float star = step(0.9975, hash(floor(dir * 300.0))) * smoothstep(0.08, 0.4, dir.y);
      color += vec3(star * night * 0.9);
      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export function createScene(canvas) {
  // Profundidade logarítmica: as camadas do chão ficam a centímetros umas das outras e a vista aérea está a quilômetros.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0, 1, 2);
  scene.fog = fog;

  const hemisphere = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.shadow.mapSize.set(SHADOW.map, SHADOW.map);
  Object.assign(sun.shadow.camera, { left: -SHADOW.size, right: SHADOW.size, top: SHADOW.size, bottom: -SHADOW.size, near: 1, far: SHADOW.height * 2 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(hemisphere, sun, sun.target);

  const uniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, night: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({ ...SKY_SHADER, uniforms, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  const sunDir = new THREE.Vector3();
  const look = {};
  const stage = { renderer, scene, night: 0 };

  /** `p` de 0 (17h, sol dourado) a 1 (quase 21h, noite). `fogScale` afasta a névoa (vista aérea do menu). */
  function setDaylight(p, fogScale = 1) {
    blend(p, look);
    const lift = Math.sin(look.elevation);
    sunDir.set(Math.cos(SUN_AZIMUTH) * Math.cos(look.elevation), lift, Math.sin(SUN_AZIMUTH) * Math.cos(look.elevation));
    uniforms.top.value.setHex(look.top);
    uniforms.horizon.value.setHex(look.horizon);
    uniforms.sunColor.value.setHex(look.sun);
    uniforms.sunDir.value.copy(sunDir);
    stage.night = smoothstep(NIGHT.from, NIGHT.to, p);
    uniforms.night.value = stage.night;
    fog.color.setHex(look.horizon);
    fog.near = look.fogNear * fogScale;
    fog.far = look.fogFar * fogScale;
    hemisphere.color.setHex(look.hemiSky);
    hemisphere.groundColor.setHex(look.hemiGround);
    hemisphere.intensity = look.hemiPower;
    sun.color.setHex(look.sun);
    sun.intensity = look.sunPower;
    renderer.toneMappingExposure = look.exposure;
  }
  setDaylight(0);

  const resizeHandlers = new Set();
  let maxPixelRatio = 1.5;
  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, maxPixelRatio));
    renderer.setSize(innerWidth, innerHeight, false);
    resizeHandlers.forEach((fn) => fn(innerWidth / innerHeight));
  }
  addEventListener('resize', resize);

  /** Sombras só perto da moto (`focus`); sem foco (menu, mapa) ou com o sol fraco, nada de sombra. */
  function placeSun(focus) {
    sun.castShadow = !!focus && sun.intensity > SHADOW.minPower;
    const step = (SHADOW.size * 2) / SHADOW.map; // anda de texel em texel: a sombra não tremula
    const x = focus ? Math.round(focus.x / step) * step : 0;
    const z = focus ? Math.round(focus.z / step) * step : 0;
    sun.target.position.set(x, 0, z);
    sun.position.set(x + sunDir.x * SHADOW.height, Math.max(sunDir.y, 0.25) * SHADOW.height, z + sunDir.z * SHADOW.height);
  }

  return Object.assign(stage, {
    setDaylight,
    /** Placa de vídeo fraca: sem sombras e com menos pixels. */
    lowerQuality() {
      renderer.shadowMap.enabled = false;
      maxPixelRatio = 1;
      resize();
    },
    /** A vista aérea de debug precisa enxergar o mapa inteiro, sem neblina. */
    setFog: (on) => (scene.fog = on ? fog : null),
    onResize(fn) {
      resizeHandlers.add(fn);
      fn(innerWidth / innerHeight);
    },
    resize,
    render(camera, focus) {
      placeSun(focus);
      sky.position.copy(camera.position);
      renderer.render(scene, camera);
    },
  });
}

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

const mixColor = (a, b, t) => {
  const ch = (shift) => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Interpola os quadros de KEYS em `p` e escreve em `out`. */
function blend(p, out) {
  const i = Math.max(0, KEYS.findLastIndex((key) => key.at <= p));
  const a = KEYS[i];
  const b = KEYS[Math.min(i + 1, KEYS.length - 1)];
  const t = b === a ? 0 : Math.min((p - a.at) / (b.at - a.at), 1);
  for (const key in a) {
    if (key === 'at') continue;
    out[key] = COLORS.has(key) ? mixColor(a[key], b[key], t) : a[key] + (b[key] - a[key]) * t;
  }
}
