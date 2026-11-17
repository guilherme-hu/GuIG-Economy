/** O acidente: clarão, destroços, a moto tombando e o piloto arremessado. Roda em tempo real, fora da simulação. */
import * as THREE from 'three';

const LOOK = {
  gravity: 22,
  flash: { color: 0xffa436, radius: 3.2, time: 0.45 },
  debris: { count: 16, size: [0.06, 0.2], colors: [0x06c167, 0xff5a4e, 0x1b1d26, 0x9aa0ad], speed: [3, 9], lift: [4, 10] },
  rider: { forward: 0.55, minForward: 6, lift: 8.5, spin: 9, rest: 0.25 },
  bike: { forward: 0.3, fall: 6, slide: 16 }, // slide: desaceleração do escorregão, m/s²
};

/** `root` é o grupo da moto (frente em +X); `tilt` leva a moto; `getRider` devolve o piloto quando já carregou. */
export function createCrashView({ root, tilt, getRider }) {
  const bodies = []; // { object, vx, vy, vz, spin, rest }
  let flash = null;
  let age = -1;
  let slide = 0;

  function launch(object, vx, vy, vz, spin, rest) {
    bodies.push({ object, vx, vy, vz, spin, rest });
  }

  return {
    /** Dispara o efeito; `speed` é a velocidade do impacto em m/s. */
    start(speed) {
      age = 0;
      slide = speed * LOOK.bike.forward;

      const rider = getRider();
      if (rider) {
        root.attach(rider); // solta o piloto da moto, mantendo a pose
        launch(rider, Math.max(LOOK.rider.minForward, speed * LOOK.rider.forward), LOOK.rider.lift, rand(-1.5, 1.5), LOOK.rider.spin, LOOK.rider.rest);
      }

      const box = new THREE.BoxGeometry(1, 1, 1);
      for (let i = 0; i < LOOK.debris.count; i++) {
        const piece = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: LOOK.debris.colors[i % LOOK.debris.colors.length] }));
        piece.scale.setScalar(rand(...LOOK.debris.size));
        piece.position.set(0, 0.8, 0);
        root.add(piece);
        const angle = rand(0, Math.PI * 2);
        const out = rand(...LOOK.debris.speed);
        launch(piece, Math.cos(angle) * out + speed * 0.2, rand(...LOOK.debris.lift), Math.sin(angle) * out, rand(4, 14), piece.scale.x / 2);
      }

      flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: LOOK.flash.color, transparent: true, depthWrite: false }));
      flash.position.y = 0.9;
      root.add(flash);
    },

    update(dt) {
      if (age < 0) return;
      age += dt;

      if (flash) {
        const k = age / LOOK.flash.time;
        flash.scale.setScalar(0.4 + k * LOOK.flash.radius);
        flash.material.opacity = Math.max(0, 1 - k);
        if (k >= 1) {
          root.remove(flash);
          flash = null;
        }
      }

      // A moto tomba de lado e escorrega até parar.
      tilt.rotation.x = Math.min(Math.PI / 2, tilt.rotation.x + LOOK.bike.fall * dt);
      tilt.position.x += slide * dt;
      slide = Math.max(0, slide - LOOK.bike.slide * dt);

      for (const body of bodies) {
        if (body.done) continue;
        body.vy -= LOOK.gravity * dt;
        body.object.position.x += body.vx * dt;
        body.object.position.y += body.vy * dt;
        body.object.position.z += body.vz * dt;
        body.object.rotation.z -= body.spin * dt;
        if (body.object.position.y > body.rest || body.vy > 0) continue;
        body.object.position.y = body.rest;
        // Quica uma vez, mais fraco; depois fica no chão.
        if (Math.abs(body.vy) > 3) {
          body.vy = -body.vy * 0.3;
          body.vx *= 0.5;
          body.vz *= 0.5;
          body.spin *= 0.4;
        } else {
          body.done = true;
        }
      }
    },
  };
}

// Efeito só visual: não precisa da seed do mundo.
const rand = (min, max) => min + Math.random() * (max - min);
