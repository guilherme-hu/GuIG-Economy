/**
 * Carregador dos modelos CC0 da Kenney (`public/assets/models/<kit>/<nome>.glb`).
 * Chave = `'<kit>/<nome>'`, ex.: `'cars/sedan'`, `'commercial/building-a'`.
 *
 * O QUE SABER DOS MODELOS (unidades nativas; multiplique por `config.render.modelScale[kit]` para metros)
 * - Origem: no chão (y = 0), centrada em XZ. Exceções: peças soltas (`wheel-*`, `*-object-*`) têm origem no centro;
 *   alguns galpões industriais (c, f, h, i, j, l, n, o, q) são descentrados — use `info(key).center`.
 * - Carros: frente em **+Z**. Para um `heading` da sim: `rotationY = Math.PI / 2 - heading`.
 *   Nativo ~1,5 de largura × 2,55–3,45 de comprimento (sedan 2,55; van 2,75; delivery 3,25; garbage-truck 3,45).
 *   Com escala 1,65 o sedan fica com 4,2 m. Rodas são nós filhos (`wheel-front-left`…); em `instanced` já vêm assadas.
 *   Não há ônibus: `cars/delivery` (baú) esticado em Z faz o papel; caminhões: `truck`, `truck-flat`, `delivery-flat`, `garbage-truck`.
 * - Prédios (commercial/suburban/industrial): um andar = 0,4 ⇒ escala 7,5 dá 3 m por andar. Fachadas nos quatro lados.
 *   commercial a–n: 0,9–2,3 de largura, 0,9–3,2 de altura; skyscraper a–e: ~1,3 × 2,9–5,5. suburban: ~1,3 × 0,75–1,25 × 1,0.
 * - Rua (street): outra escala (×10,4). Poste `light-curved` 0,67 de altura, braço para **−Z**, lâmpada em (0, 0,65, −0,15).
 *   Semáforo `traffic-light` 0,51 de altura, lentes viradas para **−X** em x = −0,055: vermelha y 0,475, amarela 0,435, verde 0,395.
 * - Personagens: ~0,7–0,8 de altura (×2,4 ≈ 1,75 m), frente em +Z, com esqueleto e 32 animações
 *   (`idle`, `walk`, `sprint`, `sit`, `drive`, `die`, `emote-yes`…). Use `clone` + `THREE.AnimationMixer(obj)`
 *   com `obj.animations`; não servem para `instanced`.
 *
 * Todos os modelos de um kit dividem UM material (o atlas `Textures/colormap.png` é o mesmo), então
 * `instanced` funde as sub-malhas numa geometria só: um draw call por modelo.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const letters = (prefix, from, to) =>
  Array.from({ length: to.charCodeAt(0) - from.charCodeAt(0) + 1 }, (_, i) => prefix + String.fromCharCode(from.charCodeAt(0) + i));

const NAMES = {
  cars: `ambulance box cone delivery delivery-flat firetruck garbage-truck hatchback-sports police sedan sedan-sports suv
    suv-luxury taxi truck truck-flat van wheel-dark wheel-default wheel-truck`.split(/\s+/),
  characters: `character-female-a character-female-b character-female-c character-male-a character-male-b
    character-male-c character-worker`.split(/\s+/),
  commercial: [
    ...letters('building-', 'a', 'n'),
    ...letters('building-skyscraper-', 'a', 'e'),
    ...`detail-awning detail-awning-wide detail-overhang detail-overhang-wide detail-parasol-a detail-parasol-b`.split(' '),
  ],
  industrial: [
    ...letters('building-', 'a', 't'),
    ...`chimney-basic chimney-large chimney-medium chimney-small detail-tank detail-tank-large shipping-container-a
      shipping-container-b shipping-container-c water-tower`.split(/\s+/),
  ],
  street: `bridge-pillar bridge-pillar-wide construction-barrier construction-cone construction-fence construction-light
    dumpster electricity-pole electricity-pole-single electricity-pole-wide light-curved light-curved-cross
    light-curved-double light-square light-square-cross light-square-double road-sign-empty road-sign-empty-hanging
    road-sign-object-stop road-sign-object-street road-sign-object-warning road-sign-stop road-sign-street
    road-sign-warning sign-highway sign-highway-detailed sign-highway-wide traffic-light traffic-light-hanging
    traffic-light-object-hanging traffic-light-object-horizontal traffic-light-object-vertical`.split(/\s+/),
  suburban: [
    ...letters('building-type-', 'a', 'u'),
    ...`fence fence-1x2 fence-1x3 fence-1x4 fence-2x2 fence-2x3 fence-3x2 fence-3x3 fence-low planter tree-large
      tree-small`.split(/\s+/),
  ],
};
const KEYS = Object.entries(NAMES).flatMap(([kit, names]) => names.map((name) => `${kit}/${name}`));

// O GLTFLoader não precisa baixar o colormap de cada GLB: o material do kit substitui o dele.
const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

/**
 * @param {object} renderConfig `config.render` (usa `kits` e `windowColors`: o que acende à noite)
 * @param {string} [baseUrl] pasta dos modelos
 */
export function createAssets({ kits = {}, windowColors } = {}, baseUrl = `${import.meta.env.BASE_URL}assets/models/`) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (url.endsWith('colormap.png') ? BLANK_PIXEL : url));
  const loader = new GLTFLoader(manager);
  const kitPromises = new Map();
  const modelPromises = new Map();
  const kitMaterials = new Map();
  const models = new Map();

  function loadKit(kit) {
    if (!kitPromises.has(kit)) kitPromises.set(kit, buildKit(kit));
    return kitPromises.get(kit);
  }

  async function buildKit(kit) {
    const image = await new THREE.ImageLoader().loadAsync(`${baseUrl}${kit}/Textures/colormap.png`);
    const material = new THREE.MeshLambertMaterial({ map: atlasTexture(image, THREE.SRGBColorSpace) });
    const night = kits[kit];
    if (night) {
      material.emissiveMap = atlasTexture(glowCanvas(image, night.glow), THREE.SRGBColorSpace);
      material.emissive.set(0xffffff);
      material.emissiveIntensity = 0;
      material.userData.nightIntensity = night.intensity;
      if (night.windows) randomizeWindows(material, night.windows, windowColors);
    }
    kitMaterials.set(kit, material);
    return material;
  }

  function loadModel(key) {
    if (!modelPromises.has(key)) modelPromises.set(key, buildModel(key));
    return modelPromises.get(key);
  }

  async function buildModel(key) {
    const kit = key.split('/')[0];
    const [material, gltf] = await Promise.all([loadKit(kit), loader.loadAsync(`${baseUrl}${key}.glb`)]);
    const root = gltf.scene;
    root.animations = gltf.animations;
    root.updateMatrixWorld(true);
    const parts = [];
    let skinned = false;
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.material = material;
      node.castShadow = node.receiveShadow = true;
      node.geometry.deleteAttribute('tangent');
      if (node.isSkinnedMesh) skinned = true;
      else parts.push(node.geometry.clone().applyMatrix4(node.matrixWorld));
    });
    const geometry = skinned ? null : mergeGeometries(parts);
    geometry?.computeBoundingBox();
    const box = geometry ? geometry.boundingBox : new THREE.Box3().setFromObject(root);
    models.set(key, { root, geometry, material, info: boxInfo(box) });
  }

  function model(key) {
    const found = models.get(key);
    if (!found) throw new Error(`Modelo não carregado: ${key} (chame assets.load antes)`);
    return found;
  }

  /** Carrega os modelos pedidos (com cache). `onProgress(prontos, total)`. */
  function load(keys, onProgress) {
    let done = 0;
    return Promise.all(keys.map((key) => loadModel(key).then(() => onProgress?.(++done, keys.length))));
  }

  /** Cópia da hierarquia original (nós com nome, rodas separadas). Personagens vêm com `animations`. */
  function clone(key) {
    const { root, geometry } = model(key);
    return geometry ? root.clone() : cloneSkinned(root);
  }

  /**
   * Um `InstancedMesh` com a geometria do modelo já fundida.
   * Todas as instâncias entram num só volume de corte: para objetos espalhados pela cidade, crie um por setor.
   */
  function instanced(key, capacity, { castShadow = true, receiveShadow = true } = {}) {
    const { geometry, material } = model(key);
    if (!geometry) throw new Error(`${key} tem esqueleto: use clone()`);
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.count = 0;
    const matrices = mesh.instanceMatrix.array;
    const tint = new THREE.Color();
    return {
      object: mesh,
      get count() {
        return mesh.count;
      },
      set count(n) {
        mesh.count = Math.min(n, capacity);
      },
      /** `scale`: número ou `{x, y, z}`. Rotação só em Y (radianos). */
      setTransform(i, x, y, z, rotationY = 0, scale = 1) {
        const sx = scale.x ?? scale;
        const sy = scale.y ?? scale;
        const sz = scale.z ?? scale;
        const cos = Math.cos(rotationY);
        const sin = Math.sin(rotationY);
        const o = i * 16;
        matrices[o] = cos * sx;
        matrices[o + 1] = 0;
        matrices[o + 2] = -sin * sx;
        matrices[o + 3] = 0;
        matrices[o + 4] = 0;
        matrices[o + 5] = sy;
        matrices[o + 6] = 0;
        matrices[o + 7] = 0;
        matrices[o + 8] = sin * sz;
        matrices[o + 9] = 0;
        matrices[o + 10] = cos * sz;
        matrices[o + 11] = 0;
        matrices[o + 12] = x;
        matrices[o + 13] = y;
        matrices[o + 14] = z;
        matrices[o + 15] = 1;
        if (i >= mesh.count) mesh.count = i + 1;
      },
      /** Multiplica o atlas pela cor (tinge o modelo inteiro). */
      setColor(i, color) {
        mesh.setColorAt(i, tint.set(color));
      },
      commit() {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
      },
      dispose() {
        mesh.dispose();
      },
    };
  }

  /** Caixa do modelo em unidades nativas: `{ size, min, max, center }`, cada um `{x, y, z}`. */
  const info = (key) => model(key).info;

  const listKeys = (prefix = '') => KEYS.filter((key) => key.startsWith(prefix));

  /** Material compartilhado de um kit já carregado (para malhas próprias que usem o mesmo atlas). */
  const material = (kit) => kitMaterials.get(kit);

  /** Materiais que acendem à noite: passe cada um a `scene.registerNightMaterial(material, intensity)`. */
  const nightMaterials = () =>
    [...kitMaterials.values()]
      .filter((mat) => mat.userData.nightIntensity)
      .map((mat) => ({ material: mat, intensity: mat.userData.nightIntensity }));

  function dispose() {
    for (const { geometry, root } of models.values()) {
      geometry?.dispose();
      root.traverse((node) => node.geometry?.dispose());
    }
    for (const mat of kitMaterials.values()) {
      mat.map.dispose();
      mat.emissiveMap?.dispose();
      mat.dispose();
    }
    models.clear();
    modelPromises.clear();
    kitPromises.clear();
    kitMaterials.clear();
  }

  return { load, clone, instanced, info, listKeys, material, nightMaterials, dispose };
}

function atlasTexture(image, colorSpace) {
  const texture = new THREE.Texture(image);
  texture.flipY = false; // convenção do glTF
  texture.colorSpace = colorSpace;
  // Sem mipmaps: cada face amostra uma faixa estreita do atlas e os mips misturariam cores vizinhas.
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Mapa emissivo: só os retângulos de `glow`, na cor da regra × luminância do texel original. */
function glowCanvas(image, glow) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = ctx.createImageData(canvas.width, canvas.height);
  const color = new THREE.Color();
  for (const { rect, color: hex } of glow) {
    color.set(hex).convertLinearToSRGB(); // bytes do canvas são sRGB
    const [x0, y0, w, h] = rect;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const o = (y * canvas.width + x) * 4;
        const lum = (0.3 * source.data[o] + 0.59 * source.data[o + 1] + 0.11 * source.data[o + 2]) / 255;
        out.data[o] = color.r * lum * 255;
        out.data[o + 1] = color.g * lum * 255;
        out.data[o + 2] = color.b * lum * 255;
      }
    }
  }
  for (let o = 3; o < out.data.length; o += 4) out.data[o] = 255;
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/**
 * Faz cada janela acender por conta própria: sorteia por célula da fachada (em espaço do modelo) e por instância,
 * e vai acendendo mais janelas conforme `userData.night.value` sobe.
 */
function randomizeWindows(material, { cell }, { warm, cool, coolShare, litShare }) {
  const uniforms = {
    uNight: { value: 0 },
    uWinCell: { value: cell },
    uWinLit: { value: litShare },
    uWinCool: { value: coolShare },
    uWinWarmColor: { value: new THREE.Color(warm) },
    uWinCoolColor: { value: new THREE.Color(cool) },
  };
  material.userData.night = uniforms.uNight;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const varyings = 'varying vec2 vWinPos;\nflat varying vec2 vWinId;';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${varyings}`).replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
        // posição no plano da fachada (não usa a coordenada constante da parede) + código da face + semente da instância
        vWinPos = vec2(abs(normal.x) > 0.5 ? position.z : position.x, position.y);
        vWinId.x = floor(dot(normal, vec3(1.5, 0.0, 3.0)) + 0.5);
        #ifdef USE_INSTANCING
          vWinId.y = fract(dot(instanceMatrix[3].xz, vec2(0.731, 0.137)));
        #else
          vWinId.y = fract(dot(modelMatrix[3].xz, vec2(0.731, 0.137)));
        #endif`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        ${varyings}
        uniform float uNight, uWinCell, uWinLit, uWinCool;
        uniform vec3 uWinWarmColor, uWinCoolColor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        vec2 winCell = floor(vWinPos / uWinCell + 0.5) + vWinId.x * 7.0 + floor(vWinId.y * 97.0) * 13.0;
        float winRnd = fract(sin(dot(winCell, vec2(127.1, 311.7))) * 43758.5453);
        float winOn = step(winRnd, uWinLit * min(1.0, uNight * 1.6));
        float winIsCool = step(1.0 - uWinCool, fract(winRnd * 91.7 + vWinId.y));
        totalEmissiveRadiance *= winOn * mix(uWinWarmColor, uWinCoolColor, winIsCool);`,
      );
  };
}

function boxInfo(box) {
  const plain = (v) => ({ x: v.x, y: v.y, z: v.z });
  return {
    size: plain(box.getSize(new THREE.Vector3())),
    min: plain(box.min),
    max: plain(box.max),
    center: plain(box.getCenter(new THREE.Vector3())),
  };
}
