/** Pontos de interesse: restaurantes, clientes e a casa do jogador, sempre no meio-fio de uma rua. */
import { dist, round2 } from './geometry.js';
import { pickRestaurantNames } from './names.js';

const DISTRICTS = ['centro', 'bairro', 'industrial'];

/** Devolve `{ pois, homeId }`, ou null se não achou lugar para todo mundo. */
export function placePois(city, edgeDistricts, houseBase, cfg, rng) {
  const edgesIn = Object.fromEntries(
    DISTRICTS.map((d) => [d, city.edges.filter((e) => !e.bridge && edgeDistricts[e.id] === d).map((e) => e.id)]),
  );
  const pois = [];
  const add = (type, district, nameOf) => {
    const spot = findSpot(city, edgesIn[district], pois, cfg, rng);
    if (spot) pois.push({ id: pois.length, type, name: nameOf(spot), ...spot });
    return !!spot;
  };
  const address = (spot) => `${city.edges[spot.edge].name}, ${houseNumber(city, spot, houseBase)}`;

  const restaurantNames = pickRestaurantNames(rng, cfg.restaurants);
  for (let i = 0; i < cfg.restaurants; i++) {
    if (!add('restaurante', districtFor(i, cfg.restaurants, cfg.restaurantShare), () => restaurantNames[i])) return null;
  }
  for (let i = 0; i < cfg.customers; i++) {
    if (!add('cliente', districtFor(i, cfg.customers, cfg.customerShare), address)) return null;
  }
  if (!add('casa', 'bairro', () => 'Sua casa')) return null;
  return { pois, homeId: pois.length - 1 };
}

/** Reparte `n` itens pelos distritos na proporção de `share`, sem sorteio. */
function districtFor(i, n, share) {
  const mark = (i + 0.5) / n;
  let sum = 0;
  for (const d of DISTRICTS) {
    sum += share[d];
    if (mark < sum) return d;
  }
  return DISTRICTS[0];
}

function findSpot(city, edgeIds, taken, cfg, rng) {
  if (!edgeIds.length) return null;
  const clearance = (nodeId) => Math.max(cfg.poiNodeClearance, city.nodes[nodeId].radius + cfg.poiRadiusMargin);
  for (let i = 0; i < cfg.poiTries; i++) {
    const edge = city.edges[rng.pick(edgeIds)];
    const lo = clearance(edge.a);
    const hi = edge.length - clearance(edge.b);
    if (hi <= lo) continue;
    const spot = curbSpot(city, edge, rng.range(lo, hi) / edge.length, rng.chance(0.5) ? 1 : -1);
    const free =
      city.nodes.every((n) => dist(n, spot) >= cfg.poiNodeClearance) && taken.every((p) => dist(p, spot) >= cfg.poiGap);
    if (free) return spot;
  }
  return null;
}

/** Ponto no meio-fio: no eixo da via, deslocado meia pista para o lado `side`. */
function curbSpot(city, edge, rawT, side) {
  const t = Math.round(rawT * 1e4) / 1e4;
  const a = city.nodes[edge.a];
  const lateral = side * edge.halfWidth;
  return {
    edge: edge.id,
    t,
    side,
    x: round2(a.x + edge.dir.x * edge.length * t - edge.dir.z * lateral),
    z: round2(a.z + edge.dir.z * edge.length * t + edge.dir.x * lateral),
  };
}

/** Numeração à brasileira: metros desde o começo da via, par de um lado e ímpar do outro. */
function houseNumber(city, spot, houseBase) {
  const meters = houseBase[spot.edge] + spot.t * city.edges[spot.edge].length;
  return Math.max(2, Math.round(meters / 2) * 2) + (spot.side > 0 ? 0 : 1);
}
