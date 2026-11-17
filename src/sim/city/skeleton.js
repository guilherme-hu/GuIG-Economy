/**
 * Esqueleto da cidade: rio, distritos, avenidas (marginal + diagonais) e pontes.
 * Tudo que sai daqui é "forçado": as ruas comuns se ajustam em volta e nunca removem estas arestas.
 */
import { TAU, createPolyline, polylineCrossings, round2 } from './geometry.js';
import { MARGINAL_NAME, pickAvenueNames, pickBridgeNames } from './names.js';

const scaled = (p, size) => ({ x: p.x * size, z: p.z * size });

/** Rio: reta de borda a borda com uma senoide suave por cima, passando um pouco do mapa nas duas pontas. */
export function buildRiver(cfg, rng) {
  const { river, size } = cfg;
  const a = scaled(river.from, size);
  const b = scaled(river.to, size);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const nx = (b.z - a.z) / len;
  const nz = -(b.x - a.x) / len;
  const phase = rng.range(0, TAU);
  const waves = river.waves * (1 + rng.range(-1, 1) * river.waveVariance);
  const points = [];
  for (let i = -river.overshoot; i <= river.samples + river.overshoot; i++) {
    const u = i / river.samples;
    const off = river.amplitude * Math.sin(TAU * waves * u + phase);
    points.push({ x: round2(a.x + (b.x - a.x) * u + nx * off), z: round2(a.z + (b.z - a.z) * u + nz * off) });
  }
  return { points, width: cfg.riverWidth, line: createPolyline(points) };
}

/** Função `(x, z) → distrito`: Industrial do outro lado do rio, Centro numa mancha arredondada, Bairro no resto. */
export function createDistrictAt(cfg, river, rng) {
  const center = scaled(cfg.centro.center, cfg.size);
  const radius = cfg.centro.radius * cfg.size;
  const phase = rng.range(0, TAU);
  const citySide = river.line.nearest(center).side;
  const districtAt = (x, z) => {
    if (river.line.nearest({ x, z }).side !== citySide) return 'industrial';
    const dx = x - center.x;
    const dz = z - center.z;
    const r = radius * (1 + cfg.centro.wobble * Math.sin(cfg.centro.lobes * Math.atan2(dz, dx) + phase));
    return dx * dx + dz * dz < r * r ? 'centro' : 'bairro';
  };
  districtAt.citySide = citySide;
  return districtAt;
}

/**
 * Devolve `{ nodes: [{x,z}], edges: [{a,b,kind,bridge,name}], ok }`.
 * As avenidas viram polilinhas; onde se cruzam nasce um nó comum; onde uma diagonal cruza o rio nasce uma ponte;
 * pontes de rua completam `cfg.bridges` nos maiores vãos sem travessia.
 */
export function buildSkeleton(cfg, river, districtAt, spacingAt, rng) {
  const sk = { nodes: [], edges: [], ok: true };
  const names = pickAvenueNames(rng, cfg.avenues.length);
  const marginal = makeAvenue(MARGINAL_NAME, marginalPoints(cfg, river, districtAt.citySide));
  const diagonals = cfg.avenues.map((def, i) => makeAvenue(names[i], diagonalPoints(def, cfg, rng)));
  const lines = [marginal, ...diagonals];

  joinCrossings(sk, lines);
  const bankOffset = river.width / 2 + cfg.marginalSetback;
  const bridgeArcs = diagonals.map((d) => bridgeAvenue(sk, d, marginal, river, bankOffset));
  if (!sk.ok) return sk;
  addStreetBridges(sk, marginal, river, bridgeArcs, bankOffset, cfg);
  for (const line of lines) emitAvenue(sk, line, cfg, spacingAt, rng);
  nameBridges(sk, rng);
  return sk;
}

const makeAvenue = (name, points) => ({ name, line: createPolyline(points), stations: [], bridges: [] });

const insideInset = (p, cfg, margin = cfg.margin) =>
  Math.abs(p.x) <= cfg.size / 2 - margin && Math.abs(p.z) <= cfg.size / 2 - margin;

function addNode(sk, p) {
  sk.nodes.push({ x: p.x, z: p.z });
  return sk.nodes.length - 1;
}

/** Marginal: o rio deslocado para o lado da cidade. */
function marginalPoints(cfg, river, citySide) {
  const offset = (river.width / 2 + cfg.marginalSetback) * citySide;
  const pts = river.points;
  const out = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const tx = pts[i + 1].x - pts[i - 1].x;
    const tz = pts[i + 1].z - pts[i - 1].z;
    const len = Math.hypot(tx, tz);
    const p = { x: pts[i].x + (-tz / len) * offset, z: pts[i].z + (tx / len) * offset };
    if (insideInset(p, cfg)) out.push(p);
  }
  return out;
}

/** Diagonal: reta entre duas bordas do mapa, com as pontas sorteadas e uma barriga leve. */
function diagonalPoints(def, cfg, rng) {
  const jitter = () => rng.range(-1, 1) * cfg.avenueJitter;
  const a = scaled({ x: def.from.x + jitter(), z: def.from.z + jitter() }, cfg.size);
  const b = scaled({ x: def.to.x + jitter(), z: def.to.z + jitter() }, cfg.size);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const bend = rng.range(-1, 1) * cfg.avenueBend;
  const out = [];
  for (let i = 0; i <= cfg.avenueSamples; i++) {
    const u = i / cfg.avenueSamples;
    const off = bend * Math.sin(Math.PI * u);
    const p = { x: a.x + (b.x - a.x) * u + ((b.z - a.z) / len) * off, z: a.z + (b.z - a.z) * u - ((b.x - a.x) / len) * off };
    if (insideInset(p, cfg)) out.push(p);
  }
  return out;
}

function joinCrossings(sk, lines) {
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      for (const hit of polylineCrossings(lines[i].line, lines[j].line)) {
        const node = addNode(sk, hit);
        lines[i].stations.push({ s: hit.sA, node, other: lines[j] });
        lines[j].stations.push({ s: hit.sB, node, other: lines[i] });
      }
    }
  }
}

/** A ponte de uma diagonal vai do cruzamento com a marginal até pousar na outra margem. Devolve o arco no rio. */
function bridgeAvenue(sk, diagonal, marginal, river, bankOffset) {
  const head = diagonal.stations.find((st) => st.other === marginal);
  const hit = polylineCrossings(diagonal.line, river.line)[0];
  if (!head || !hit) {
    sk.ok = false;
    return 0;
  }
  const step = Math.sign(hit.sA - head.s); // de metro em metro, afastando-se da marginal
  let s = hit.sA;
  while (s > 0 && s < diagonal.line.length && river.line.distance(diagonal.line.at(s)) < bankOffset) s += step;
  const node = addNode(sk, diagonal.line.at(s));
  diagonal.stations.push({ s, node });
  diagonal.bridges.push([head.node, node]);
  return hit.sB;
}

/** Pontes de rua, perpendiculares ao rio, no meio do maior vão sem travessia. */
function addStreetBridges(sk, marginal, river, arcs, bankOffset, cfg) {
  const inMap = river.points
    .map((p, i) => ({ p, s: river.line.cum[i] }))
    .filter(({ p }) => insideInset(p, cfg, cfg.bridgeEdgeMargin))
    .map(({ s }) => s);
  while (arcs.length < cfg.bridges) {
    const s = middleOfWidestGap([inMap[0], ...arcs, inMap[inMap.length - 1]]);
    const p = river.line.at(s);
    const sM = marginal.line.nearest(p).s;
    const headPoint = marginal.line.at(sM);
    const d = Math.hypot(p.x - headPoint.x, p.z - headPoint.z);
    const head = addNode(sk, headPoint);
    const landing = addNode(sk, {
      x: p.x + ((p.x - headPoint.x) / d) * bankOffset,
      z: p.z + ((p.z - headPoint.z) / d) * bankOffset,
    });
    marginal.stations.push({ s: sM, node: head });
    sk.edges.push({ a: head, b: landing, kind: 'rua', bridge: true, name: null });
    arcs.push(s);
  }
}

function middleOfWidestGap(marks) {
  const sorted = marks.slice().sort((a, b) => a - b);
  let best = 0;
  for (let i = 1; i < sorted.length - 1; i++) if (sorted[i + 1] - sorted[i] > sorted[best + 1] - sorted[best]) best = i;
  return (sorted[best] + sorted[best + 1]) / 2;
}

/** Pontas da avenida viram estações, a não ser que fiquem coladas num cruzamento (aí a ponta é aparada). */
function stationsWithEnds(sk, line, minSection) {
  const stations = line.stations.slice();
  for (const s of [0, line.line.length]) {
    if (stations.some((st) => Math.abs(st.s - s) < minSection)) continue;
    stations.push({ s, node: addNode(sk, line.line.at(s)) });
  }
  return stations.sort((p, q) => p.s - q.s);
}

/** Subdivide a avenida entre estações em trechos do tamanho do quarteirão local e emite nós e arestas. */
function emitAvenue(sk, line, cfg, spacingAt, rng) {
  const stations = stationsWithEnds(sk, line, cfg.minSection);
  const wobble = () => rng.range(-1, 1) * cfg.avenueWobble;
  for (let i = 0; i < stations.length - 1; i++) {
    const p = stations[i];
    const q = stations[i + 1];
    const bridge = line.bridges.some(([u, v]) => (u === p.node && v === q.node) || (u === q.node && v === p.node));
    const mid = line.line.at((p.s + q.s) / 2);
    const pieces = bridge ? 1 : Math.max(1, Math.round((q.s - p.s) / spacingAt(mid.x, mid.z)));
    let prev = p.node;
    for (let k = 1; k <= pieces; k++) {
      const at = line.line.at(p.s + ((q.s - p.s) * k) / pieces);
      const node = k === pieces ? q.node : addNode(sk, { x: at.x + wobble(), z: at.z + wobble() });
      sk.edges.push({ a: prev, b: node, kind: 'avenida', bridge, name: line.name });
      prev = node;
    }
  }
}

function nameBridges(sk, rng) {
  const bridges = sk.edges.filter((e) => e.bridge);
  const names = pickBridgeNames(rng, bridges.length);
  bridges.forEach((edge, i) => (edge.name = names[i]));
}
