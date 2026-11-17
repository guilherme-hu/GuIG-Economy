/** Ajudantes para montar o chão: geometria plana em lote e texturas de ruído feitas em canvas. */
import * as THREE from 'three';
import { createRng } from '../core/rng.js';

/**
 * Acumula triângulos deitados no plano XZ, todos virados para cima, e devolve uma geometria só.
 * As UVs seguem a posição no mundo (1 volta de textura a cada `uvScale` metros), então peças que
 * se sobrepõem mostram exatamente o mesmo desenho.
 */
export function createBatch({ uvScale = 8 } = {}) {
  const positions = [];
  const uvs = [];
  const colors = [];
  let tint = null;

  const vertex = (x, y, z) => {
    positions.push(x, y, z);
    uvs.push(x / uvScale, z / uvScale);
    if (tint) colors.push(tint.r, tint.g, tint.b);
  };

  const batch = {
    /** Cor de vértice das próximas peças (para materiais com `vertexColors`). */
    color(hex) {
      tint = new THREE.Color(hex);
      return batch;
    },
    tri(ax, az, bx, bz, cx, cz, y) {
      const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0;
      vertex(ax, y, az);
      if (up) vertex(bx, y, bz);
      vertex(cx, y, cz);
      if (!up) vertex(bx, y, bz);
    },
    /** Quadrilátero convexo com os cantos dados em volta. */
    quad(p, q, r, s, y) {
      batch.tri(p.x, p.z, q.x, q.z, r.x, r.z, y);
      batch.tri(p.x, p.z, r.x, r.z, s.x, s.z, y);
    },
    disc(x, z, radius, y, segments = 20) {
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const b = ((i + 1) / segments) * Math.PI * 2;
        batch.tri(x, z, x + Math.cos(a) * radius, z + Math.sin(a) * radius, x + Math.cos(b) * radius, z + Math.sin(b) * radius, y);
      }
    },
    build() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      if (colors.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      return geometry;
    },
  };
  return batch;
}

/** Textura quadrada de ruído em torno de uma cor base; `speckle` é a variação de brilho (0..1). */
export function noiseTexture(hex, speckle, seed, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  // O canvas guarda sRGB: os canais saem direto do hexadecimal, sem passar pelo espaço linear do THREE.Color.
  const channels = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const rng = createRng(seed);
  for (let i = 0; i < size * size; i++) {
    const shade = 1 + (rng.next() - 0.5) * speckle;
    channels.forEach((channel, c) => (image.data[i * 4 + c] = Math.min(255, channel * shade)));
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export const groundMaterial = (hex, speckle, seed, extra = {}) =>
  new THREE.MeshStandardMaterial({ map: noiseTexture(hex, speckle, seed), roughness: 0.95, metalness: 0, ...extra });
