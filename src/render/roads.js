/**
 * Ruas, calçadas, pintura de pista e pontes, tudo gerado por código a partir do `city`.
 * O asfalto e a calçada são a união de um retângulo por via com um disco por cruzamento:
 * como o mapa não é uma grade, isso resolve qualquer ângulo de esquina sem caso especial.
 */
import * as THREE from 'three';
import { createBatch, groundMaterial } from './batch.js';

const LOOK = {
  sidewalk: 0xa9a59c,
  asphalt: 0x3b3d44,
  white: 0xe9e9e4,
  yellow: 0xe7b53c,
  concrete: 0x8d8a84,
  rail: 0xb9b6ae,
};
// Alturas das camadas do chão, de baixo para cima.
const Y = { sidewalk: 0.05, asphalt: 0.1, paint: 0.14 };
const PAINT = { line: 0.15, dash: 3, gap: 5, stopLine: 0.45, zebra: 0.5, zebraLength: 2.6, zebraInset: 0.6 };

export function createRoads(city, cfg) {
  const group = new THREE.Group();
  const sidewalk = createBatch({ uvScale: 5 });
  const asphalt = createBatch({ uvScale: 9 });
  const white = createBatch();
  const yellow = createBatch();

  /** Ponto da via a `s` metros de `a`, deslocado `lateral` metros para a direita. */
  const at = (edge, s, lateral) => {
    const a = city.nodes[edge.a];
    return { x: a.x + edge.dir.x * s - edge.dir.z * lateral, z: a.z + edge.dir.z * s + edge.dir.x * lateral };
  };
  const strip = (batch, edge, from, to, left, right, y) =>
    batch.quad(at(edge, from, left), at(edge, from, right), at(edge, to, right), at(edge, to, left), y);

  for (const edge of city.edges) {
    const wide = edge.halfWidth + cfg.sidewalk;
    strip(sidewalk, edge, 0, edge.length, -wide, wide, Y.sidewalk);
    strip(asphalt, edge, 0, edge.length, -edge.halfWidth, edge.halfWidth, Y.asphalt);
    paintLanes(edge);
    if (edge.bridge) group.add(createBridge(city, cfg, edge));
  }
  for (const node of city.nodes) {
    const widest = Math.max(...node.edges.map((id) => city.edges[id].halfWidth));
    sidewalk.disc(node.x, node.z, widest + cfg.sidewalk, Y.sidewalk);
    asphalt.disc(node.x, node.z, widest, Y.asphalt);
    if (node.signal) node.edges.forEach((id) => paintApproach(node, city.edges[id]));
  }

  function paintLanes(edge) {
    const from = city.nodes[edge.a].radius;
    const to = edge.length - city.nodes[edge.b].radius;
    if (to - from < 2) return;
    const half = PAINT.line / 2;
    const dashes = (lateral) => {
      for (let s = from + 1; s + PAINT.dash <= to; s += PAINT.dash + PAINT.gap) {
        strip(white, edge, s, s + PAINT.dash, lateral - half, lateral + half, Y.paint);
      }
    };
    const laneWidth = edge.halfWidth / edge.lanes;
    if (edge.oneWay) return dashes(0);
    if (edge.lanes === 1) return strip(yellow, edge, from, to, -half, half, Y.paint);
    // Avenida: faixa dupla amarela no meio e tracejado branco entre as faixas de cada sentido.
    for (const side of [-1, 1]) {
      strip(yellow, edge, from, to, side * 0.2 - half, side * 0.2 + half, Y.paint);
      for (let lane = 1; lane < edge.lanes; lane++) dashes(side * lane * laneWidth);
    }
  }

  /** Linha de retenção e faixa de pedestre de uma via que chega num cruzamento com semáforo. */
  function paintApproach(node, edge) {
    const arrivesAtB = edge.b === node.id;
    const toward = arrivesAtB ? -1 : 1; // sentido, ao longo da via, que se afasta do cruzamento
    const stop = arrivesAtB ? edge.length - node.radius : node.radius;
    if (arrivesAtB || !edge.oneWay) {
      const left = edge.oneWay ? -edge.halfWidth : arrivesAtB ? 0 : -edge.halfWidth;
      const right = edge.oneWay ? edge.halfWidth : arrivesAtB ? edge.halfWidth : 0;
      strip(white, edge, stop, stop + toward * PAINT.stopLine, left, right, Y.paint);
    }
    const near = stop - toward * PAINT.zebraInset;
    const far = near - toward * PAINT.zebraLength;
    for (let lateral = -edge.halfWidth + 0.3; lateral + PAINT.zebra <= edge.halfWidth; lateral += PAINT.zebra * 2) {
      strip(white, edge, near, far, lateral, lateral + PAINT.zebra, Y.paint);
    }
  }

  const paint = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 });
  group.add(
    new THREE.Mesh(sidewalk.build(), groundMaterial(LOOK.sidewalk, 0.14, 21)),
    new THREE.Mesh(asphalt.build(), groundMaterial(LOOK.asphalt, 0.3, 22)),
    new THREE.Mesh(white.build(), paint(LOOK.white)),
    new THREE.Mesh(yellow.build(), paint(LOOK.yellow)),
  );
  return group;
}

/** Tabuleiro, guarda-corpos e pilares de uma ponte, alinhados com a via. */
function createBridge(city, cfg, edge) {
  const a = city.nodes[edge.a];
  const b = city.nodes[edge.b];
  const wide = edge.halfWidth + cfg.sidewalk;
  const bridge = new THREE.Group();
  bridge.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
  bridge.rotation.y = -Math.atan2(edge.dir.z, edge.dir.x);

  const concrete = new THREE.MeshStandardMaterial({ color: LOOK.concrete, roughness: 0.9 });
  const rail = new THREE.MeshStandardMaterial({ color: LOOK.rail, roughness: 0.7 });
  const box = (material, sx, sy, sz, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    bridge.add(mesh);
  };
  box(concrete, edge.length, 1.2, wide * 2 + 0.8, 0, -0.6, 0);
  for (const side of [-1, 1]) box(rail, edge.length, 1.1, 0.35, 0, 0.55, side * (wide + 0.2));
  for (const t of [-0.22, 0.22]) box(concrete, 2.2, 5, wide * 1.6, edge.length * t, -3.6, 0);
  return bridge;
}
