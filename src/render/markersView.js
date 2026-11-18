/**
 * Marcador do destino atual (coleta ou entrega): coluna de luz visível de longe + anel no chão.
 * E a rota do GPS: setas em 3D, um pouco acima do asfalto e semitransparentes, que correm em direção ao destino.
 */
import * as THREE from 'three';

const LOOK = { color: 0x06c167, height: 60, radius: 1.6, ring: 4.5, opacity: 0.35 };
// spacing: m entre setas; turnLook: m antes e depois usados para virar a seta (suaviza as esquinas)
const UP = new THREE.Vector3(0, 1, 0);
const ROUTE = { lateral: 1.4, y: 0.6, size: 1.1, thickness: 0.05, spacing: 3.5, speed: 5, opacity: 0.45, turnLook: 1.6, max: 1200 };

export function createMarkersView({ scene }) {
  const material = new THREE.MeshBasicMaterial({ color: LOOK.color, transparent: true, opacity: LOOK.opacity, depthWrite: false, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(LOOK.radius, LOOK.radius, LOOK.height, 16, 1, true), material);
  beam.position.y = LOOK.height / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(LOOK.ring - 0.6, LOOK.ring, 32).rotateX(-Math.PI / 2), material);
  ring.position.y = 0.08;
  const marker = new THREE.Group().add(beam, ring);
  marker.visible = false;
  scene.add(marker);

  const arrowMaterial = new THREE.MeshBasicMaterial({ color: LOOK.color, transparent: true, opacity: ROUTE.opacity, depthWrite: false });
  const arrows = new THREE.InstancedMesh(chevronGeometry(), arrowMaterial, ROUTE.max);
  arrows.renderOrder = 2;
  arrows.frustumCulled = false;
  arrows.count = 0;
  scene.add(arrows);
  const path = createPath();
  const matrix = new THREE.Matrix4();
  const forward = new THREE.Vector3();
  const side = new THREE.Vector3();
  const here = { x: 0, z: 0 };
  const behind = { x: 0, z: 0 };
  const ahead = { x: 0, z: 0 };
  let drawn = null;

  return {
    /** `target` é um POI ou `null`; `route` é a rota do GPS (de graph.route) ou `null`. */
    update(target, time, route) {
      marker.visible = !!target;
      arrows.visible = !!route;
      if (route && route !== drawn) {
        drawn = route;
        path.set(route.points);
      }
      if (route) placeArrows(time);
      if (!target) return;
      marker.position.set(target.x, 0, target.z);
      ring.scale.setScalar(1 + 0.12 * Math.sin(time * 4));
    },
  };

  /** As setas andam juntas em direção ao destino, deitadas, cada uma apontando para onde a rota vai logo à frente dela. */
  function placeArrows(time) {
    const shift = (time * ROUTE.speed) % ROUTE.spacing;
    let count = 0;
    for (let d = shift; d < path.length && count < ROUTE.max; d += ROUTE.spacing) {
      path.sample(d, here);
      path.sample(d - ROUTE.turnLook, behind);
      path.sample(d + ROUTE.turnLook, ahead);
      forward.set(ahead.x - behind.x, 0, ahead.z - behind.z).normalize();
      side.crossVectors(forward, UP);
      matrix.makeBasis(forward, UP, side).setPosition(here.x, ROUTE.y, here.z);
      arrows.setMatrixAt(count++, matrix);
    }
    arrows.count = count;
    arrows.instanceMatrix.needsUpdate = true;
  }
}

/**
 * A rota deslocada para a mão direita, com a distância acumulada em cada ponto.
 * `sample(d)` devolve o ponto a `d` metros do começo (busca binária; nada é alocado).
 */
function createPath() {
  let xs = new Float32Array(0);
  let zs = new Float32Array(0);
  let at = new Float32Array(0);
  const path = {
    length: 0,
    set(points) {
      const n = points.length;
      xs = new Float32Array(n);
      zs = new Float32Array(n);
      at = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const prev = points[Math.max(i - 1, 0)];
        const next = points[Math.min(i + 1, n - 1)];
        const length = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
        xs[i] = points[i].x - ((next.z - prev.z) / length) * ROUTE.lateral;
        zs[i] = points[i].z + ((next.x - prev.x) / length) * ROUTE.lateral;
        if (i > 0) at[i] = at[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
      }
      path.length = n ? at[n - 1] : 0;
    },
    sample(d, out) {
      const n = at.length;
      if (n === 0) return out;
      const clamped = Math.min(Math.max(d, 0), path.length);
      let lo = 0;
      let hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (at[mid] <= clamped) lo = mid;
        else hi = mid;
      }
      const span = at[hi] - at[lo] || 1;
      const k = Math.min(1, (clamped - at[lo]) / span);
      out.x = xs[lo] + (xs[hi] - xs[lo]) * k;
      out.z = zs[lo] + (zs[hi] - zs[lo]) * k;
      return out;
    },
  };
  return path;
}

/** Seta ">" com espessura, deitada no plano XZ (face para +Y) e apontando para +X. */
function chevronGeometry() {
  const s = ROUTE.size;
  const arm = s * 0.38; // largura do braço da seta, medida em x
  const shape = new THREE.Shape();
  shape.moveTo(-0.45 * s, 0.6 * s);
  shape.lineTo(0.35 * s, 0);
  shape.lineTo(-0.45 * s, -0.6 * s);
  shape.lineTo(-0.45 * s - arm, -0.6 * s);
  shape.lineTo(0.35 * s - arm, 0);
  shape.lineTo(-0.45 * s - arm, 0.6 * s);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: ROUTE.thickness, bevelEnabled: false });
  return geometry.rotateX(-Math.PI / 2).translate(0, -ROUTE.thickness / 2, 0);
}
