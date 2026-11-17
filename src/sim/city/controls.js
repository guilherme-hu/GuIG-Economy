/** Regras de circulação sobre a malha pronta: mão única, semáforos e raio dos cruzamentos. */
import { TAU, round2, shuffle } from './geometry.js';

/** Dá para ir de qualquer nó a qualquer nó respeitando mão única? */
export function isStronglyConnected(city) {
  return reachesAll(city, false) && reachesAll(city, true);
}

function reachesAll(city, reverse) {
  const seen = new Uint8Array(city.nodes.length);
  const stack = [0];
  seen[0] = 1;
  let count = 1;
  while (stack.length) {
    const u = stack.pop();
    for (const id of city.nodes[u].edges) {
      const edge = city.edges[id];
      const leaving = edge.a === u;
      if (edge.oneWay && leaving === reverse) continue;
      const v = leaving ? edge.b : edge.a;
      if (seen[v]) continue;
      seen[v] = 1;
      count++;
      stack.push(v);
    }
  }
  return count === city.nodes.length;
}

/**
 * ~`oneWayShare` das ruas do Centro viram mão única, uma via inteira por vez (todos os trechos no mesmo sentido),
 * desfazendo quando algum nó ficaria inalcançável.
 */
export function applyOneWay(city, vias, edgeDistricts, cfg, rng) {
  const isCentroStreet = (id) => edgeDistricts[id] === 'centro' && city.edges[id].kind === 'rua' && !city.edges[id].bridge;
  const target = Math.round(cfg.oneWayShare * city.edges.filter((e) => isCentroStreet(e.id)).length);
  let count = 0;
  for (const via of shuffle(vias.slice(), rng)) {
    if (count >= target) return;
    const stretch = via.edges.filter(isCentroStreet).slice(0, target - count).map((id) => city.edges[id]);
    if (!stretch.length) continue;
    for (const edge of stretch) edge.oneWay = true;
    if (isStronglyConnected(city)) count += stretch.length;
    else for (const edge of stretch) edge.oneWay = false;
  }
}

/** Semáforo em todo cruzamento (grau ≥ 3) com avenida e em parte dos cruzamentos só de ruas. */
export function placeSignals(city, cfg, rng) {
  for (const node of city.nodes) {
    if (node.edges.length < 3) continue;
    const onAvenue = node.edges.some((id) => city.edges[id].kind === 'avenida');
    node.signal = onAvenue || rng.chance(cfg.signalShareStreets);
  }
}

/**
 * Raio da área do cruzamento: a maior meia-largura que chega, ou a distância até a esquina mais afastada
 * (ruas em ângulo fechado se sobrepõem por mais tempo), mais uma folga. Beco ganha balão de retorno.
 */
export function setNodeRadii(city, cfg) {
  for (const node of city.nodes) node.radius = round2(nodeRadius(city, node, cfg));
}

function nodeRadius(city, node, cfg) {
  if (node.edges.length === 1) return cfg.deadEndRadius;
  const spokes = node.edges
    .map((id) => {
      const e = city.edges[id];
      const sign = e.a === node.id ? 1 : -1;
      return { half: e.halfWidth, angle: Math.atan2(e.dir.z * sign, e.dir.x * sign) };
    })
    .sort((p, q) => p.angle - q.angle);
  let reach = Math.max(...spokes.map((s) => s.half));
  spokes.forEach((s, i) => {
    const next = spokes[(i + 1) % spokes.length];
    const gap = (next.angle - s.angle + TAU) % TAU || TAU;
    if (gap >= Math.PI - 1e-3) return;
    reach = Math.max(reach, cornerReach(s.half, next.half, gap), cornerReach(next.half, s.half, gap));
  });
  return reach + cfg.nodeMargin;
}

/** Distância, ao longo do eixo da via 1, até onde a borda dela encontra a borda da via 2. */
const cornerReach = (half1, half2, gap) => (half2 + half1 * Math.cos(gap)) / Math.sin(gap);
