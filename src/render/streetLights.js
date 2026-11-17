/**
 * Postes de rua e a poça de luz que cada um faz no asfalto. A poça é um decalque aditivo (não uma luz de
 * verdade): centenas de postes custam o mesmo que um. `setNight(k)` acende de 0 (dia) a 1 (noite).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LOOK = { cornerGap: 4, curb: 0.6, height: 6.5, arm: 1.6, pole: 0x2a2d38, bulb: 0xffd9a0, pool: 0xffb35c, poolSize: 34, poolOpacity: 0.55 };
// Avenidas bem iluminadas; ruas do Centro, médio; ruas da periferia, postes mais espaçados e luz mais fraca.
const LIGHTING = {
  avenida: { spacing: 22, brightness: 1 },
  centro: { spacing: 28, brightness: 0.7 },
  periferia: { spacing: 40, brightness: 0.45 },
};

export function createStreetLights(city) {
  const spots = lampSpots(city);
  const group = new THREE.Group();

  const pole = new THREE.CylinderGeometry(0.08, 0.11, LOOK.height, 6).translate(0, LOOK.height / 2, 0);
  const arm = new THREE.BoxGeometry(LOOK.arm, 0.08, 0.08).translate(LOOK.arm / 2, LOOK.height - 0.1, 0);
  const poles = new THREE.InstancedMesh(mergeGeometries([pole, arm]), new THREE.MeshStandardMaterial({ color: LOOK.pole, roughness: 0.6 }), spots.length);
  const bulbMaterial = new THREE.MeshBasicMaterial({ color: LOOK.bulb });
  const bulbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.12, 0.3).translate(LOOK.arm - 0.2, LOOK.height - 0.2, 0), bulbMaterial, spots.length);
  const poolMaterial = new THREE.MeshBasicMaterial({ color: LOOK.pool, map: glowTexture(64, SOFT), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(LOOK.poolSize, LOOK.poolSize).rotateX(-Math.PI / 2).translate(LOOK.arm + 1, 0.17, 0), poolMaterial, spots.length);
  pools.renderOrder = 1;

  const dummy = new THREE.Object3D();
  const shade = new THREE.Color();
  spots.forEach((spot, i) => {
    dummy.position.set(spot.x, 0, spot.z);
    dummy.rotation.y = -spot.angle;
    dummy.updateMatrix();
    for (const mesh of [poles, bulbs, pools]) mesh.setMatrixAt(i, dummy.matrix);
    pools.setColorAt(i, shade.setScalar(spot.brightness)); // aditivo: cor mais escura = luz mais fraca
  });
  for (const mesh of [poles, bulbs, pools]) mesh.computeBoundingSphere();
  poles.castShadow = true;
  group.add(poles, bulbs, pools);

  const dark = new THREE.Color(0x3a3a3a);
  const lit = new THREE.Color(LOOK.bulb);
  return {
    group,
    setNight(k) {
      pools.visible = k > 0.01;
      poolMaterial.opacity = k * LOOK.poolOpacity;
      bulbMaterial.color.lerpColors(dark, lit, k);
    },
  };
}

/** Um poste a cada `spacing` metros, alternando os lados da via, longe dos cruzamentos; o braço aponta para a pista. */
function lampSpots(city) {
  const spots = [];
  for (const edge of city.edges) {
    const a = city.nodes[edge.a];
    const { spacing, brightness } = LIGHTING[edge.kind === 'avenida' ? 'avenida' : a.district === 'centro' ? 'centro' : 'periferia'];
    const start = a.radius + LOOK.cornerGap;
    const end = edge.length - city.nodes[edge.b].radius - LOOK.cornerGap;
    const right = { x: -edge.dir.z, z: edge.dir.x };
    if (end < start) continue;
    // centraliza a fileira no trecho livre, para até as vias curtas ganharem um poste
    for (let s = start + ((end - start) % spacing) / 2, i = edge.id; s <= end; s += spacing, i++) {
      const side = i % 2 ? 1 : -1;
      const lateral = side * (edge.halfWidth + LOOK.curb);
      // o braço (+X do poste) aponta para o meio da via: −side × direita
      spots.push({ x: a.x + edge.dir.x * s + right.x * lateral, z: a.z + edge.dir.z * s + right.z * lateral, angle: Math.atan2(-side * right.z, -side * right.x), brightness });
    }
  }
  return spots;
}

// Queda bem gradual, sem miolo forte: a poça se espalha e se funde com a dos postes vizinhos.
const SOFT = [[0, 1], [0.2, 0.75], [0.45, 0.4], [0.7, 0.14], [1, 0]];
const SHARP = [[0, 1], [0.45, 0.45], [1, 0]];

/** Disco com borda suave, para poças de luz e fachos de farol; `stops` = [posição, opacidade]. */
export function glowTexture(size = 64, stops = SHARP) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, alpha] of stops) gradient.addColorStop(at, `rgba(255,255,255,${alpha})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
