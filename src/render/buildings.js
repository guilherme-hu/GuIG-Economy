/** O que ocupa os lotes: o piso de cada um, os prédios (modelos instanciados) e as árvores das praças. */
import * as THREE from 'three';
import { createRng } from '../core/rng.js';
import { createBatch } from './batch.js';

// Metros por unidade do modelo. Nessa escala as portas dos kits ficam com altura de porta.
const SCALE = { casa: 11, predio: 13, 'arranha-ceu': 14, galpao: 13, tree: 11 };
const FIT = { min: 0.75, max: 1.2 }; // quanto o modelo pode encolher ou crescer para caber no lote
const PAD = { casa: 0x7f9458, predio: 0x9b968d, 'arranha-ceu': 0x9b968d, galpao: 0x7d7a73, praca: 0x5c9447 };
const PAD_Y = 0.02;
const CHUNK = 120; // lado, em metros, dos blocos em que as instâncias são agrupadas para o descarte fora da tela

const list = (folder, prefix, letters) => [...letters].map((letter) => `${folder}/${prefix}${letter}`);
const MODELS = {
  predio: list('commercial', 'building-', 'abcdefghiklm'),
  'arranha-ceu': list('commercial', 'building-skyscraper-', 'abcde'),
  casa: list('suburban', 'building-type-', 'abcdfgkmqs'),
  galpao: list('industrial', 'building-', 'abegkmprst'),
};
const TREES = ['suburban/tree-large', 'suburban/tree-small'];

/** Eixos do lote: `u` aponta para a rua (fundo → frente), `v` corre ao longo da fachada. */
const axes = (lot) => ({ ux: Math.cos(lot.heading), uz: Math.sin(lot.heading), vx: -Math.sin(lot.heading), vz: Math.cos(lot.heading) });
const inLot = (lot, u, v) => {
  const { ux, uz, vx, vz } = axes(lot);
  return { x: lot.x + ux * u + vx * v, z: lot.z + uz * u + vz * v };
};

/** Um retângulo colorido por lote: gramado, calçamento, pátio ou praça. */
export function createLotPads(city) {
  const pads = createBatch();
  for (const lot of city.lots) {
    const u = lot.d / 2;
    const v = lot.w / 2;
    pads.color(PAD[lot.kind]).quad(inLot(lot, u, v), inLot(lot, u, -v), inLot(lot, -u, -v), inLot(lot, -u, v), PAD_Y);
  }
  return new THREE.Mesh(pads.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
}

/**
 * Janelas acesas à noite. Nos atlas da Kenney o vidro usa a faixa azul-clara (x 320–384, y 128–256 de 512);
 * esta textura só tem essa faixa clara, então usada como `emissiveMap` só as janelas brilham.
 */
export function windowGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, 512, 512);
  context.fillStyle = '#ffcf86';
  context.fillRect(320, 128, 64, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false; // como as texturas do glTF
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Carrega os modelos e devolve um grupo com um InstancedMesh por peça de modelo. */
export async function createBuildings(city, assets) {
  const models = await assets.loadAll([...Object.values(MODELS).flat(), ...TREES]);
  // Um InstancedMesh só é descartado inteiro quando sai da tela. Agrupar por bloco do mapa (e não só
  // por modelo) deixa a placa de vídeo pular os quarteirões que a câmera não está vendo.
  const placements = new Map(); // "path|bloco" → matrizes
  const place = (path, matrix) => {
    const key = `${path}|${Math.floor(matrix.elements[12] / CHUNK)},${Math.floor(matrix.elements[14] / CHUNK)}`;
    if (!placements.has(key)) placements.set(key, []);
    placements.get(key).push(matrix);
  };

  for (const lot of city.lots) {
    if (lot.kind === 'praca') plantTrees(lot, models, place);
    else place(...fitBuilding(lot, models));
  }

  const group = new THREE.Group();
  for (const [key, matrices] of placements) {
    for (const part of models.get(key.split('|')[0]).parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
  }
  return group;
}

/** Escolhe, pela seed do lote, um modelo do tipo certo que caiba; devolve [path, matriz]. */
function fitBuilding(lot, models) {
  const base = SCALE[lot.kind];
  const options = MODELS[lot.kind].map((path) => {
    const size = models.get(path).box.getSize(new THREE.Vector3());
    return { path, fit: Math.min(lot.w / (size.x * base), lot.d / (size.z * base)) };
  });
  const fitting = options.filter((option) => option.fit >= 1);
  const pool = fitting.length ? fitting : [options.reduce((best, option) => (option.fit > best.fit ? option : best))];
  const { path, fit } = pool[lot.seed % pool.length];
  const scale = base * Math.min(Math.max(fit, FIT.min), FIT.max);
  // Nos kits da Kenney a fachada (vitrine, garagem) fica em −Z; `heading` é para onde ela olha.
  return [path, standing(models.get(path).box, lot.x, lot.z, -Math.PI / 2 - lot.heading, scale)];
}

/** Matriz que põe o modelo de pé no chão em (x, z), centrado, girado em torno de Y e escalado. */
function standing(box, x, z, angle, scale) {
  const center = box.getCenter(new THREE.Vector3());
  const toOrigin = new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z);
  const pose = new THREE.Matrix4().compose(
    new THREE.Vector3(x, PAD_Y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
    new THREE.Vector3(scale, scale, scale),
  );
  return pose.multiply(toOrigin);
}

function plantTrees(lot, models, place) {
  const rng = createRng(lot.seed);
  const count = rng.int(4, 8);
  for (let i = 0; i < count; i++) {
    const spot = inLot(lot, rng.range(-lot.d / 2 + 3, lot.d / 2 - 3), rng.range(-lot.w / 2 + 3, lot.w / 2 - 3));
    const path = rng.pick(TREES);
    place(path, standing(models.get(path).box, spot.x, spot.z, rng.range(0, Math.PI * 2), SCALE.tree * rng.range(0.9, 1.5)));
  }
}
