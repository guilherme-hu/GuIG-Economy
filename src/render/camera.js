/** Câmeras. Por enquanto só a aérea; a de 3ª pessoa atrás da moto entra no M2. */
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

const CHASE = { back: 6.2, height: 2.9, ahead: 5, lookHeight: 1.1, follow: 5, fov: 58, fovBoost: 16, far: 1600 };

/** Câmera em 3ª pessoa: atrás e acima da moto, com mola na direção e FOV que abre com a velocidade. */
export function createChaseCamera({ bike, maxSpeed }) {
  const camera = new THREE.PerspectiveCamera(CHASE.fov, 1, 0.3, CHASE.far);
  let heading = bike.heading;

  return {
    camera,
    resize(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    /** Sem mola: usar depois de teleportar. */
    snap() {
      heading = bike.heading;
    },
    update(dt) {
      const delta = Math.atan2(Math.sin(bike.heading - heading), Math.cos(bike.heading - heading));
      heading += delta * Math.min(1, CHASE.follow * dt);
      const dx = Math.cos(heading);
      const dz = Math.sin(heading);
      camera.position.set(bike.x - dx * CHASE.back, CHASE.height, bike.z - dz * CHASE.back);
      camera.lookAt(bike.x + dx * CHASE.ahead, CHASE.lookHeight, bike.z + dz * CHASE.ahead);
      const fov = CHASE.fov + CHASE.fovBoost * Math.min(1, Math.abs(bike.speed) / maxSpeed);
      if (Math.abs(fov - camera.fov) > 0.05) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
