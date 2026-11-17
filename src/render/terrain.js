/** Chão com o leito do rio escavado, barrancos e água. */
import * as THREE from 'three';
import { createPolyline } from '../sim/city/geometry.js';
import { createBatch, groundMaterial } from './batch.js';

const LOOK = {
  ground: 0x5f7a45,
  bank: 0x5d6442,
  water: 0x2f6f9c,
  margin: 500, // chão além da borda do mundo, para o horizonte não acabar num degrau
  bankWidth: 4,
  depth: 2.4,
  waterLevel: -1.5,
};

export function createTerrain(city) {
  const group = new THREE.Group();
  const river = createPolyline(extended(city.river.points, LOOK.margin + 100));
  const half = city.river.width / 2;
  const reach = city.size / 2 + LOOK.margin;

  const ground = createBatch({ uvScale: 14 });
  for (const side of [-1, 1]) {
    const bank = river.offset(side * half).points;
    const contour = [...bank, { x: bank.at(-1).x, z: side * reach }, { x: bank[0].x, z: side * reach }];
    const faces = THREE.ShapeUtils.triangulateShape(contour.map((p) => new THREE.Vector2(p.x, p.z)), []);
    for (const [a, b, c] of faces) ground.tri(contour[a].x, contour[a].z, contour[b].x, contour[b].z, contour[c].x, contour[c].z, 0);
    group.add(slope(river.offset(side * half).points, river.offset(side * (half - LOOK.bankWidth)).points));
  }
  group.add(new THREE.Mesh(ground.build(), groundMaterial(LOOK.ground, 0.22, 11)));

  const water = createBatch({ uvScale: 20 });
  const left = river.offset(-half).points;
  const right = river.offset(half).points;
  for (let i = 1; i < left.length; i++) water.quad(left[i - 1], left[i], right[i], right[i - 1], LOOK.waterLevel);
  group.add(new THREE.Mesh(water.build(), new THREE.MeshStandardMaterial({ color: LOOK.water, roughness: 0.25, metalness: 0.1 })));
  return group;
}

/** Estica as duas pontas da linha em `extra` metros, na direção em que ela já ia. */
function extended(points, extra) {
  const stretch = (from, to) => {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    return { x: to.x + ((to.x - from.x) / length) * extra, z: to.z + ((to.z - from.z) / length) * extra };
  };
  return [stretch(points[1], points[0]), ...points, stretch(points.at(-2), points.at(-1))];
}

/** Barranco: faixa inclinada da beira (y = 0) até o fundo do leito. */
function slope(top, bottom) {
  const positions = [];
  for (let i = 1; i < top.length; i++) {
    const corners = [
      [top[i - 1], 0], [top[i], 0], [bottom[i], -LOOK.depth],
      [top[i - 1], 0], [bottom[i], -LOOK.depth], [bottom[i - 1], -LOOK.depth],
    ];
    for (const [p, y] of corners) positions.push(p.x, y, p.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: LOOK.bank, roughness: 1, side: THREE.DoubleSide }));
}
