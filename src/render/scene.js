/** Renderer, cena, luz e céu. Não sabe nada do jogo: só desenha o que puserem na cena. */
import * as THREE from 'three';

const LOOK = {
  sky: 0xf2c79a, // fim de tarde; o M6 faz o céu mudar ao longo do turno
  fogNear: 260,
  fogFar: 1500,
  hemisphereSky: 0xffe9c9,
  hemisphereGround: 0x4a4f5e,
  sun: 0xffd2a0,
  sunDirection: [-0.55, 0.62, 0.56],
  exposure: 1.05,
};

export function createScene(canvas) {
  // Profundidade logarítmica: as camadas do chão ficam a centímetros umas das outras e a vista aérea está a quilômetros.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LOOK.sky);
  const fog = new THREE.Fog(LOOK.sky, LOOK.fogNear, LOOK.fogFar);
  scene.fog = fog;

  const sun = new THREE.DirectionalLight(LOOK.sun, 2.6);
  sun.position.set(...LOOK.sunDirection);
  scene.add(new THREE.HemisphereLight(LOOK.hemisphereSky, LOOK.hemisphereGround, 1.5), sun);

  const resizeHandlers = new Set();
  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    resizeHandlers.forEach((fn) => fn(innerWidth / innerHeight));
  }
  addEventListener('resize', resize);

  return {
    renderer,
    scene,
    /** A vista aérea de debug precisa enxergar o mapa inteiro, sem neblina. */
    setFog: (on) => (scene.fog = on ? fog : null),
    onResize(fn) {
      resizeHandlers.add(fn);
      fn(innerWidth / innerHeight);
    },
    resize,
    render: (camera) => renderer.render(scene, camera),
  };
}
