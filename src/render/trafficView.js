/** Veículos (modelos instanciados) e semáforos (poste + lâmpada colorida por aproximação). */
import * as THREE from 'three';
import { buildBike } from './bikeView.js';

const LOOK = {
  carYaw: Math.PI / 2, // os carros da Kenney têm a frente em +Z
  pole: { height: 5.2, radius: 0.09, color: 0x2a2d38, offset: 0.9 },
  lamp: { width: 0.42, height: 1.15 },
  camera: { size: 0.7, lift: 1.1, color: 0xff8a1f }, // caixa do radar, acima da lâmpada
  colors: { verde: 0x3dff7a, amarelo: 0xffc93d, vermelho: 0xff3b30 },
  bag: 0xc8ff2e, // o baú, que ganha a cor do app de cada entregador
  apps: [0xff3b30, 0xff8a00, 0x8b3dff, 0x00a8ff, 0xc8ff2e],
  jacket: 0x2b2f3d,
  helmet: 0xe9ecf2,
};

export function createTrafficView({ scene, assets, traffic, fleet }) {
  const dummy = new THREE.Object3D();
  let batches = null; // model → { meshes, scale, count }

  const motos = createMotoBatch(scene, traffic.vehicles.length);
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
      motos.begin();
      for (const v of traffic.vehicles) {
        if (!v.active) continue;
        if (v.type === 'moto') {
          motos.add(v);
          continue;
        }
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
      motos.end();
    },
  };
}

/** Motos do trânsito: a mesma moto do jogador, com um piloto simples e o baú na cor de cada app. */
function createMotoBatch(scene, capacity) {
  const model = new THREE.Group();
  buildBike(model);
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 4, 8), mat(LOOK.jacket));
  torso.position.set(-0.25, 1.25, 0);
  torso.rotation.z = -0.35; // inclinado para a frente
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(LOOK.helmet));
  helmet.position.set(-0.08, 1.68, 0);
  model.add(torso, helmet);
  model.updateMatrixWorld(true);

  const meshes = [];
  let bag = null;
  model.traverse((part) => {
    if (!part.isMesh) return;
    const isBag = part.material.color?.getHex() === LOOK.bag;
    const material = isBag ? part.material.clone() : part.material;
    if (isBag) material.color.set(0xffffff); // a cor vem de cada instância
    const mesh = new THREE.InstancedMesh(part.geometry.clone().applyMatrix4(part.matrixWorld), material, capacity);
    mesh.frustumCulled = false;
    mesh.count = 0;
    meshes.push(mesh);
    if (isBag) bag = mesh;
    scene.add(mesh);
  });

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let count = 0;
  return {
    begin: () => (count = 0),
    add(v) {
      dummy.position.set(v.x, 0, v.z);
      dummy.rotation.y = -v.heading; // a moto tem a frente em +X
      dummy.updateMatrix();
      for (const mesh of meshes) mesh.setMatrixAt(count, dummy.matrix);
      bag.setColorAt(count, color.setHex(LOOK.apps[v.id % LOOK.apps.length]));
      count++;
    },
    end() {
      for (const mesh of meshes) {
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
      }
      if (bag.instanceColor) bag.instanceColor.needsUpdate = true;
    },
  };
}

export function createSignalsView({ scene, city, signals, cameras }) {
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
  // Radar: uma caixa laranja no alto dos postes dos cruzamentos fiscalizados.
  const watched = heads.map((head, i) => i).filter((i) => cameras.has(heads[i].nodeId));
  const boxes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(LOOK.camera.size, LOOK.camera.size * 0.6, LOOK.camera.size).translate(0, LOOK.pole.height + LOOK.camera.lift, 0),
    new THREE.MeshBasicMaterial({ color: LOOK.camera.color }),
    watched.length,
  );
  watched.forEach((head, k) => {
    lamps.getMatrixAt(head, matrix);
    boxes.setMatrixAt(k, matrix);
  });
  scene.add(poles, lamps, boxes);

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
