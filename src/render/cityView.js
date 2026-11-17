/** Mundo visual da cidade: junta terreno, ruas e construções a partir do `city` da simulação. */
import * as THREE from 'three';
import { createBuildings, createLotPads } from './buildings.js';
import { createRoads } from './roads.js';
import { createTerrain } from './terrain.js';

export function createCityView({ city, config, scene, assets }) {
  const group = new THREE.Group();
  group.add(createTerrain(city), createLotPads(city), createRoads(city, config));
  scene.add(group);

  const view = {
    group,
    /** Fica true quando os modelos dos prédios terminaram de carregar e estão na cena. */
    loaded: false,
    ready: createBuildings(city, assets).then((buildings) => {
      group.add(buildings);
      view.loaded = true;
    }),
  };
  return view;
}
