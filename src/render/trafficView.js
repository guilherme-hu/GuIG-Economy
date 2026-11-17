/** Veículos (modelos instanciados) e semáforos (poste + lâmpada colorida por aproximação). */
import * as THREE from 'three';

const LOOK = {
  carYaw: Math.PI / 2, // os carros da Kenney têm a frente em +Z
  pole: { height: 5.2, radius: 0.09, color: 0x2a2d38, offset: 0.9 },
  lamp: { width: 0.42, height: 1.15 },
  colors: { verde: 0x3dff7a, amarelo: 0xffc93d, vermelho: 0xff3b30 },
};

export function createTrafficView({ scene, assets, traffic, fleet }) {
  const dummy = new THREE.Object3D();
  let batches = null; // model → { meshes, scale, count }

  assets.loadAll([...new Set(fleet.map((kind) => kind.model))]).then((models) => {
    batches = new Map();
    for (const kind of fleet) {
      const { parts, box } = models.get(kind.model);
      const meshes = parts.map((part) => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, traffic.vehicles.length);
        mesh.frustumCulled = false; // as instâncias se espalham em volta do jogador
        scene.add(mesh);
        return mesh;
      });
      batches.set(kind.model, { meshes, scale: kind.length / (box.max.z - box.min.z), count: 0 });
    }
  });

  return {
    update() {
      if (!batches) return;
      for (const batch of batches.values()) batch.count = 0;
      for (const v of traffic.vehicles) {
        if (!v.active) continue;
        const batch = batches.get(v.model);
        dummy.position.set(v.x, 0, v.z);
        dummy.rotation.y = LOOK.carYaw - v.heading;
        dummy.scale.setScalar(batch.scale);
        dummy.updateMatrix();
        for (const mesh of batch.meshes) mesh.setMatrixAt(batch.count, dummy.matrix);
        batch.count++;
      }
      for (const batch of batches.values()) {
        for (const mesh of batch.meshes) {
          mesh.count = batch.count;
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    },
  };
}

export function createSignalsView({ scene, city, signals }) {
  const heads = signals.heads;
  const poles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(LOOK.pole.radius, LOOK.pole.radius, LOOK.pole.height, 6).translate(0, LOOK.pole.height / 2, 0),
    new THREE.MeshStandardMaterial({ color: LOOK.pole.color }),
    heads.length,
  );
  const lamps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(LOOK.lamp.width, LOOK.lamp.height, LOOK.lamp.width).translate(0, LOOK.pole.height, 0),
    new THREE.MeshBasicMaterial(),
    heads.length,
  );
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const shown = new Array(heads.length).fill('');

  heads.forEach(({ nodeId, edgeId }, i) => {
    const node = city.nodes[nodeId];
    const edge = city.edges[edgeId];
    const into = edge.b === nodeId ? 1 : -1; // sentido de quem chega no cruzamento
    const dx = edge.dir.x * into;
    const dz = edge.dir.z * into;
    const side = edge.halfWidth + LOOK.pole.offset; // à direita de quem chega
    matrix.makeTranslation(node.x - dx * node.radius - dz * side, 0, node.z - dz * node.radius + dx * side);
    poles.setMatrixAt(i, matrix);
    lamps.setMatrixAt(i, matrix);
  });
  scene.add(poles, lamps);

  return {
    update() {
      let changed = false;
      heads.forEach(({ nodeId, edgeId }, i) => {
        const state = signals.stateFor(nodeId, edgeId);
        if (state === shown[i]) return;
        shown[i] = state;
        lamps.setColorAt(i, color.setHex(LOOK.colors[state]));
        changed = true;
      });
      if (changed) lamps.instanceColor.needsUpdate = true;
    },
  };
}
