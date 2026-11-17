/** Mundo visual da cidade: junta terreno, ruas e construções a partir do `city` da simulação. */
import * as THREE from 'three';
import { createBuildings, createLotPads, windowGlowTexture } from './buildings.js';
import { createStreetLights } from './streetLights.js';
import { createRoads } from './roads.js';
import { createTerrain } from './terrain.js';

export function createCityView({ city, config, scene, assets }) {
  const group = new THREE.Group();
  group.add(createTerrain(city), createLotPads(city), createRoads(city, config));
  group.traverse((mesh) => (mesh.receiveShadow = true));
  const lamps = createStreetLights(city);
  group.add(lamps.group);
  scene.add(group);
  const windows = new Set(); // materiais dos prédios, para acender as janelas à noite

  const view = {
    group,
    /** Fica true quando os modelos dos prédios terminaram de carregar e estão na cena. */
    loaded: false,
    ready: createBuildings(city, assets).then((buildings) => {
      const glow = windowGlowTexture();
      buildings.traverse((mesh) => {
        mesh.castShadow = mesh.receiveShadow = true;
        if (!mesh.material || windows.has(mesh.material)) return;
        Object.assign(mesh.material, { emissiveMap: glow, emissiveIntensity: 0 });
        mesh.material.emissive.set(0xffffff);
        windows.add(mesh.material);
      });
      group.add(buildings);
      view.loaded = true;
    }),
    /** 0 = dia, 1 = noite: postes e janelas acesos. */
    setNight(k) {
      lamps.setNight(k);
      for (const material of windows) material.emissiveIntensity = k * 1.3;
    },
  };
  return view;
}
