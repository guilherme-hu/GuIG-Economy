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
