/**
 * Luzes baratas: nada aqui cria PointLight. O brilho vem de cor HDR (> 1) que o bloom da cena espalha.
 * - `createGlowPoints`: halos voltados para a câmera (lâmpada de poste, farol, lente de semáforo acesa).
 * - `createLightPools`: poça de luz no chão embaixo do poste.
 * - `createEmissiveMaterial`: material aceso para malhas (lente de semáforo, letreiro).
 */
import * as THREE from 'three';

let softDot = null;

/** Disco branco com borda suave, gerado em canvas e compartilhado. */
function softDotTexture() {
  if (softDot) return softDot;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  softDot = new THREE.CanvasTexture(canvas);
  return softDot;
}

const color = new THREE.Color();

/**
 * Até `capacity` halos de mesmo tamanho (`size`, em metros). Um draw call.
 * `set(i, x, y, z, cor, intensidade)`; intensidade 0 apaga. Chame `commit()` depois de mexer.
 * `intensity` (setter) escala todos de uma vez, ex.: `scene.onNightChange((n) => (glow.intensity = n))`.
 */
export function createGlowPoints(capacity, { size = 1.5 } = {}) {
  const positions = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
  const colors = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colors);
  geometry.setDrawRange(0, 0);
  const material = new THREE.PointsMaterial({
    size,
    map: softDotTexture(),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false, // luz atravessa a neblina
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    object: points,
    get count() {
      return geometry.drawRange.count;
    },
    set count(n) {
      geometry.setDrawRange(0, Math.min(n, capacity));
    },
    set intensity(k) {
      material.color.setScalar(k);
    },
    set(i, x, y, z, hex = 0xffffff, intensity = 1) {
      positions.setXYZ(i, x, y, z);
      color.set(hex).multiplyScalar(intensity);
      colors.setXYZ(i, color.r, color.g, color.b);
      if (i >= geometry.drawRange.count) geometry.setDrawRange(0, i + 1);
    },
    commit() {
      positions.needsUpdate = colors.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

const matrix = new THREE.Matrix4();

/**
 * Poças de luz no chão (discos aditivos). `set(i, x, z, raio, cor, intensidade)`.
 * `intensity` (setter) escala todas, ex.: com o `nightFactor`.
 */
export function createLightPools(capacity, { y = 0.04 } = {}) {
  const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: softDotTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.count = 0;
  mesh.frustumCulled = false;

  return {
    object: mesh,
    get count() {
      return mesh.count;
    },
    set count(n) {
      mesh.count = Math.min(n, capacity);
    },
    set intensity(k) {
      material.color.setScalar(k);
    },
    set(i, x, z, radius, hex = 0xffd9a0, intensity = 1) {
      mesh.setMatrixAt(i, matrix.makeScale(radius, 1, radius).setPosition(x, y, z));
      mesh.setColorAt(i, color.set(hex).multiplyScalar(intensity));
      if (i >= mesh.count) mesh.count = i + 1;
    },
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

/** Material aceso (sem luz da cena). `intensity` > 1 entra no bloom. Para apagar: `material.color.setScalar(0.05)`. */
export function createEmissiveMaterial(hex, intensity = 3) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) });
}
