/** Carrega os modelos GLB de `public/assets/models/` uma vez só e devolve geometria pronta para instanciar. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createAssets(baseUrl = `${import.meta.env.BASE_URL}assets/models/`) {
  const loader = new GLTFLoader();
  const cache = new Map();

  /**
   * `path` sem extensão, relativo à pasta de modelos (ex.: 'commercial/building-a').
   * Resolve em `{ parts: [{ geometry, material }], box }`, com as transformações do arquivo já aplicadas.
   */
  function load(path) {
    if (!cache.has(path)) cache.set(path, loader.loadAsync(`${baseUrl}${path}.glb`).then(flatten));
    return cache.get(path);
  }

  return {
    load,
    /** Carrega vários modelos; resolve num Map de path → modelo. */
    loadAll: (paths) => Promise.all(paths.map(load)).then((models) => new Map(paths.map((path, i) => [path, models[i]]))),
  };
}

function flatten(gltf) {
  const parts = [];
  const box = new THREE.Box3();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox);
    parts.push({ geometry, material: object.material });
  });
  return { parts, box };
}
