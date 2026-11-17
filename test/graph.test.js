import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { generateCity } from '../src/sim/city/generator.js';
import { createGraph } from '../src/sim/city/graph.js';

const SEEDS = [config.seed, 1, 2, 3, 42, 777];
const worlds = new Map();
const worldFor = (seed) => {
  if (!worlds.has(seed)) {
    const city = generateCity(config.city, createRng(seed).fork('cidade'));
    worlds.set(seed, { city, graph: createGraph(city) });
  }
  return worlds.get(seed);
};
const forEachSeed = (name, check) => {
  for (const seed of SEEDS) test(`${name} [seed ${seed}]`, () => check(worldFor(seed), createRng(seed).fork('teste')));
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const polylineLength = (points) => points.slice(1).reduce((sum, p, i) => sum + dist(points[i], p), 0);

/** Confere que a rota é uma viagem contínua e legal de `from` a `to`. */
function assertValidRoute({ city, graph }, from, to, route, label) {
  assert.ok(route, `${label}: sem rota`);
  assert.ok(Math.abs(route.length - polylineLength(route.points)) < 1e-6, `${label}: length ≠ soma dos pontos`);
  assert.ok(dist(route.points[0], graph.pointOnEdge(from.edge, from.t)) < 1e-9, `${label}: começo`);
  assert.ok(dist(route.points.at(-1), graph.pointOnEdge(to.edge, to.t)) < 1e-9, `${label}: fim`);
  assert.equal(route.steps[0].edge, from.edge);
  assert.equal(route.steps.at(-1).edge, to.edge);
  assert.equal(route.points.length, route.steps.length + 1);

  route.steps.forEach((step, i) => {
    const edge = city.edges[step.edge];
    assert.ok(step.forward || !edge.oneWay, `${label}: contramão na aresta ${edge.id}`);
    if (i === 0) return;
    const prev = city.edges[route.steps[i - 1].edge];
    const joint = route.steps[i - 1].forward ? prev.b : prev.a;
    assert.equal(step.forward ? edge.a : edge.b, joint, `${label}: passos ${i - 1} e ${i} não se encontram`);
    assert.ok(graph.canTravel(edge.id, joint));
    assert.ok(dist(route.points[i], city.nodes[joint]) < 1e-9, `${label}: ponto ${i} fora do nó`);
  });
}

forEachSeed('grafo: há rota válida entre todo par de POIs, sem contramão', (world) => {
  const { city, graph } = world;
  for (const from of city.pois) {
    for (const to of city.pois) {
      const route = graph.route(from, to);
      assertValidRoute(world, from, to, route, `${from.id}→${to.id}`);
      assert.ok(route.length >= dist(graph.pointOnEdge(from.edge, from.t), graph.pointOnEdge(to.edge, to.t)) - 1e-6);
    }
  }
});

forEachSeed('grafo: a rota do A* é a mais curta (confere com Dijkstra ingênuo)', ({ city, graph }, rng) => {
  /** Distância mínima de cada nó até `to`, por Bellman–Ford no grafo invertido. */
  function distancesTo(to) {
    const last = city.edges[to.edge];
    const best = new Array(city.nodes.length).fill(Infinity);
    best[last.a] = to.t * last.length;
    if (!last.oneWay) best[last.b] = Math.min(best[last.b], (1 - to.t) * last.length);
    for (let changed = true; changed; ) {
      changed = false;
      for (const e of city.edges) {
        if (best[e.b] + e.length < best[e.a] - 1e-9) (best[e.a] = best[e.b] + e.length), (changed = true);
        if (!e.oneWay && best[e.a] + e.length < best[e.b] - 1e-9) (best[e.b] = best[e.a] + e.length), (changed = true);
      }
    }
    return best;
  }
  for (let i = 0; i < 40; i++) {
    const from = { edge: rng.int(0, city.edges.length - 1), t: rng.next() };
    const to = { edge: rng.int(0, city.edges.length - 1), t: rng.next() };
    if (from.edge === to.edge) continue;
    const first = city.edges[from.edge];
    const best = distancesTo(to);
    const expected = Math.min(
      (1 - from.t) * first.length + best[first.b],
      first.oneWay ? Infinity : from.t * first.length + best[first.a],
    );
    assert.ok(Math.abs(graph.route(from, to).length - expected) < 1e-6);
  }
});

forEachSeed('grafo: rota na mesma aresta', ({ city, graph }) => {
  const twoWay = city.edges.find((e) => !e.oneWay);
  const back = graph.route({ edge: twoWay.id, t: 0.8 }, { edge: twoWay.id, t: 0.3 });
  assert.deepEqual(back.steps, [{ edge: twoWay.id, forward: false }]);
  assert.ok(Math.abs(back.length - 0.5 * twoWay.length) < 1e-9);

  const oneWay = city.edges.find((e) => e.oneWay);
  const ahead = graph.route({ edge: oneWay.id, t: 0.2 }, { edge: oneWay.id, t: 0.9 });
  assert.deepEqual(ahead.steps, [{ edge: oneWay.id, forward: true }]);
  // destino atrás numa mão única: tem que dar a volta no quarteirão
  const from = { edge: oneWay.id, t: 0.9 };
  const to = { edge: oneWay.id, t: 0.2 };
  const around = graph.route(from, to);
  assertValidRoute({ city, graph }, from, to, around, 'volta no quarteirão');
  assert.ok(around.steps.length >= 3 && around.length > oneWay.length);
});

forEachSeed('grafo: nearestEdge confere com a busca bruta', ({ city, graph }, rng) => {
  const reach = city.size * 0.6; // inclui pontos fora do mapa
  const out = {};
  for (let i = 0; i < 3000; i++) {
    const p = { x: rng.range(-reach, reach), z: rng.range(-reach, reach) };
    let best = Infinity;
    for (const e of city.edges) {
      const a = city.nodes[e.a];
      const along = Math.min(e.length, Math.max(0, (p.x - a.x) * e.dir.x + (p.z - a.z) * e.dir.z));
      best = Math.min(best, Math.hypot(p.x - a.x - e.dir.x * along, p.z - a.z - e.dir.z * along));
    }
    const hit = graph.nearestEdge(p.x, p.z, out);
    assert.equal(hit, out);
    assert.ok(Math.abs(hit.dist - best) < 1e-9, `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}): ${hit.dist} ≠ ${best}`);
    assert.ok(hit.t >= 0 && hit.t <= 1);
    assert.ok(Math.abs(dist(p, graph.pointOnEdge(hit.edge, hit.t)) - hit.dist) < 1e-6);
    // o ponto do eixo deslocado `dist` para o lado `side` volta ao ponto original (quando a projeção cai no trecho)
    if (hit.t > 0 && hit.t < 1) assert.ok(dist(p, graph.pointOnEdge(hit.edge, hit.t, hit.side * hit.dist)) < 1e-6);
  }
  assert.notEqual(graph.nearestEdge(0, 0), graph.nearestEdge(0, 0), 'sem `out`, cada chamada devolve um objeto novo');
});

test('grafo: pointOnEdge, canTravel e otherEnd', () => {
  const { city, graph } = worldFor(config.seed);
  const edge = city.edges.find((e) => e.oneWay);
  const a = city.nodes[edge.a];
  const b = city.nodes[edge.b];
  assert.ok(dist(graph.pointOnEdge(edge.id, 0), a) < 1e-9);
  assert.ok(dist(graph.pointOnEdge(edge.id, 1), b) < 1e-9);
  // mão direita: o lado direito de d é (-d.z, d.x)
  const right = graph.pointOnEdge(edge.id, 0, 2);
  assert.ok(Math.abs(right.x - (a.x - edge.dir.z * 2)) < 1e-9 && Math.abs(right.z - (a.z + edge.dir.x * 2)) < 1e-9);
  assert.equal(graph.nearestEdge(right.x + edge.dir.x * 20, right.z + edge.dir.z * 20).side, 1);
  assert.equal(graph.canTravel(edge.id, edge.a), true);
  assert.equal(graph.canTravel(edge.id, edge.b), false);
  assert.equal(graph.otherEnd(edge.id, edge.a), edge.b);
  assert.equal(graph.otherEnd(edge.id, edge.b), edge.a);
});

test('grafo: nearestEdge é rápido o bastante para rodar todo passo', () => {
  const { graph } = worldFor(config.seed);
  const rng = createRng(9);
  const out = {};
  const start = performance.now();
  for (let i = 0; i < 100000; i++) graph.nearestEdge(rng.range(-800, 800), rng.range(-800, 800), out);
  const perCall = (performance.now() - start) / 100000;
  assert.ok(perCall < 0.01, `${(perCall * 1000).toFixed(2)} µs por chamada`);
});
