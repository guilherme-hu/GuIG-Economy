/**
 * Malha de ruas: espalha os nós de cada distrito em volta do esqueleto, triangula, e poda a triangulação
 * até sobrar uma rede de ruas plausível (planar por construção: é um subconjunto de Delaunay + arestas forçadas).
 */
import { TAU, angleGap, dist, distToSegment, lerp, round2, segmentsCross, shuffle } from './geometry.js';
import { triangulate } from './delaunay.js';

export function buildStreetNet(cfg, river, districtAt, skeleton, rng) {
  const nodes = scatterNodes(cfg, river, districtAt, skeleton, rng);
  const net = createNet(nodes, skeleton.edges, cfg.diagonalRatio);
  pruneEdges(net, cfg, river);
  fixSharpAngles(net, cfg.minAngle);
  keepLargestComponent(net);
  return net;
}

/* ---------- nós ---------- */

/** Nós do esqueleto primeiro (mesmos índices), depois a grade com jitter de cada distrito. */
function scatterNodes(cfg, river, districtAt, skeleton, rng) {
  const nodes = skeleton.nodes.map((p) => ({ x: p.x, z: p.z, district: districtAt(p.x, p.z), forced: true }));
  const forcedSegments = skeleton.edges.map((e) => [skeleton.nodes[e.a], skeleton.nodes[e.b]]);
  const limit = cfg.size / 2 - cfg.margin;
  const bank = river.width / 2 + cfg.bankClearance;
  for (const district of Object.keys(cfg.districts)) {
    const spacing = cfg.nodeSpacing * cfg.districts[district].spacing;
    const minGap = Math.max(cfg.minNodeGap * spacing, cfg.minEdge + cfg.nodeMargin);
    const clearance = cfg.avenueClearance * spacing;
    for (const p of latticePoints(cfg, district, rng)) {
      if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) continue;
      if (districtAt(p.x, p.z) !== district) continue;
      if (river.line.distance(p) < bank) continue;
      if (forcedSegments.some(([a, b]) => distToSegment(p, a, b) < clearance)) continue;
      if (nodes.some((n) => dist(n, p) < minGap)) continue;
      nodes.push({ x: p.x, z: p.z, district, forced: false });
    }
  }
  return nodes;
}

/** Grade rotacionada cobrindo o mapa inteiro, com ondulação de baixa frequência e jitter por nó. */
function latticePoints(cfg, district, rng) {
  const d = cfg.districts[district];
  const spacing = cfg.nodeSpacing * d.spacing;
  const jitter = cfg.jitter * d.jitter * spacing;
  const cos = Math.cos(d.rotation);
  const sin = Math.sin(d.rotation);
  const k = TAU / (d.warpLength * spacing);
  const amp = d.warp * spacing;
  const phaseX = rng.range(0, TAU);
  const phaseZ = rng.range(0, TAU);
  const reach = Math.ceil((cfg.size * Math.SQRT1_2) / spacing);
  const points = [];
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) {
      const u = i * spacing + rng.range(-jitter, jitter);
      const v = j * spacing + rng.range(-jitter, jitter);
      const x = u * cos - v * sin;
      const z = u * sin + v * cos;
      points.push({ x: x + amp * Math.sin(k * z + phaseX), z: z + amp * Math.sin(k * x + phaseZ) });
    }
  }
  return points;
}

/* ---------- rede ---------- */

const edgeKey = (a, b) => (a < b ? a * 65536 + b : b * 65536 + a);

/** Rede mutável: arestas de Delaunay + forçadas; `urquhart` marca as diagonais (poda no estilo do grafo de Urquhart). */
function createNet(nodes, forcedEdges, diagonalRatio) {
  const net = { nodes, edges: [], byNode: nodes.map(() => []), ok: true };
  const index = new Map();
  const ensure = (a, b) => {
    const key = edgeKey(a, b);
    if (!index.has(key)) {
      const edge = { a, b, length: dist(nodes[a], nodes[b]), alive: true, forced: false, urquhart: false, kind: 'rua', bridge: false, name: null };
      index.set(key, edge);
      net.edges.push(edge);
      net.byNode[a].push(edge);
      net.byNode[b].push(edge);
    }
    return index.get(key);
  };
  // forçadas primeiro e com o a→b do esqueleto: as avenidas saem em sequência e orientadas
  for (const f of forcedEdges) {
    Object.assign(ensure(f.a, f.b), { a: f.a, b: f.b, forced: true, kind: f.kind, bridge: f.bridge, name: f.name });
  }
  for (const [a, b, c] of triangulate(nodes)) {
    const sides = [ensure(a, b), ensure(b, c), ensure(c, a)].sort((p, q) => q.length - p.length);
    // diagonal de quarteirão: bem maior que os outros dois lados (triângulo quase equilátero fica inteiro)
    if (sides[0].length > diagonalRatio * sides[1].length) sides[0].urquhart = true;
  }
  return net;
}

const aliveAt = (net, n) => net.byNode[n].filter((e) => e.alive);
const degree = (net, n) => net.byNode[n].reduce((count, e) => count + (e.alive ? 1 : 0), 0);
const otherEnd = (edge, n) => (edge.a === n ? edge.b : edge.a);

/** Ainda dá para ir de `a` a `b` sem passar pela aresta? */
function staysConnected(net, edge) {
  const seen = new Set([edge.a]);
  const stack = [edge.a];
  while (stack.length) {
    const n = stack.pop();
    for (const e of net.byNode[n]) {
      if (!e.alive || e === edge) continue;
      const m = otherEnd(e, n);
      if (m === edge.b) return true;
      if (!seen.has(m)) seen.add(m), stack.push(m);
    }
  }
  return false;
}

/* ---------- podas ---------- */

function pruneEdges(net, cfg, river) {
  const forced = net.edges.filter((e) => e.forced);
  const P = (i) => net.nodes[i];
  for (const edge of net.edges) {
    if (edge.forced) continue;
    edge.alive =
      !edge.urquhart &&
      edge.length <= maxLength(net, edge, cfg) &&
      !touchesRiver(P(edge.a), P(edge.b), river, cfg) &&
      !forced.some((f) => segmentsCross(P(edge.a), P(edge.b), P(f.a), P(f.b))) &&
      !grazesNode(net, edge, cfg.nodeClearance);
  }
}

function maxLength(net, edge, cfg) {
  const factor = (n) => cfg.districts[net.nodes[n].district].spacing * cfg.districts[net.nodes[n].district].maxEdge;
  return cfg.nodeSpacing * Math.max(factor(edge.a), factor(edge.b));
}

function touchesRiver(a, b, river, cfg) {
  const limit = river.width / 2 + cfg.riverBank;
  const steps = Math.ceil(dist(a, b) / cfg.riverSampleStep);
  for (let i = 0; i <= steps; i++) if (river.line.distance(lerp(a, b, i / steps)) < limit) return true;
  return false;
}

/** Rua que passa raspando num cruzamento que não é dela parece um cruzamento, mas não é. */
function grazesNode(net, edge, clearance) {
  const a = net.nodes[edge.a];
  const b = net.nodes[edge.b];
  return net.nodes.some((n, i) => i !== edge.a && i !== edge.b && distToSegment(n, a, b) < clearance);
}

/** Enquanto duas arestas saírem do mesmo nó quase sobrepostas, remove uma (nunca uma forçada). */
function fixSharpAngles(net, minAngle) {
  for (let n = 0; n < net.nodes.length; n++) {
    for (let pair = sharpPair(net, n, minAngle); pair; pair = sharpPair(net, n, minAngle)) {
      const candidates = pair.filter((e) => !e.forced).sort((p, q) => q.length - p.length);
      if (!candidates.length) {
        net.ok = false;
        return;
      }
      (candidates.find((e) => staysConnected(net, e)) ?? candidates[0]).alive = false;
    }
  }
}

function sharpPair(net, n, minAngle) {
  const p = net.nodes[n];
  const spokes = aliveAt(net, n).map((edge) => {
    const q = net.nodes[otherEnd(edge, n)];
    return { edge, angle: Math.atan2(q.z - p.z, q.x - p.x) };
  });
  for (let i = 0; i < spokes.length; i++) {
    for (let j = i + 1; j < spokes.length; j++) {
      if (angleGap(spokes[i].angle, spokes[j].angle) < minAngle) return [spokes[i].edge, spokes[j].edge];
    }
  }
  return null;
}

/** Mata o que ficou fora do maior componente; arestas forçadas de fora invalidam a tentativa. */
function keepLargestComponent(net) {
  const label = new Int32Array(net.nodes.length).fill(-1);
  const sizes = [];
  for (let start = 0; start < net.nodes.length; start++) {
    if (label[start] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const n = stack.pop();
      size++;
      for (const e of aliveAt(net, n)) {
        const m = otherEnd(e, n);
        if (label[m] < 0) (label[m] = id), stack.push(m);
      }
    }
    sizes.push(size);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  for (const edge of net.edges) {
    if (label[edge.a] === main) continue;
    if (edge.forced) net.ok = false;
    edge.alive = false;
  }
}

/* ---------- remoção ao acaso ---------- */

const edgeDistrict = (net, edge) => net.nodes[edge.a].district;

/** Um nó de avenida não pode virar ponta solta, e só alguns distritos aceitam beco. */
function wouldStrand(net, edge, cfg) {
  return [edge.a, edge.b].some((n) => {
    if (degree(net, n) !== 2) return false;
    return net.nodes[n].forced || !cfg.districts[net.nodes[n].district].deadEnds;
  });
}

/** Remove ~`edgeRemoval` das arestas, com peso por distrito, sem nunca desconectar o grafo. */
export function removeRandomEdges(net, cfg, rng) {
  const alive = net.edges.filter((e) => e.alive);
  const target = Math.round(cfg.edgeRemoval * alive.length);
  const candidates = shuffle(alive.filter((e) => !e.forced), rng);
  const isDeadEnd = (n) => degree(net, n) === 1;
  let removed = 0;
  let deadEnds = net.nodes.filter((_, n) => isDeadEnd(n)).length;
  for (const weighted of [true, false]) {
    for (const edge of candidates) {
      if (removed >= target) return;
      if (!edge.alive) continue;
      if (weighted && !rng.chance(cfg.districts[edgeDistrict(net, edge)].removal)) continue;
      const newDeadEnds = (degree(net, edge.a) === 2) + (degree(net, edge.b) === 2);
      if (deadEnds + newDeadEnds > cfg.maxDeadEnds && newDeadEnds) continue;
      if (wouldStrand(net, edge, cfg) || !staysConnected(net, edge)) continue;
      edge.alive = false;
      removed++;
      deadEnds += newDeadEnds;
    }
  }
}

/** Garante um mínimo de becos sem saída no Bairro abrindo ruas que deixam um nó de grau 2 pendurado. */
export function ensureDeadEnds(net, cfg, rng) {
  const isDeadEnd = (n) => net.nodes[n].district === 'bairro' && degree(net, n) === 1;
  let count = net.nodes.filter((_, n) => isDeadEnd(n)).length;
  for (const edge of shuffle(net.edges.filter((e) => e.alive && !e.forced), rng)) {
    if (count >= cfg.minDeadEnds) return;
    const makesOne = [edge.a, edge.b].some((n) => net.nodes[n].district === 'bairro' && !net.nodes[n].forced && degree(net, n) === 2);
    if (!makesOne || wouldStrand(net, edge, cfg) || !staysConnected(net, edge)) continue;
    edge.alive = false;
    count = net.nodes.filter((_, n) => isDeadEnd(n)).length;
  }
}

/* ---------- saída ---------- */

/** Compacta a rede viva em `nodes` e `edges` no formato do contrato (sem sinal, raio, mão única e nome de rua ainda). */
export function finalizeNet(net, cfg) {
  const remap = new Int32Array(net.nodes.length).fill(-1);
  const nodes = [];
  net.nodes.forEach((n, i) => {
    if (!degree(net, i)) return;
    remap[i] = nodes.length;
    nodes.push({ id: nodes.length, x: round2(n.x), z: round2(n.z), edges: [], district: n.district, signal: false, radius: 0 });
  });
  const edges = [];
  for (const e of net.edges) {
    if (!e.alive) continue;
    const a = nodes[remap[e.a]];
    const b = nodes[remap[e.b]];
    const road = e.kind === 'avenida' ? cfg.avenue : cfg.street;
    const length = dist(a, b);
    const edge = {
      id: edges.length, a: a.id, b: b.id, length,
      dir: { x: (b.x - a.x) / length, z: (b.z - a.z) / length },
      kind: e.kind, lanes: road.lanes, oneWay: false, speedLimit: road.speedLimit,
      bridge: e.bridge, halfWidth: road.lanes * road.laneWidth, name: e.name,
    };
    edges.push(edge);
    a.edges.push(edge.id);
    b.edges.push(edge.id);
  }
  return { nodes, edges };
}
