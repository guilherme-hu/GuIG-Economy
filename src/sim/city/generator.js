/**
 * Gerador da cidade: devolve o `City` descrito no CLAUDE.md a partir de `config.city` e de um rng.
 *
 * A ordem importa. Primeiro o rio e as avenidas (linhas retas ou paralelas ao rio), depois uma malha
 * torta de ruas que desvia delas, depois as travessas que ligam a malha às avenidas, e só então os
 * cortes ao acaso. Assim as diagonais e o rio mandam no desenho, e o resultado não parece uma grade.
 */
import { angleBetween, createPolyline, distance, pointSegmentDistance, segmentIntersection, segmentsCross } from './geometry.js';
import { generateLots } from './lots.js';
import { placePois } from './pois.js';

export function generateCity(cfg, rng) {
  const river = buildRiver(cfg, rng.fork('rio'));
  const districtAt = createDistricts(cfg, river);
  const net = createNetwork();
  const avenues = buildAvenues(net, cfg, river);
  buildLattice(net, cfg, river, avenues, districtAt, rng.fork('malha'));
  hookLattice(net, cfg, river, avenues);
  keepLargestComponent(net);
  thinStreets(net, cfg, river, districtAt, rng.fork('cortes'));

  const city = finalize(net, cfg, river, districtAt);
  assignOneWays(city, cfg, rng.fork('mao-unica'));
  assignSignals(city, cfg, rng.fork('semaforos'));
  city.pois = placePois(city, cfg, districtAt, rng.fork('pois'));
  city.homeId = city.pois.findIndex((poi) => poi.type === 'casa');
  city.lots = generateLots(city, cfg, districtAt, rng.fork('lotes'));
  return city;
}

// ---------------------------------------------------------------- rio e distritos

function buildRiver(cfg, rng) {
  const { startZ, endZ, meander, waves, segments } = cfg.river;
  const reach = cfg.size / 2 + 90; // passa da borda do mundo para o rio não acabar à vista
  const phase = rng.next();
  const phase2 = rng.next();
  const points = [];
  for (let k = 0; k <= segments; k++) {
    const u = k / segments;
    const wobble = Math.sin(2 * Math.PI * (u * waves + phase)) + 0.4 * Math.sin(2 * Math.PI * (u * waves * 2.3 + phase2));
    points.push({ x: -reach + 2 * reach * u, z: cfg.size * (startZ + (endZ - startZ) * u) + meander * wobble });
  }
  return createPolyline(points);
}

/** O rio é a fronteira: Centro só na margem norte (esquerda), Industrial só na sul. O resto é Bairro. */
export function createDistricts(cfg, river) {
  const centro = scaleCircle(cfg.centro, cfg.size);
  const industrial = scaleCircle(cfg.industrial, cfg.size);
  return (x, z) => {
    const south = river.nearest(x, z).signed > 0;
    if (!south && distance(x, z, centro.x, centro.z) < centro.radius) return 'centro';
    if (south && distance(x, z, industrial.x, industrial.z) < industrial.radius) return 'industrial';
    return 'bairro';
  };
}

const scaleCircle = (circle, size) => ({ ...circle, x: circle.x * size, z: circle.z * size, radius: circle.radius * size });

// ---------------------------------------------------------------- rede em construção

/** Nós e arestas mutáveis enquanto a cidade é montada. `finalize` converte para o formato do contrato. */
function createNetwork() {
  const nodes = [];
  const edges = [];
  const byPair = new Map();
  const pairKey = (a, b) => (a < b ? a * 65536 + b : b * 65536 + a);

  return {
    nodes,
    edges,
    addNode(x, z, flags = {}) {
      // Centímetros bastam, e arredondar já aqui garante que tudo depois enxerga a mesma posição.
      const node = { id: nodes.length, x: round(x), z: round(z), alive: true, links: [], ...flags };
      nodes.push(node);
      return node;
    },
    addEdge(a, b, kind, flags = {}) {
      if (a === b || byPair.has(pairKey(a, b))) return null;
      const edge = { id: edges.length, a, b, kind, bridge: false, alive: true, ...flags };
      edges.push(edge);
      byPair.set(pairKey(a, b), edge);
      nodes[a].links.push(edge);
      nodes[b].links.push(edge);
      return edge;
    },
    removeEdge(edge) {
      edge.alive = false;
      byPair.delete(pairKey(edge.a, edge.b));
      for (const id of [edge.a, edge.b]) nodes[id].links = nodes[id].links.filter((link) => link !== edge);
    },
    restoreEdge(edge) {
      edge.alive = true;
      byPair.set(pairKey(edge.a, edge.b), edge);
      nodes[edge.a].links.push(edge);
      nodes[edge.b].links.push(edge);
    },
    removeNode(node) {
      for (const edge of [...node.links]) this.removeEdge(edge);
      node.alive = false;
    },
    other: (edge, id) => (edge.a === id ? edge.b : edge.a),
  };
}

/** Existe caminho de `from` até `to` sem passar pela aresta `skip`? */
function reachable(net, from, to, skip) {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const id = queue.pop();
    if (id === to) return true;
    for (const edge of net.nodes[id].links) {
      if (edge === skip) continue;
      const next = net.other(edge, id);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

function keepLargestComponent(net) {
  const component = new Map();
  let best = [];
  for (const start of net.nodes) {
    if (!start.alive || component.has(start.id)) continue;
    const members = [start.id];
    component.set(start.id, start.id);
    for (let i = 0; i < members.length; i++) {
      for (const edge of net.nodes[members[i]].links) {
        const next = net.other(edge, members[i]);
        if (component.has(next)) continue;
        component.set(next, start.id);
        members.push(next);
      }
    }
    if (members.length > best.length) best = members;
  }
  const keep = new Set(best);
  for (const node of net.nodes) if (node.alive && !keep.has(node.id)) net.removeNode(node);
}

function crossesAnyEdge(net, ax, az, bx, bz, skipA = -1, skipB = -1) {
  for (const edge of net.edges) {
    if (!edge.alive || edge.a === skipA || edge.b === skipA || edge.a === skipB || edge.b === skipB) continue;
    const p = net.nodes[edge.a];
    const q = net.nodes[edge.b];
    if (segmentsCross(ax, az, bx, bz, p.x, p.z, q.x, q.z)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- avenidas e pontes

/**
 * Cria as diagonais, a marginal (paralela ao rio, na margem norte) e as pontes.
 * Cada diagonal cruza o rio numa ponte; as pontes que faltam são ruas, postas longe das outras.
 */
function buildAvenues(net, cfg, river) {
  const north = river.offset(-(cfg.riverWidth / 2 + cfg.bankNorth));
  const south = river.offset(cfg.riverWidth / 2 + cfg.bankSouth);
  const lines = cfg.diagonals.map(({ from, to }) => {
    const line = { ax: from[0] * cfg.size, az: from[1] * cfg.size, bx: to[0] * cfg.size, bz: to[1] * cfg.size };
    return { ...line, length: distance(line.ax, line.az, line.bx, line.bz), stations: [] };
  });
  const marginal = { stations: [] };

  for (const line of lines) {
    const onNorth = north.intersect(line.ax, line.az, line.bx, line.bz);
    const onSouth = south.intersect(line.ax, line.az, line.bx, line.bz);
    const head = net.addNode(onNorth.x, onNorth.z, { avenue: true, bridgeEnd: true });
    const foot = net.addNode(onSouth.x, onSouth.z, { avenue: true, bridgeEnd: true });
    line.stations.push({ t: onNorth.t, node: head.id, bridge: foot.id }, { t: onSouth.t, node: foot.id, bridge: head.id });
    marginal.stations.push({ t: onNorth.s, node: head.id });
  }
  addDiagonalCrossings(net, lines);

  const [start, end] = insideRange(north, cfg.size / 2 - cfg.edgeMargin);
  for (const s of [start, end]) {
    const p = north.at(s);
    marginal.stations.push({ t: s, node: net.addNode(p.x, p.z, { avenue: true }).id });
  }
  const stubs = addStreetBridges(net, cfg, river, north, marginal, start, end);

  const chains = lines.map((line) => {
    for (const t of [0, 1]) {
      const x = line.ax + (line.bx - line.ax) * t;
      const z = line.az + (line.bz - line.az) * t;
      line.stations.push({ t, node: net.addNode(x, z, { avenue: true }).id });
    }
    const pointAt = (t) => ({ x: line.ax + (line.bx - line.ax) * t, z: line.az + (line.bz - line.az) * t });
    return buildChain(net, cfg, line.stations, line.length, pointAt);
  });
  chains.push(buildChain(net, cfg, marginal.stations, 1, (s) => north.at(s)));

  return { lines, chains, stubs };
}

function addDiagonalCrossings(net, lines) {
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      const hit = segmentIntersection(a.ax, a.az, a.bx, a.bz, b.ax, b.az, b.bx, b.bz);
      if (!hit) continue;
      const node = net.addNode(hit.x, hit.z, { avenue: true });
      a.stations.push({ t: hit.t, node: node.id });
      b.stations.push({ t: hit.u, node: node.id });
    }
  }
}

/** Trecho [início, fim] em arco da linha que cai dentro do quadrado de meia medida `limit`. */
function insideRange(line, limit) {
  let start = null;
  let end = null;
  for (let s = 0; s <= line.length; s += 4) {
    const p = line.at(s);
    if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) continue;
    if (start === null) start = s;
    end = s;
  }
  return [start, end];
}

/** Pontes de rua: saem da marginal, atravessam o rio em linha reta e terminam num toco na margem sul. */
function addStreetBridges(net, cfg, river, north, marginal, start, end) {
  const stubs = [];
  const span = end - start;
  const missing = cfg.bridges - cfg.diagonals.length;
  for (let n = 0; n < missing; n++) {
    const taken = marginal.stations.map((station) => station.t);
    let best = { s: (start + end) / 2, score: -1 };
    for (let s = start + span * 0.1; s <= end - span * 0.1; s += 8) {
      const score = Math.min(...taken.map((t) => Math.abs(t - s)));
      if (score > best.score) best = { s, score };
    }
    const p = north.at(best.s);
    const mid = river.nearest(p.x, p.z);
    const reach = (cfg.riverWidth / 2 + cfg.bankSouth) / mid.dist;
    const head = net.addNode(p.x, p.z, { avenue: true, bridgeEnd: true });
    const foot = net.addNode(mid.x + (mid.x - p.x) * reach, mid.z + (mid.z - p.z) * reach, { bridgeEnd: true });
    net.addEdge(head.id, foot.id, 'rua', { bridge: true });
    marginal.stations.push({ t: best.s, node: head.id });
    stubs.push(foot.id);
  }
  return stubs;
}

/**
 * Liga as estações de uma avenida em ordem, criando cruzamentos a cada ~nodeSpacing entre elas.
 * `scale` converte o parâmetro das estações em metros (diagonal: 0..1; marginal: já em metros).
 */
function buildChain(net, cfg, stations, scale, pointAt) {
  stations.sort((a, b) => a.t - b.t);
  const chain = [stations[0].node];
  for (let i = 1; i < stations.length; i++) {
    const from = stations[i - 1];
    const to = stations[i];
    const isBridge = from.bridge === to.node;
    const pieces = isBridge ? 1 : Math.max(1, Math.round(((to.t - from.t) * scale) / cfg.nodeSpacing));
    for (let k = 1; k <= pieces; k++) {
      let next = to.node;
      if (k < pieces) {
        const p = pointAt(from.t + ((to.t - from.t) * k) / pieces);
        next = net.addNode(p.x, p.z, { avenue: true }).id;
      }
      net.addEdge(chain[chain.length - 1], next, 'avenida', { bridge: isBridge });
      chain.push(next);
    }
  }
  return chain;
}

// ---------------------------------------------------------------- malha de ruas

/**
 * Grade de cruzamentos deformada: o Centro é girado e apertado, cada distrito treme a seu modo,
 * e o Industrial perde um cruzamento a cada dois para ficar com quarteirões grandes.
 */
function buildLattice(net, cfg, river, avenues, districtAt, rng) {
  const spacing = cfg.nodeSpacing;
  const count = Math.floor(cfg.size / spacing);
  const limit = cfg.size / 2 - cfg.edgeMargin;
  const centro = scaleCircle(cfg.centro, cfg.size);
  const grid = [];

  for (let i = 0; i < count; i++) {
    grid.push([]);
    for (let j = 0; j < count; j++) {
      const base = warpCentro((i - (count - 1) / 2) * spacing, (j - (count - 1) / 2) * spacing, centro);
      const district = districtAt(base.x, base.z);
      const jitter = cfg.jitter * spacing * cfg.jitterScale[district];
      const x = clamp(base.x + rng.range(-jitter, jitter), -limit, limit);
      const z = clamp(base.z + rng.range(-jitter, jitter), -limit, limit);
      const bigBlock = district === 'industrial' && i % 2 === 1 && j % 2 === 1;
      const free = !bigBlock && clearOfRiver(cfg, river, x, z) && clearOfAvenues(net, cfg, avenues, x, z);
      grid[i].push(free ? net.addNode(x, z) : null);
    }
  }

  const link = (a, b) => {
    if (!a || !b || river.crosses(a.x, a.z, b.x, b.z) || crossesAnyEdge(net, a.x, a.z, b.x, b.z)) return;
    net.addEdge(a.id, b.id, 'rua');
  };
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      if (i + 1 < count) link(grid[i][j], grid[i + 1][j]);
      if (j + 1 < count) link(grid[i][j], grid[i][j + 1]);
    }
  }
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Gira e aperta o miolo do Centro; o efeito some aos poucos até 1,25 raio. */
function warpCentro(x, z, centro) {
  const dx = x - centro.x;
  const dz = z - centro.z;
  const u = Math.hypot(dx, dz) / (centro.radius * 1.25);
  const t = clamp((1 - u) / 0.5, 0, 1);
  const k = t * t * (3 - 2 * t);
  const cos = Math.cos(centro.rotation * k);
  const sin = Math.sin(centro.rotation * k);
  const scale = 1 - centro.squeeze * k;
  return { x: centro.x + (dx * cos - dz * sin) * scale, z: centro.z + (dx * sin + dz * cos) * scale };
}

function clearOfRiver(cfg, river, x, z) {
  const { signed } = river.nearest(x, z);
  if (signed > 0) return signed >= cfg.riverWidth / 2 + cfg.bankSouth;
  return -signed >= cfg.riverWidth / 2 + cfg.bankNorth + cfg.avenueClear * cfg.nodeSpacing;
}

function clearOfAvenues(net, cfg, avenues, x, z) {
  const clear = cfg.avenueClear * cfg.nodeSpacing;
  if (avenues.lines.some((line) => pointSegmentDistance(x, z, line.ax, line.az, line.bx, line.bz) < clear)) return false;
  return avenues.stubs.every((id) => distance(x, z, net.nodes[id].x, net.nodes[id].z) >= clear);
}

// ---------------------------------------------------------------- travessas

const armAngle = (net, from, to) => Math.atan2(net.nodes[to].z - net.nodes[from].z, net.nodes[to].x - net.nodes[from].x);

/** Uma rua nova de `p` até `q` cabe? Não cruza nada, não passa por cima de outro nó nem cola numa rua vizinha. */
function canLink(net, cfg, river, p, q, minAngleAtP, minAngleAtQ) {
  const a = net.nodes[p];
  const b = net.nodes[q];
  if (a.links.length >= 4 || b.links.length >= 4) return false;
  const tooTight = (from, to, minAngle) =>
    net.nodes[from].links.some((edge) => angleBetween(armAngle(net, from, net.other(edge, from)), armAngle(net, from, to)) < minAngle);
  if (tooTight(p, q, minAngleAtP) || tooTight(q, p, minAngleAtQ)) return false;
  if (river.crosses(a.x, a.z, b.x, b.z) || crossesAnyEdge(net, a.x, a.z, b.x, b.z, p, q)) return false;
  return !net.nodes.some((n) => n.alive && n.id !== p && n.id !== q && pointSegmentDistance(n.x, n.z, a.x, a.z, b.x, b.z) < 14);
}

/** Liga cada cruzamento da malha vizinho de uma avenida ao nó mais próximo dela, das travessas mais curtas às mais longas. */
function hookLattice(net, cfg, river, avenues) {
  const maxLength = cfg.hookMax * cfg.nodeSpacing;
  const lattice = net.nodes.filter((node) => node.alive && !node.avenue && !node.bridgeEnd);
  const candidates = [];
  for (const node of lattice) {
    avenues.chains.forEach((chain, c) => {
      const near = chain.map((q) => ({ p: node.id, q, c, length: distance(node.x, node.z, net.nodes[q].x, net.nodes[q].z) }));
      near.sort((a, b) => a.length - b.length);
      candidates.push(...near.slice(0, 2).filter((candidate) => candidate.length <= maxLength));
    });
  }
  candidates.sort((a, b) => a.length - b.length || a.p - b.p || a.q - b.q);

  const hooked = new Set();
  for (const { p, q, c } of candidates) {
    const key = p * 8 + c;
    if (hooked.has(key) || !canLink(net, cfg, river, p, q, 0.5, cfg.hookAngle)) continue;
    net.addEdge(p, q, 'rua', { hook: true });
    hooked.add(key);
  }
  for (const stub of avenues.stubs) hookStub(net, cfg, river, stub, lattice);
}

/** O toco de uma ponte de rua precisa continuar para dentro da margem sul, senão a ponte não leva a lugar nenhum. */
function hookStub(net, cfg, river, stub, lattice) {
  const here = net.nodes[stub];
  const near = lattice
    .filter((node) => node.alive)
    .map((node) => ({ id: node.id, length: distance(node.x, node.z, here.x, here.z) }))
    .filter((candidate) => candidate.length <= cfg.nodeSpacing * 1.8)
    .sort((a, b) => a.length - b.length || a.id - b.id);
  let made = 0;
  for (const { id } of near) {
    if (made < 2 && canLink(net, cfg, river, id, stub, 0.5, 0.9) && net.addEdge(id, stub, 'rua', { hook: true })) made++;
  }
  if (made > 0) return;
  const fallback = near.find(({ id }) => {
    const node = net.nodes[id];
    return !river.crosses(node.x, node.z, here.x, here.z) && !crossesAnyEdge(net, node.x, node.z, here.x, here.z, id, stub);
  });
  if (fallback) net.addEdge(fallback.id, stub, 'rua', { hook: true });
}

// ---------------------------------------------------------------- cortes e becos

function shuffled(items, rng) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Tira ruas ao acaso sem nunca partir a cidade em duas; só o Bairro pode ficar com becos sem saída. */
function thinStreets(net, cfg, river, districtAt, rng) {
  const districtOf = (edge) => {
    const a = net.nodes[edge.a];
    const b = net.nodes[edge.b];
    return districtAt((a.x + b.x) / 2, (a.z + b.z) / 2);
  };
  const removable = (edge) =>
    edge.alive && edge.kind === 'rua' && !edge.bridge && !net.nodes[edge.a].bridgeEnd && !net.nodes[edge.b].bridgeEnd;
  const tryRemove = (edge) => {
    net.removeEdge(edge);
    if (reachable(net, edge.a, edge.b, null)) return true;
    net.restoreEdge(edge);
    return false;
  };

  for (const edge of shuffled(net.edges.filter(removable), rng)) {
    const district = districtOf(edge);
    const chance = cfg.edgeRemoval * cfg.removalScale[district] * (edge.hook ? 0.5 : 1);
    const minDegree = district === 'bairro' ? 2 : 3;
    if (!rng.chance(chance)) continue;
    if (net.nodes[edge.a].links.length < minDegree || net.nodes[edge.b].links.length < minDegree) continue;
    tryRemove(edge);
  }

  const isStreetCorner = (node) => node.alive && !node.avenue && !node.bridgeEnd;
  const inBairro = (node) => districtAt(node.x, node.z) === 'bairro';
  // Pontas soltas que sobraram da montagem fora do Bairro (ruas cortadas pelo rio ou por uma avenida):
  // ganham uma rua até o cruzamento vizinho mais próximo ou, se não couber nenhuma, somem.
  for (let changed = true; changed; ) {
    changed = false;
    for (const node of net.nodes) {
      if (!isStreetCorner(node) || node.links.length !== 1 || inBairro(node)) continue;
      if (!extendDeadEnd(net, cfg, river, node)) net.removeNode(node);
      changed = true;
    }
  }

  let deadEnds = net.nodes.filter((node) => node.alive && node.links.length === 1).length;
  const corners = net.nodes.filter((node) => isStreetCorner(node) && inBairro(node));
  for (const node of shuffled(corners, rng)) {
    if (deadEnds >= cfg.deadEnds) break;
    if (node.links.length !== 2) continue;
    const edge = rng.pick(node.links);
    const far = net.nodes[net.other(edge, node.id)];
    if (removable(edge) && far.links.length >= 3 && tryRemove(edge)) deadEnds++;
  }
}

function extendDeadEnd(net, cfg, river, tip) {
  const near = net.nodes
    .filter((node) => node.alive && node.id !== tip.id && node.id !== net.other(tip.links[0], tip.id))
    .map((node) => ({ id: node.id, length: distance(node.x, node.z, tip.x, tip.z) }))
    .filter((candidate) => candidate.length <= cfg.nodeSpacing * 1.7)
    .sort((a, b) => a.length - b.length || a.id - b.id);
  return near.some(({ id }) => canLink(net, cfg, river, tip.id, id, 0.7, 0.7) && net.addEdge(tip.id, id, 'rua'));
}

// ---------------------------------------------------------------- formato do contrato

const round = (value) => Math.round(value * 100) / 100;

function finalize(net, cfg, river, districtAt) {
  const newId = new Map();
  const nodes = [];
  for (const node of net.nodes) {
    if (!node.alive || node.links.length === 0) continue;
    newId.set(node.id, nodes.length);
    nodes.push({ id: nodes.length, x: node.x, z: node.z, edges: [], district: districtAt(node.x, node.z), signal: false, radius: 0 });
  }

  const edges = [];
  for (const edge of net.edges) {
    if (!edge.alive) continue;
    const a = nodes[newId.get(edge.a)];
    const b = nodes[newId.get(edge.b)];
    const length = distance(a.x, a.z, b.x, b.z);
    const road = edge.kind === 'avenida' ? cfg.avenue : cfg.street;
    const id = edges.length;
    edges.push({
      id,
      a: a.id,
      b: b.id,
      length,
      dir: { x: (b.x - a.x) / length, z: (b.z - a.z) / length },
      kind: edge.kind,
      lanes: road.lanes,
      oneWay: false,
      speedLimit: road.speedLimit,
      bridge: edge.bridge,
      halfWidth: road.lanes * road.laneWidth,
    });
    a.edges.push(id);
    b.edges.push(id);
  }

  for (const node of nodes) node.radius = round(junctionRadius(node, nodes, edges, cfg.sidewalk));
  return { size: cfg.size, nodes, edges, river: { points: river.points.map((p) => ({ x: round(p.x), z: round(p.z) })), width: cfg.riverWidth } };
}

/**
 * Raio da área do cruzamento: vai até a esquina mais distante (onde as bordas de duas ruas vizinhas
 * se encontram) mais a largura da calçada, que é onde cabe a faixa de pedestre.
 */
function junctionRadius(node, nodes, edges, sidewalk) {
  const arms = node.edges.map((id) => {
    const edge = edges[id];
    const far = nodes[edge.a === node.id ? edge.b : edge.a];
    return { angle: Math.atan2(far.z - node.z, far.x - node.x), half: edge.halfWidth };
  });
  const widest = Math.max(...arms.map((arm) => arm.half));
  if (arms.length < 3) return widest;

  arms.sort((a, b) => a.angle - b.angle);
  let corner = widest;
  arms.forEach((arm, i) => {
    const next = arms[(i + 1) % arms.length];
    const phi = (next.angle - arm.angle + Math.PI * 2) % (Math.PI * 2);
    if (phi <= 0.05 || phi >= Math.PI - 0.05) return;
    const sin = Math.sin(phi);
    const cos = Math.cos(phi);
    corner = Math.max(corner, (next.half + arm.half * cos) / sin, (arm.half + next.half * cos) / sin);
  });
  return Math.min(corner, widest * 3) + sidewalk;
}

// ---------------------------------------------------------------- mão única e semáforos

function flip(edge) {
  [edge.a, edge.b] = [edge.b, edge.a];
  edge.dir = { x: -edge.dir.x, z: -edge.dir.z };
}

/** De qualquer cruzamento dá para chegar a qualquer outro respeitando as mãos? */
export function isStronglyConnected(city) {
  const sweep = (forward) => {
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const id = queue.pop();
      for (const edgeId of city.nodes[id].edges) {
        const edge = city.edges[edgeId];
        const leavesHere = forward ? edge.a === id : edge.b === id;
        if (edge.oneWay && !leavesHere) continue;
        const next = edge.a === id ? edge.b : edge.a;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen.size === city.nodes.length;
  };
  return sweep(true) && sweep(false);
}

function assignOneWays(city, cfg, rng) {
  const inCentro = (edge) => city.nodes[edge.a].district === 'centro' && city.nodes[edge.b].district === 'centro';
  const streets = city.edges.filter((edge) => edge.kind === 'rua' && !edge.bridge && inCentro(edge));
  let missing = Math.round(streets.length * cfg.oneWayShare);
  for (const edge of shuffled(streets, rng)) {
    if (missing === 0) break;
    const flipped = rng.chance(0.5);
    if (flipped) flip(edge);
    edge.oneWay = true;
    if (isStronglyConnected(city)) {
      missing--;
      continue;
    }
    edge.oneWay = false;
    if (flipped) flip(edge);
  }
}

function assignSignals(city, cfg, rng) {
  for (const node of city.nodes) {
    if (node.edges.length < 3) continue;
    const onAvenue = node.edges.some((id) => city.edges[id].kind === 'avenida');
    node.signal = onAvenue || rng.chance(cfg.signalShareStreets);
  }
}
