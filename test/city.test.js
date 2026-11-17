import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { generateCity } from '../src/sim/city/generator.js';

const cfg = config.city;
const SEEDS = [config.seed, 1, 2, 3, 42, 777];
const MIN_ANGLE = (28 * Math.PI) / 180;
const cities = new Map();
const cityFor = (seed) => {
  if (!cities.has(seed)) cities.set(seed, generateCity(cfg, createRng(seed).fork('cidade')));
  return cities.get(seed);
};
const forEachSeed = (name, check) => {
  for (const seed of SEEDS) test(`${name} [seed ${seed}]`, () => check(cityFor(seed)));
};

/* ---------- geometria independente da do gerador ---------- */

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}

const orient = (a, b, c) => Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
const properlyCross = (a, b, c, d) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;

const riverDistance = (city, p) =>
  Math.min(...city.river.points.slice(1).map((q, i) => distToSegment(p, city.river.points[i], q)));

const ends = (city, edge) => [city.nodes[edge.a], city.nodes[edge.b]];

function reachable(city, allowed) {
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const u = stack.pop();
    for (const id of city.nodes[u].edges) {
      const e = city.edges[id];
      const v = e.a === u ? e.b : e.a;
      if (!allowed(e, u) || seen.has(v)) continue;
      seen.add(v);
      stack.push(v);
    }
  }
  return seen.size;
}

/** Cantos de um lote: `heading` aponta para a rua, `d` ao longo dele, `w` atravessado. */
function lotCorners(lot, grow = 0) {
  const fx = Math.cos(lot.heading);
  const fz = Math.sin(lot.heading);
  const hd = lot.d / 2 + grow;
  const hw = lot.w / 2 + grow;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => ({
    x: lot.x + fx * hd * i - fz * hw * j,
    z: lot.z + fz * hd * i + fx * hw * j,
  }));
}

function distToLot(lot, p) {
  const fx = Math.cos(lot.heading);
  const fz = Math.sin(lot.heading);
  const along = (p.x - lot.x) * fx + (p.z - lot.z) * fz;
  const across = -(p.x - lot.x) * fz + (p.z - lot.z) * fx;
  return Math.hypot(Math.max(Math.abs(along) - lot.d / 2, 0), Math.max(Math.abs(across) - lot.w / 2, 0));
}

function lotsOverlap(p, q) {
  const cp = lotCorners(p, -0.05);
  const cq = lotCorners(q, -0.05);
  for (const h of [p.heading, p.heading + Math.PI / 2, q.heading, q.heading + Math.PI / 2]) {
    const proj = (c) => c.x * Math.cos(h) + c.z * Math.sin(h);
    const a = cp.map(proj);
    const b = cq.map(proj);
    if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
  }
  return true;
}

/* ---------- formato ---------- */

forEachSeed('cidade: segue o formato do contrato', (city) => {
  assert.equal(city.size, cfg.size);
  city.nodes.forEach((n, i) => {
    assert.equal(n.id, i);
    assert.ok(['centro', 'bairro', 'industrial'].includes(n.district));
    assert.equal(typeof n.signal, 'boolean');
    assert.ok(n.radius > 0 && n.edges.length > 0);
    assert.ok(Math.abs(n.x) <= cfg.size / 2 && Math.abs(n.z) <= cfg.size / 2);
    for (const id of n.edges) assert.ok(city.edges[id].a === i || city.edges[id].b === i);
  });
  city.edges.forEach((e, i) => {
    const [a, b] = ends(city, e);
    assert.equal(e.id, i);
    assert.ok(city.nodes[e.a].edges.includes(i) && city.nodes[e.b].edges.includes(i));
    assert.ok(Math.abs(e.length - dist(a, b)) < 1e-9);
    assert.ok(Math.abs(a.x + e.dir.x * e.length - b.x) < 1e-6 && Math.abs(a.z + e.dir.z * e.length - b.z) < 1e-6);
    const road = e.kind === 'avenida' ? cfg.avenue : cfg.street;
    assert.ok(e.kind === 'avenida' || e.kind === 'rua');
    assert.equal(e.lanes, road.lanes);
    assert.equal(e.speedLimit, road.speedLimit);
    assert.equal(e.halfWidth, road.lanes * road.laneWidth);
    assert.equal(typeof e.oneWay, 'boolean');
    assert.equal(typeof e.bridge, 'boolean');
    assert.ok(typeof e.name === 'string' && e.name.length > 3);
  });
  assert.equal(city.river.width, cfg.riverWidth);
  assert.ok(city.river.points.length > 10);
});

/* ---------- grafo ---------- */

forEachSeed('cidade: grafo conexo e fortemente conexo com mão única', (city) => {
  const n = city.nodes.length;
  assert.equal(reachable(city, () => true), n, 'conexo');
  assert.equal(reachable(city, (e, u) => !e.oneWay || e.a === u), n, 'todo nó alcançável');
  assert.equal(reachable(city, (e, u) => !e.oneWay || e.b === u), n, 'de todo nó se volta');
});

forEachSeed('cidade: exatamente 3 pontes e mais nada cruza o rio', (city) => {
  const pts = city.river.points;
  const crossesRiver = (e) => pts.slice(1).some((q, i) => properlyCross(...ends(city, e), pts[i], q));
  const bridges = city.edges.filter((e) => e.bridge);
  assert.equal(bridges.length, cfg.bridges);
  assert.equal(new Set(bridges.map((e) => e.name)).size, cfg.bridges);
  for (const e of city.edges) {
    assert.equal(crossesRiver(e), e.bridge, `aresta ${e.id}`);
    if (e.bridge) continue;
    const [a, b] = ends(city, e);
    for (let t = 0; t <= 1; t += 0.05) {
      const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      assert.ok(riverDistance(city, p) >= city.river.width / 2 + e.halfWidth, `aresta ${e.id} dentro d'água`);
    }
  }
  // sem as pontes, as duas margens ficam isoladas
  assert.ok(reachable(city, (e) => !e.bridge) < city.nodes.length);
});

forEachSeed('cidade: grau médio, becos e avenidas', (city) => {
  const avg = (2 * city.edges.length) / city.nodes.length;
  assert.ok(avg >= 2.4 && avg <= 3.4, `grau médio ${avg.toFixed(2)}`);
  const deadEnds = city.nodes.filter((n) => n.edges.length === 1);
  assert.ok(deadEnds.length >= 8, `${deadEnds.length} becos`);
  assert.ok(deadEnds.filter((n) => n.district === 'bairro').length >= 5);
  const avenues = new Set(city.edges.filter((e) => e.kind === 'avenida' && !e.bridge).map((e) => e.name));
  assert.equal(avenues.size, 3);
  assert.ok(avenues.has('Av. Marginal'));
  for (const d of ['centro', 'bairro', 'industrial']) assert.ok(city.nodes.filter((n) => n.district === d).length >= 15, d);
});

forEachSeed('cidade: planar, sem trecho curto nem ângulo fechado', (city) => {
  for (const e of city.edges) assert.ok(e.length >= 40, `aresta ${e.id} com ${e.length.toFixed(1)} m`);
  for (let i = 0; i < city.edges.length; i++) {
    for (let j = i + 1; j < city.edges.length; j++) {
      const e = city.edges[i];
      const f = city.edges[j];
      if (e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b) continue;
      assert.ok(!properlyCross(...ends(city, e), ...ends(city, f)), `arestas ${i} e ${j} se cruzam`);
    }
  }
  for (const node of city.nodes) {
    const angles = node.edges.map((id) => {
      const other = city.nodes[city.edges[id].a === node.id ? city.edges[id].b : city.edges[id].a];
      return Math.atan2(other.z - node.z, other.x - node.x);
    });
    for (let i = 0; i < angles.length; i++) {
      for (let j = i + 1; j < angles.length; j++) {
        const gap = Math.abs(angles[i] - angles[j]);
        assert.ok(Math.min(gap, 2 * Math.PI - gap) >= MIN_ANGLE, `ângulo fechado no nó ${node.id}`);
      }
    }
    // nenhuma rua passa raspando num cruzamento que não é dela
    for (const e of city.edges) {
      if (e.a === node.id || e.b === node.id) continue;
      assert.ok(distToSegment(node, ...ends(city, e)) >= 12, `aresta ${e.id} raspa no nó ${node.id}`);
    }
  }
});

forEachSeed('cidade: trechos da mesma via são contíguos e alinhados', (city) => {
  const byName = Map.groupBy(city.edges, (e) => e.name);
  for (const [name, edges] of byName) {
    if (edges.length === 1) continue;
    // a ponte tem nome próprio, mas não parte a avenida que passa por ela
    const ids = new Set(edges.concat(city.edges.filter((e) => e.bridge)).map((e) => e.id));
    const seen = new Set([edges[0].id]);
    const stack = [edges[0]];
    while (stack.length) {
      const e = stack.pop();
      for (const n of [e.a, e.b]) {
        for (const id of city.nodes[n].edges) {
          if (!ids.has(id) || seen.has(id)) continue;
          seen.add(id);
          stack.push(city.edges[id]);
        }
      }
    }
    assert.ok(edges.every((e) => seen.has(e.id)), `${name} está em pedaços`);
  }
});

forEachSeed('cidade: semáforos, raios e mão única', (city) => {
  let streetCrossings = 0;
  let streetSignals = 0;
  for (const node of city.nodes) {
    const incident = node.edges.map((id) => city.edges[id]);
    const onAvenue = incident.some((e) => e.kind === 'avenida');
    if (incident.length < 3) assert.equal(node.signal, false);
    else if (onAvenue) assert.equal(node.signal, true);
    else {
      streetCrossings++;
      streetSignals += node.signal;
    }
    assert.ok(node.radius >= Math.max(...incident.map((e) => e.halfWidth)));
  }
  const share = streetSignals / streetCrossings;
  assert.ok(share > 0.2 && share < 0.6, `semáforos em ${(share * 100).toFixed(0)}% dos cruzamentos de rua`);
  for (const e of city.edges) {
    assert.ok(city.nodes[e.a].radius + city.nodes[e.b].radius < e.length, `cruzamentos se sobrepõem na aresta ${e.id}`);
  }

  const inCentro = (e) => city.nodes[e.a].district === 'centro' || city.nodes[e.b].district === 'centro';
  const oneWay = city.edges.filter((e) => e.oneWay);
  for (const e of oneWay) assert.ok(e.kind === 'rua' && !e.bridge && inCentro(e));
  const centroStreets = city.edges.filter((e) => e.kind === 'rua' && inCentro(e)).length;
  assert.ok(oneWay.length / centroStreets > 0.07 && oneWay.length / centroStreets < 0.25, `${oneWay.length}/${centroStreets} mão única`);
});

/* ---------- POIs e lotes ---------- */

forEachSeed('cidade: POIs válidos', (city) => {
  const of = (type) => city.pois.filter((p) => p.type === type);
  assert.equal(of('restaurante').length, cfg.restaurants);
  assert.equal(of('cliente').length, cfg.customers);
  assert.equal(of('casa').length, 1);
  assert.equal(city.pois[city.homeId].type, 'casa');
  assert.equal(new Set(city.pois.map((p) => p.name)).size, city.pois.length, 'nomes repetidos');

  const districtOf = (p) => city.nodes[city.edges[p.edge].a].district;
  assert.ok(of('restaurante').filter((p) => districtOf(p) === 'centro').length > cfg.restaurants / 2);
  assert.ok(new Set(of('cliente').map(districtOf)).size === 3, 'clientes nos três distritos');
  const home = city.pois[city.homeId];
  assert.ok([city.edges[home.edge].a, city.edges[home.edge].b].some((n) => city.nodes[n].district === 'bairro'));

  city.pois.forEach((p, i) => {
    const e = city.edges[p.edge];
    const a = city.nodes[e.a];
    assert.equal(p.id, i);
    assert.ok(!e.bridge && p.t > 0 && p.t < 1 && (p.side === 1 || p.side === -1));
    const curb = {
      x: a.x + e.dir.x * e.length * p.t - e.dir.z * p.side * e.halfWidth,
      z: a.z + e.dir.z * e.length * p.t + e.dir.x * p.side * e.halfWidth,
    };
    assert.ok(dist(p, curb) < 0.02, `POI ${i} fora do meio-fio`);
    for (const n of city.nodes) assert.ok(dist(p, n) >= 15, `POI ${i} perto do cruzamento ${n.id}`);
    if (p.type === 'cliente') assert.match(p.name, new RegExp(`^${e.name}, \\d+$`));
  });
});

forEachSeed('cidade: lotes não invadem rua, cruzamento, rio nem outro lote', (city) => {
  const ranges = Object.fromEntries(
    Object.values(cfg.lots.districts).flatMap((s) => s.kinds.map((k) => [k.kind, k])),
  );
  const kindsOf = { centro: ['predio', 'arranha-ceu'], bairro: ['casa', 'praca'], industrial: ['galpao'] };
  const limit = cfg.size / 2;
  const maxReach = 30; // meia diagonal do maior lote

  city.lots.forEach((lot, i) => {
    assert.ok(kindsOf[lot.district].includes(lot.kind), `lote ${i}: ${lot.kind} em ${lot.district}`);
    const r = ranges[lot.kind];
    assert.ok(lot.w >= r.w[0] && lot.w <= r.w[1] && lot.d >= r.d[0] && lot.d <= r.d[1], `lote ${i} fora do tamanho`);
    assert.ok(Number.isInteger(lot.seed));
    for (const c of lotCorners(lot)) assert.ok(Math.abs(c.x) <= limit && Math.abs(c.z) <= limit, `lote ${i} fora do mapa`);
    if (riverDistance(city, lot) < maxReach + city.river.width) {
      for (const c of lotCorners(lot)) assert.ok(riverDistance(city, c) >= city.river.width / 2, `lote ${i} no rio`);
    }
    for (const e of city.edges) {
      const [a, b] = ends(city, e);
      if (distToSegment(lot, a, b) > maxReach + e.halfWidth + cfg.sidewalk) continue;
      const need = e.halfWidth + cfg.sidewalk - 0.3;
      for (let s = 0; s <= e.length; s += 1) {
        const p = { x: a.x + e.dir.x * s, z: a.z + e.dir.z * s };
        assert.ok(distToLot(lot, p) >= need, `lote ${i} invade a aresta ${e.id}`);
      }
      for (const n of [a, b]) assert.ok(distToLot(lot, n) >= n.radius, `lote ${i} invade o cruzamento ${n.id}`);
    }
  });

  const sorted = city.lots.map((lot, i) => ({ lot, i })).sort((p, q) => p.lot.x - q.lot.x);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].lot.x - sorted[i].lot.x < 2 * maxReach; j++) {
      assert.ok(!lotsOverlap(sorted[i].lot, sorted[j].lot), `lotes ${sorted[i].i} e ${sorted[j].i} se sobrepõem`);
    }
  }
});

forEachSeed('cidade: lotes cobrem os três distritos e olham para a rua', (city) => {
  const count = (kind) => city.lots.filter((l) => l.kind === kind).length;
  assert.ok(city.lots.length > 1500, `${city.lots.length} lotes`);
  for (const [kind, min] of [['predio', 150], ['arranha-ceu', 10], ['casa', 500], ['praca', 5], ['galpao', 100]]) {
    assert.ok(count(kind) >= min, `${count(kind)} × ${kind}`);
  }
  // na direção da fachada tem que haver uma rua antes de qualquer coisa a mais de um quarteirão
  let facing = 0;
  for (const lot of city.lots) {
    const probe = { x: lot.x + Math.cos(lot.heading) * (lot.d / 2 + 60), z: lot.z + Math.sin(lot.heading) * (lot.d / 2 + 60) };
    if (city.edges.some((e) => properlyCross(lot, probe, ...ends(city, e)))) facing++;
  }
  assert.ok(facing / city.lots.length > 0.9, `${facing}/${city.lots.length} lotes de frente para uma rua`);
});

/* ---------- determinismo e desempenho ---------- */

test('cidade: mesma seed ⇒ JSON idêntico; seeds diferentes ⇒ mapas diferentes', () => {
  const again = generateCity(cfg, createRng(config.seed).fork('cidade'));
  assert.equal(JSON.stringify(again), JSON.stringify(cityFor(config.seed)));
  const jsons = new Set(SEEDS.map((seed) => JSON.stringify(cityFor(seed).nodes)));
  assert.equal(jsons.size, SEEDS.length);
});

test('cidade: geração leva bem menos de 1 s', () => {
  generateCity(cfg, createRng(5).fork('cidade')); // aquece o JIT
  const start = performance.now();
  generateCity(cfg, createRng(config.seed).fork('cidade'));
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 500, `${elapsed.toFixed(0)} ms`);
});

test('cidade: 40 seeds seguidas geram sem falhar', () => {
  for (let seed = 100; seed < 140; seed++) {
    const city = generateCity(cfg, createRng(seed).fork('cidade'));
    assert.equal(city.edges.filter((e) => e.bridge).length, cfg.bridges);
    assert.equal(city.pois.length, cfg.restaurants + cfg.customers + 1);
  }
});
