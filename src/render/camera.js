/** Câmeras: a aérea (menu e mapa de debug) e a de 3ª pessoa atrás da moto. */
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

const LOOK = {
  fov: 45,
  far: 1600,
  mapMargin: 1.06, // folga em volta do mapa na vista de debug
  orbit: { radius: 520, height: 230, speed: 0.035, lookHeight: 20 },
};

/**
 * Câmera aérea. Com `interactive`, mostra o mapa inteiro de cima e deixa arrastar, girar e dar zoom
 * (é o `?debug=mapa`). Sem isso, circula sozinha em volta de `focus`.
 * `pose` opcional (`{ x, z, distance, tilt, turn }`) fixa a vista de debug, para screenshots reproduzíveis.
 */
export function createAerialCamera({ size, focus, canvas, interactive, pose }) {
  // Fora do debug, nada além da neblina precisa ser desenhado.
  const camera = new THREE.PerspectiveCamera(LOOK.fov, 1, interactive ? 5 : 0.5, interactive ? 8000 : LOOK.far);
  let controls = null;
  let angle = 2.4;

  if (interactive) {
    const fit = (size * LOOK.mapMargin) / 2 / Math.tan(THREE.MathUtils.degToRad(LOOK.fov / 2));
    const view = { x: 0, z: 0, distance: fit, tilt: 0.0005, turn: 0, ...pose };
    controls = new MapControls(camera, canvas);
    controls.target.set(view.x, 0, view.z);
    camera.position.setFromSphericalCoords(view.distance, view.tilt, view.turn).add(controls.target);
    controls.maxPolarAngle = 1.45;
    controls.minDistance = 15;
    controls.maxDistance = fit * 1.6;
    controls.zoomToCursor = true;
    controls.update();
  }

  return {
    camera,
    resize(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    update(dt) {
      if (controls) return controls.update();
      angle += LOOK.orbit.speed * dt;
      camera.position.set(focus.x + Math.cos(angle) * LOOK.orbit.radius, LOOK.orbit.height, focus.z + Math.sin(angle) * LOOK.orbit.radius);
      camera.lookAt(focus.x, LOOK.orbit.lookHeight, focus.z);
    },
  };
}

// A sensação de velocidade vem daqui: câmera baixa e perto, e o FOV abre bastante quando a moto corre.
const CHASE = { back: 5.2, height: 2.3, ahead: 6, lookHeight: 1.1, follow: 5, fov: 60, fovBoost: 32, far: 1600 };
// Tremor: `trauma` (0..1) sobe nas batidas e cai sozinho; acima de `fastKmh` a velocidade também treme a câmera.
const SHAKE = { amplitude: 0.45, decay: 1.6, fastKmh: 80, speedTrauma: 0.35 };

/** Câmera em 3ª pessoa: atrás e acima da moto, com mola na direção e FOV que abre com a velocidade. */
export function createChaseCamera({ bike, maxSpeed, canvas }) {
  const camera = new THREE.PerspectiveCamera(CHASE.fov, 1, 0.3, CHASE.far);
  let heading = bike.heading;
  let trauma = 0;
  let clock = 0;
  let orbitEnabled = false;
  let pointer = null;
  let yaw = 0;
  let pitch = 0;
  let blend = 0;
  const elevation = Math.atan2(CHASE.height - CHASE.lookHeight, CHASE.back);
  const radius = Math.hypot(CHASE.back, CHASE.height - CHASE.lookHeight);

  function endDrag() {
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    pointer = null;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!orbitEnabled || event.button !== 0 || !event.isPrimary) return;
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointer !== event.pointerId) return;
    yaw = THREE.MathUtils.euclideanModulo(yaw + event.movementX * 0.006 + Math.PI, 2 * Math.PI) - Math.PI;
    pitch = THREE.MathUtils.clamp(pitch + event.movementY * 0.005, -0.28, 0.95);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, (event) => {
      if (event.pointerId === pointer) endDrag();
    });
  }
  window.addEventListener('blur', endDrag);

  return {
    camera,
    resize(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    /** Sem mola: usar depois de teleportar. */
    setOrbit(enabled) {
      orbitEnabled = enabled;
      if (!enabled && pointer !== null) endDrag();
    },
    snap() {
      endDrag();
      yaw = pitch = blend = 0;
      heading = bike.heading;
      trauma = 0;
    },
    /** Sacode a câmera; `amount` de 0 a 1. */
    shake(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    update(dt) {
      const delta = Math.atan2(Math.sin(bike.heading - heading), Math.cos(bike.heading - heading));
      heading += delta * Math.min(1, CHASE.follow * dt);
      const smoothing = 1 - Math.exp(-12 * dt);
      blend = THREE.MathUtils.lerp(blend, orbitEnabled ? 1 : 0, smoothing);
      if (!orbitEnabled) {
        yaw *= 1 - smoothing;
        pitch *= 1 - smoothing;
      }
      const angle = heading + yaw;
      const back = radius * Math.cos(elevation + pitch);
      camera.position.set(bike.x - Math.cos(angle) * back,
        CHASE.lookHeight + radius * Math.sin(elevation + pitch),
        bike.z - Math.sin(angle) * back);
      const ahead = CHASE.ahead * (1 - blend);
      camera.lookAt(bike.x + Math.cos(heading) * ahead, CHASE.lookHeight, bike.z + Math.sin(heading) * ahead);
      clock += dt;
      trauma = Math.max(0, trauma - SHAKE.decay * dt);
      const fast = Math.max(0, (Math.abs(bike.speed) * 3.6 - SHAKE.fastKmh) / (maxSpeed * 3.6 - SHAKE.fastKmh));
      const shake = (trauma * trauma + fast * fast * SHAKE.speedTrauma * SHAKE.speedTrauma) * SHAKE.amplitude;
      if (shake > 0.001) {
        camera.position.y += shake * (Math.sin(clock * 37) + Math.sin(clock * 23)) * 0.5;
        camera.rotateZ(shake * 0.12 * Math.sin(clock * 29));
        camera.rotateY(shake * 0.06 * Math.sin(clock * 17));
      }
      const fov = CHASE.fov + CHASE.fovBoost * Math.min(1, Math.abs(bike.speed) / maxSpeed);
      if (Math.abs(fov - camera.fov) > 0.05) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
