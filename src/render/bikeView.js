/** A moto e o piloto. Só lê o estado de `sim/bike.js`; frente do modelo em +X. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const LOOK = {
  brand: 0xc8ff2e, // baú do Rapidão
  body: 0xff5a4e,
  dark: 0x1b1d26,
  metal: 0x9aa0ad,
  wheelRadius: 0.3,
  wheelbase: 1.3,
  riderScale: 2.4, // personagem da Kenney → ~1,75 m
  riderModel: 'assets/models/characters/character-male-a.glb',
  riderPose: 'drive',
};

export function createBikeView({ scene, bike }) {
  const root = new THREE.Group(); // posição e direção
  const tilt = new THREE.Group(); // inclinação na curva, em torno do eixo da moto
  root.add(tilt);
  scene.add(root);

  const wheels = buildBike(tilt);
  loadRider(tilt);

  return {
    object: root,
    update() {
      root.position.set(bike.x, 0, bike.z);
      root.rotation.y = -bike.heading;
      tilt.rotation.x = bike.lean;
      const spin = -bike.distance / LOOK.wheelRadius;
      wheels.forEach((wheel) => (wheel.rotation.z = spin));
    },
  };
}

function buildBike(parent) {
  const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
  const add = (geometry, material, x, y, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const half = LOOK.wheelbase / 2;
  const r = LOOK.wheelRadius;

  const tire = new THREE.TorusGeometry(r - 0.07, 0.075, 10, 20);
  const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10).rotateX(Math.PI / 2);
  const wheels = [half, -half].map((x) => {
    const wheel = add(tire, mat(LOOK.dark, { roughness: 0.9 }), x, r);
    wheel.add(new THREE.Mesh(hub, mat(LOOK.metal, { metalness: 0.6 })));
    return wheel;
  });

  add(new RoundedBoxGeometry(0.75, 0.3, 0.26, 3, 0.08), mat(LOOK.dark), 0, 0.52); // motor
  add(new RoundedBoxGeometry(0.5, 0.26, 0.3, 3, 0.1), mat(LOOK.body), 0.2, 0.8); // tanque
  add(new RoundedBoxGeometry(0.62, 0.12, 0.28, 3, 0.05), mat(LOOK.dark, { roughness: 0.95 }), -0.32, 0.82); // banco
  add(new RoundedBoxGeometry(0.34, 0.1, 0.2, 2, 0.04), mat(LOOK.body), -half, r * 2 + 0.06); // paralama traseiro
  const fork = add(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), mat(LOOK.metal, { metalness: 0.6 }), half - 0.14, 0.66);
  fork.rotation.z = 0.38;
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8).rotateX(Math.PI / 2), mat(LOOK.dark), half - 0.3, 1.05); // guidão
  add(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), half - 0.12, 0.92); // farol
  add(new THREE.BoxGeometry(0.03, 0.06, 0.18), new THREE.MeshBasicMaterial({ color: 0xff2a2a }), -half - 0.17, 0.72); // lanterna
  add(new RoundedBoxGeometry(0.5, 0.5, 0.5, 3, 0.05), mat(LOOK.brand, { roughness: 0.45 }), -0.62, 1.2); // baú
  return wheels;
}

function loadRider(parent) {
  new GLTFLoader().load(import.meta.env.BASE_URL + LOOK.riderModel, (gltf) => {
    const rider = gltf.scene;
    rider.scale.setScalar(LOOK.riderScale);
    rider.rotation.y = Math.PI / 2; // modelo olha para +Z; a moto, para +X
    rider.position.set(-0.3, 0.42, 0);
    const clip = gltf.animations.find((a) => a.name === LOOK.riderPose);
    if (clip) {
      const mixer = new THREE.AnimationMixer(rider);
      mixer.clipAction(clip).play();
      mixer.update(0); // pose fixa: sentado, mãos à frente
    }
    parent.add(rider);
  });
}
