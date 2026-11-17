/** Marcador do destino atual (coleta ou entrega): coluna de luz visível de longe + anel no chão. */
import * as THREE from 'three';

const LOOK = { color: 0xc8ff2e, height: 60, radius: 1.6, ring: 4.5, opacity: 0.35 };

export function createMarkersView({ scene }) {
  const material = new THREE.MeshBasicMaterial({ color: LOOK.color, transparent: true, opacity: LOOK.opacity, depthWrite: false, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(LOOK.radius, LOOK.radius, LOOK.height, 16, 1, true), material);
  beam.position.y = LOOK.height / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(LOOK.ring - 0.6, LOOK.ring, 32).rotateX(-Math.PI / 2), material);
  ring.position.y = 0.08;
  const marker = new THREE.Group().add(beam, ring);
  marker.visible = false;
  scene.add(marker);

  return {
    /** `target` é um POI ou `null`. */
    update(target, time) {
      marker.visible = !!target;
      if (!target) return;
      marker.position.set(target.x, 0, target.z);
      ring.scale.setScalar(1 + 0.12 * Math.sin(time * 4));
    },
  };
}
