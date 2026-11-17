/**
 * Gerador procedural da cidade. Puro: sem three, sem DOM, toda aleatoriedade vem do `rng` injetado.
 * Etapas: rio → distritos → avenidas e pontes → nós e ruas → remoção → nomes → mão única → semáforos → POIs → lotes.
 */
import { buildRiver, buildSkeleton, createDistrictAt } from './skeleton.js';
import { buildStreetNet, ensureDeadEnds, finalizeNet, removeRandomEdges } from './streets.js';
import { nameStreets } from './names.js';
import { applyOneWay, isStronglyConnected, placeSignals, setNodeRadii } from './controls.js';
import { placePois } from './pois.js';
import { placeLots } from './lots.js';

/** `generateCity(config.city, rng) → City` (formato no CLAUDE.md, mais `edge.name`). */
export function generateCity(cfg, rng) {
  // Uma combinação azarada de sorteios pode dar um esqueleto inválido; cada tentativa usa uma sub-seed própria.
  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    const city = tryGenerate(cfg, rng.fork(`cidade:${attempt}`));
    if (city) return city;
  }
  throw new Error('generateCity: nenhuma tentativa produziu uma cidade válida');
}

function tryGenerate(cfg, rng) {
  const river = buildRiver(cfg, rng.fork('rio'));
  const districtAt = createDistrictAt(cfg, river, rng.fork('distritos'));
  const spacingAt = (x, z) => cfg.nodeSpacing * cfg.districts[districtAt(x, z)].spacing;

  const skeleton = buildSkeleton(cfg, river, districtAt, spacingAt, rng.fork('avenidas'));
  if (!skeleton.ok) return null;
  const net = buildStreetNet(cfg, river, districtAt, skeleton, rng.fork('ruas'));
  if (!net.ok) return null;
  removeRandomEdges(net, cfg, rng.fork('remoção'));
  ensureDeadEnds(net, cfg, rng.fork('becos'));

  const city = { size: cfg.size, ...finalizeNet(net, cfg) };
  if (!isHealthy(city, cfg)) return null;
  const edgeDistricts = city.edges.map((e) => {
    const a = city.nodes[e.a];
    const b = city.nodes[e.b];
    return districtAt((a.x + b.x) / 2, (a.z + b.z) / 2);
  });

  const { vias, houseBase } = nameStreets(city, edgeDistricts, cfg, rng.fork('nomes'));
  applyOneWay(city, vias, edgeDistricts, cfg, rng.fork('mão única'));
  placeSignals(city, cfg, rng.fork('semáforos'));
  setNodeRadii(city, cfg);

  city.river = { points: river.points, width: river.width };
  const placed = placePois(city, edgeDistricts, houseBase, cfg, rng.fork('pois'));
  if (!placed) return null;
  city.pois = placed.pois;
  city.homeId = placed.homeId;
  city.lots = placeLots(city, river, edgeDistricts, cfg, rng.fork('lotes'));
  return city;
}

/** O que a construção não garante sozinha: pontes na conta, trechos curtos demais, grafo partido. */
function isHealthy(city, cfg) {
  return (
    city.edges.filter((e) => e.bridge).length === cfg.bridges &&
    city.edges.every((e) => e.length >= cfg.minEdge) &&
    isStronglyConnected(city)
  );
}
