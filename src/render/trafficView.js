/** Veículos (modelos instanciados) e semáforos (poste + lâmpada colorida por aproximação). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildBike } from './bikeView.js';
import { glowTexture } from './streetLights.js';

const LOOK = {
  carYaw: Math.PI / 2, // os carros da Kenney têm a frente em +Z
  signal: { height: 6, curb: 0.9, color: 0x1e2029, housing: { w: 0.7, h: 1.95, d: 0.42 }, lens: 0.24, lensGap: 0.6 },
  radar: 0xff8a1f, // caixa laranja do radar, no alto do poste
  colors: { verde: 0x3dff7a, amarelo: 0xffc93d, vermelho: 0xff3b30 },
  off: { verde: 0x10261a, amarelo: 0x2b2310, vermelho: 0x2e1210 }, // lente apagada: escura, para só a acesa chamar atenção
  bag: 0xc8ff2e, // o baú, que ganha a cor do app de cada entregador
  apps: [0xff3b30, 0xff8a00, 0x8b3dff, 0x00a8ff, 0xc8ff2e],
  jacket: 0x2b2f3d,
  helmet: 0xe9ecf2,
};

export function createTrafficView({ scene, assets, traffic, fleet }) {
  const dummy = new THREE.Object3D();
  let batches = null; // model → { meshes, scale, count }

  const motos = createMotoBatch(scene, traffic.vehicles.length);
  const lights = createCarLights(scene, traffic.vehicles.length);
  assets.loadAll([...new Set(fleet.map((kind) => kind.model))]).then((models) => {
    batches = new Map();
    for (const kind of fleet) {
      const { parts, box } = models.get(kind.model);
      const meshes = parts.map((part) => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, traffic.vehicles.length);
        mesh.frustumCulled = false; // as instâncias se espalham em volta do jogador
        mesh.castShadow = true;
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
      lights.begin();
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
        lights.add(v);
      }
      for (const batch of batches.values()) {
        for (const mesh of batch.meshes) {
          mesh.count = batch.count;
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
      motos.end();
      lights.end();
    },
    setNight: lights.setNight,
  };
}

/**
 * Faróis e lanternas dos carros (sempre visíveis, mais fortes à noite) e o facho do farol no asfalto (só à noite).
 * As lâmpadas são feitas num carro de 1 × 1 m e esticadas para o comprimento e a largura de cada veículo.
 */
function createCarLights(scene, capacity) {
  const lamp = (x, z, color) => {
    const box = new THREE.BoxGeometry(0.02, 0.14, 0.18).translate(x, 0.68, z);
    const rgb = new THREE.Color(color);
    box.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: box.attributes.position.count }, () => rgb.toArray()).flat(), 3));
    return box;
  };
  const geometry = mergeGeometries([lamp(0.5, 0.32, 0xfff1cf), lamp(0.5, -0.32, 0xfff1cf), lamp(-0.5, 0.36, 0xff2a1a), lamp(-0.5, -0.36, 0xff2a1a)]);
  const lampMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lamps = new THREE.InstancedMesh(geometry, lampMaterial, capacity);
  const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xfff0c8, map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const beams = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 5).rotateX(-Math.PI / 2).translate(6, 0.18, 0), beamMaterial, capacity);
  beams.renderOrder = 1;
  for (const mesh of [lamps, beams]) {
    mesh.frustumCulled = false;
    mesh.count = 0;
  }
  scene.add(lamps, beams);

  const dummy = new THREE.Object3D();
  let count = 0;
  return {
    begin: () => (count = 0),
    add(v) {
      dummy.position.set(v.x, 0, v.z);
      dummy.rotation.y = -v.heading;
      dummy.scale.set(v.length, 1, v.width);
      dummy.updateMatrix();
      lamps.setMatrixAt(count, dummy.matrix);
      dummy.position.set(v.x + Math.cos(v.heading) * v.length * 0.5, 0, v.z + Math.sin(v.heading) * v.length * 0.5);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beams.setMatrixAt(count, dummy.matrix);
      count++;
    },
    end() {
      for (const mesh of [lamps, beams]) {
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    setNight(k) {
      lampMaterial.color.setScalar(0.35 + k * 1.4);
      beams.visible = k > 0.01;
      beamMaterial.opacity = k * 0.3;
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
    mesh.castShadow = true;
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

/**
 * Semáforo de braço, como os brasileiros: poste na calçada da direita de quem chega, braço por cima da pista
 * e a caixa pendurada sobre as faixas dessa aproximação. As lentes ficam só na frente da caixa: de trás e de
 * lado você vê só a caixa escura, então cada semáforo só "fala" com a pista dele.
 */
export function createSignalsView({ scene, city, signals, cameras }) {
  const { heads } = signals;
  const S = LOOK.signal;
  const count = heads.length;
  const dark = new THREE.MeshStandardMaterial({ color: S.color, roughness: 0.6 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, S.height, 8).translate(0, S.height / 2, 0), dark, count);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.14, 0.14), dark, count);
  const housings = new THREE.InstancedMesh(new RoundedBoxGeometry(S.housing.w, S.housing.h, S.housing.d, 2, 0.06), dark, count);
  const visor = new THREE.CylinderGeometry(S.lens * 1.15, S.lens * 1.15, 0.22, 12, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 0, 0.11);
  const visors = new THREE.InstancedMesh(visor, new THREE.MeshStandardMaterial({ color: S.color, side: THREE.DoubleSide }), count * 3);
  // Lente: um disco virado para quem chega (só a face da frente é desenhada). Uma malha por posição: vermelho, amarelo, verde.
  const lenses = ['vermelho', 'amarelo', 'verde'].map(() => new THREE.InstancedMesh(new THREE.CircleGeometry(S.lens, 20), new THREE.MeshBasicMaterial(), count));
  const watched = heads.map((_, i) => i).filter((i) => cameras.has(heads[i].nodeId));
  const radars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: LOOK.radar }), watched.length);

  const base = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const place = (mesh, i, x, y, z, sx = 1) => mesh.setMatrixAt(i, out.multiplyMatrices(base, local.makeScale(sx, 1, 1).setPosition(x, y, z)));
  const headY = S.height - S.housing.h / 2 - 0.1;
  const lensY = [S.lensGap, 0, -S.lensGap];

  heads.forEach(({ nodeId, edgeId }, i) => {
    const node = city.nodes[nodeId];
    const edge = city.edges[edgeId];
    const into = edge.b === nodeId ? 1 : -1; // sentido de quem chega no cruzamento
    const dx = edge.dir.x * into;
    const dz = edge.dir.z * into;
    // Referencial do semáforo: origem na linha de retenção, +X para a direita de quem chega, +Z de frente para ele.
    base.makeRotationY(Math.atan2(-dx, -dz)).setPosition(node.x - dx * node.radius, 0, node.z - dz * node.radius);
    const poleX = edge.halfWidth + S.curb;
    const headX = edge.oneWay ? 0 : edge.halfWidth / 2; // sobre o meio das faixas de quem chega
    place(poles, i, poleX, 0, 0);
    place(arms, i, (poleX + headX) / 2, S.height, 0, poleX - headX + 0.3);
    place(housings, i, headX, headY, 0);
    lensY.forEach((y, k) => {
      place(lenses[k], i, headX, headY + y, S.housing.d / 2 + 0.01);
      place(visors, i * 3 + k, headX, headY + y, S.housing.d / 2);
    });
    const r = watched.indexOf(i);
    if (r >= 0) place(radars, r, poleX - 0.2, S.height + 0.45, 0.1);
  });
  scene.add(poles, arms, housings, visors, ...lenses, radars);

  const color = new THREE.Color();
  const shown = new Array(count).fill('');
  const slots = ['vermelho', 'amarelo', 'verde'];
  return {
    update() {
      let changed = false;
      heads.forEach(({ nodeId, edgeId }, i) => {
        const state = signals.stateFor(nodeId, edgeId);
        if (state === shown[i]) return;
        shown[i] = state;
        slots.forEach((slot, k) => lenses[k].setColorAt(i, color.setHex(slot === state ? LOOK.colors[slot] : LOOK.off[slot])));
        changed = true;
      });
      if (changed) for (const lens of lenses) lens.instanceColor.needsUpdate = true;
    },
  };
}
