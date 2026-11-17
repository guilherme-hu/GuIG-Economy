/**
 * Marcador do destino atual (coleta ou entrega): coluna de luz visível de longe + anel no chão.
 * E a rota do GPS pintada no asfalto: uma faixa de setas que correm em direção ao destino.
 */
import * as THREE from 'three';

const LOOK = { color: 0x06c167, height: 60, radius: 1.6, ring: 4.5, opacity: 0.35 };
const ROUTE = { width: 0.8, lateral: 1.4, y: 0.16, dash: 2.2, speed: 5, opacity: 0.55 };

export function createMarkersView({ scene }) {
  const material = new THREE.MeshBasicMaterial({ color: LOOK.color, transparent: true, opacity: LOOK.opacity, depthWrite: false, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(LOOK.radius, LOOK.radius, LOOK.height, 16, 1, true), material);
  beam.position.y = LOOK.height / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(LOOK.ring - 0.6, LOOK.ring, 32).rotateX(-Math.PI / 2), material);
  ring.position.y = 0.08;
  const marker = new THREE.Group().add(beam, ring);
  marker.visible = false;
  scene.add(marker);

  const arrows = chevronTexture();
  const path = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: LOOK.color, map: arrows, transparent: true, opacity: ROUTE.opacity, depthWrite: false }));
  path.renderOrder = 2;
  path.frustumCulled = false;
  scene.add(path);
  let drawn = null;

  return {
    /** `target` é um POI ou `null`; `route` é a rota do GPS (de graph.route) ou `null`. */
    update(target, time, route) {
      marker.visible = !!target;
      path.visible = !!route;
      if (route && route !== drawn) {
        drawn = route;
        path.geometry.dispose();
        path.geometry = ribbon(route.points);
      }
      arrows.offset.x = -time * (ROUTE.speed / ROUTE.dash);
      if (!target) return;
      marker.position.set(target.x, 0, target.z);
      ring.scale.setScalar(1 + 0.12 * Math.sin(time * 4));
    },
  };
}

/** Faixa ao longo dos pontos, deslocada para a mão direita; `u` cresce com a distância (as setas repetem). */
function ribbon(points) {
  const positions = [];
  const uvs = [];
  const index = [];
  let along = 0;
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(i - 1, 0)];
    const next = points[Math.min(i + 1, points.length - 1)];
    const length = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
    const tx = (next.x - prev.x) / length;
    const tz = (next.z - prev.z) / length;
    if (i > 0) along += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    const cx = points[i].x - tz * ROUTE.lateral;
    const cz = points[i].z + tx * ROUTE.lateral;
    const w = ROUTE.width / 2;
    positions.push(cx + tz * w, ROUTE.y, cz - tx * w, cx - tz * w, ROUTE.y, cz + tx * w);
    uvs.push(along / ROUTE.dash, 0, along / ROUTE.dash, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

/** Uma seta ">" por ladrilho; repetida ao longo da faixa. */
function chevronTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  context.strokeStyle = '#fff';
  context.lineWidth = 12;
  context.lineCap = context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(22, 10);
  context.lineTo(44, 32);
  context.lineTo(22, 54);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
