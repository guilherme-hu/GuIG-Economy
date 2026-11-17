/**
 * Partículas: fumaça de pneu na freada forte e na curva no limite, faíscas nas batidas.
 * Um único `THREE.Points` com um pool fixo; cada partícula tem cor, opacidade e tamanho próprios.
 */
import * as THREE from 'three';

const POOL = 160;
const SMOKE = { color: 0xd8d4cc, life: 1.1, size: 1.4, grow: 2.2, rate: 40, minSpeed: 6, decel: 15, lean: 0.5, leanSpeed: 14 };
const BURNOUT = { color: 0xffffff, life: 1.35, size: 0.25, grow: 3.5, rate: 24, fade: 0.58 };
const SPARK = { color: 0xffb04a, life: 0.45, size: 0.35, count: 18, speed: 7 };

const SHADER = {
  vertexShader: /* glsl */ `
    attribute float size; attribute float alpha; attribute vec3 tint;
    varying float vAlpha; varying vec3 vTint;
    void main() {
      vAlpha = alpha; vTint = tint;
      vec4 view = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * 600.0 / -view.z;
      gl_Position = projectionMatrix * view;
    }`,
  fragmentShader: /* glsl */ `
    varying float vAlpha; varying vec3 vTint;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      gl_FragColor = vec4(vTint, vAlpha * (1.0 - d * d));
    }`,
};

export function createEffects({ scene, bike }) {
  const geometry = new THREE.BufferGeometry();
  const attr = (name, size) => {
    const a = new THREE.BufferAttribute(new Float32Array(POOL * size), size).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, a);
    return a;
  };
  const position = attr('position', 3);
  const size = attr('size', 1);
  const alpha = attr('alpha', 1);
  const tint = attr('tint', 3);
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({ ...SHADER, transparent: true, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);

  // estado de cada partícula
  const parts = Array.from({ length: POOL }, () => ({ age: 1, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, grow: 0, fade: 1 }));
  let next = 0;
  let lastSpeed = 0;
  let smokeDebt = 0;
  const color = new THREE.Color();

  function emit(x, y, z, vx, vy, vz, kind) {
    const p = parts[next];
    tint.setXYZ(next, ...color.setHex(kind.color).toArray());
    next = (next + 1) % POOL;
    Object.assign(p, { age: 0, life: kind.life * (0.8 + Math.random() * 0.4), x, y, z, vx, vy, vz, size: kind.size, grow: kind.grow ?? 0, fade: kind.fade ?? (kind === SMOKE ? 0.5 : 1) });
  }

  function emitSmoke(dt) {
    const speed = Math.abs(bike.speed);
    const decel = (lastSpeed - speed) / dt;
    lastSpeed = speed;
    const skidding = (speed > SMOKE.minSpeed && decel > SMOKE.decel) || (speed > SMOKE.leanSpeed && Math.abs(bike.lean) > SMOKE.lean);
    if (bike.burnout) {
      const dx = Math.cos(bike.heading);
      const dz = Math.sin(bike.heading);
      smokeDebt += BURNOUT.rate * dt;
      for (; smokeDebt >= 1; smokeDebt--) {
        const drift = (Math.random() - 0.5) * 0.6;
        const back = 1.3 + Math.random();
        emit(bike.x - dx * 0.65, 0.08, bike.z - dz * 0.65,
          -dx * back - dz * drift, 0.45 + Math.random() * 0.4, -dz * back + dx * drift, BURNOUT);
      }
      return;
    }
    if (!skidding && !bike.rearLocked) return;
    smokeDebt += SMOKE.rate * dt;
    for (; smokeDebt >= 1; smokeDebt--) {
      const back = 0.7;
      emit(bike.x - Math.cos(bike.heading) * back, 0.25, bike.z - Math.sin(bike.heading) * back, (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2, SMOKE);
    }
  }

  return {
    /** Faíscas na frente da moto (batida). */
    sparks() {
      const fx = bike.x + Math.cos(bike.heading) * 0.9;
      const fz = bike.z + Math.sin(bike.heading) * 0.9;
      for (let i = 0; i < SPARK.count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = SPARK.speed * (0.4 + Math.random() * 0.6);
        emit(fx, 0.7, fz, Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s, SPARK);
      }
    },
    update(dt, riding) {
      if (riding && dt > 0) emitSmoke(dt);
      for (let i = 0; i < POOL; i++) {
        const p = parts[i];
        if (p.age >= p.life) {
          alpha.setX(i, 0);
          continue;
        }
        p.age += dt;
        p.vy -= p.grow ? -0.3 * dt : 9.8 * dt; // fumaça sobe devagar; faísca cai
        p.x += p.vx * dt;
        p.y = Math.max(0.05, p.y + p.vy * dt);
        p.z += p.vz * dt;
        const t = Math.min(p.age / p.life, 1);
        position.setXYZ(i, p.x, p.y, p.z);
        size.setX(i, p.size * (1 + p.grow * t));
        alpha.setX(i, p.fade * (1 - t));
      }
      for (const a of [position, size, alpha, tint]) a.needsUpdate = true;
    },
  };
}
