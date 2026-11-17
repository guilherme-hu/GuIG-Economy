import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { generateCity } from '../src/sim/city/generator.js';
import { createGraph } from '../src/sim/city/graph.js';
import { pointSegmentDistance } from '../src/sim/city/geometry.js';

const city = generateCity(config.city, createRng(config.seed).fork('cidade'));
const graph = createGraph(city);
const spot = (poi) => ({ edge: poi.edge, t: poi.t });
const pathLength = (points) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.z - points[i].z), 0);

test('grafo: nearestEdge acha a mesma via que a busca exaustiva', () => {
  const rng = createRng(99);
  const half = city.size / 2;
  for (let i = 0; i < 600; i++) {
    const x = rng.range(-half, half);
    const z = rng.range(-half, half);
    const brute = Math.min(...city.edges.map((edge) => {
      const a = city.nodes[edge.a];
      const b = city.nodes[edge.b];
      return pointSegmentDistance(x, z, a.x, a.z, b.x, b.z);
    }));
    const found = graph.nearestEdge(x, z);
    assert.ok(Math.abs(found.dist - brute) < 1e-9, `(${x}, ${z}): ${found.dist} contra ${brute}`);
    assert.ok(found.t >= 0 && found.t <= 1);
  }
});

test('grafo: nearestEdge e pointOnEdge concordam sobre posição e lado', () => {
  for (const edge of city.edges) {
    for (const lateral of [2, -2]) {
      const p = graph.pointOnEdge(edge.id, 0.5, lateral);
      const found = graph.nearestEdge(p.x, p.z);
      assert.equal(found.edge, edge.id);
      assert.ok(Math.abs(found.t - 0.5) < 1e-6 && Math.abs(found.dist - 2) < 1e-6);
      assert.equal(found.side, Math.sign(lateral), 'lateral positivo é a direita de a→b');
    }
  }
  // Direita de uma via que aponta para +X é +Z.
  const east = city.edges.find((edge) => edge.dir.x > 0.95);
  const a = city.nodes[east.a];
  assert.ok(graph.pointOnEdge(east.id, 0, 5).z > a.z);
});

test('grafo: nearestEdge reaproveita o objeto de saída', () => {
  const out = {};
  assert.equal(graph.nearestEdge(0, 0, out), out);
  assert.deepEqual(Object.keys(out).sort(), ['dist', 'edge', 'side', 't']);
});

test('grafo: canTravel e otherEnd', () => {
  for (const edge of city.edges) {
    assert.equal(graph.otherEnd(edge.id, edge.a), edge.b);
    assert.equal(graph.otherEnd(edge.id, edge.b), edge.a);
    assert.equal(graph.canTravel(edge.id, edge.a), true);
    assert.equal(graph.canTravel(edge.id, edge.b), !edge.oneWay);
  }
});

test('grafo: existe rota entre todo par de POIs, contínua e sem contramão', () => {
  for (const from of city.pois) {
    for (const to of city.pois) {
      const route = graph.route(spot(from), spot(to));
      assert.ok(route, `sem rota de ${from.name} para ${to.name}`);
      const start = graph.pointOnEdge(from.edge, from.t);
      const finish = graph.pointOnEdge(to.edge, to.t);
      const straight = Math.hypot(finish.x - start.x, finish.z - start.z);
      assert.ok(Math.abs(pathLength(route.points) - route.length) < 1e-6, 'length é o comprimento de points');
      assert.ok(route.length >= straight - 1e-6);
      assert.deepEqual(route.points[0], start);
      assert.deepEqual(route.points.at(-1), finish);
      assert.equal(route.steps[0].edge, from.edge);
      assert.equal(route.steps.at(-1).edge, to.edge);
      assert.equal(route.points.length, route.steps.length + 1);

      route.steps.forEach((step, i) => {
        const edge = city.edges[step.edge];
        assert.ok(step.forward || !edge.oneWay, `contramão na via ${edge.id}`);
        if (i === 0) return;
        const previous = city.edges[route.steps[i - 1].edge];
        const leftAt = route.steps[i - 1].forward ? previous.b : previous.a;
        const enteredAt = step.forward ? edge.a : edge.b;
        assert.equal(enteredAt, leftAt, 'passos consecutivos se encontram num cruzamento');
        assert.deepEqual(route.points[i], { x: city.nodes[leftAt].x, z: city.nodes[leftAt].z });
      });
    }
  }
});

test('grafo: rota dentro da mesma via', () => {
  const edge = city.edges.find((e) => !e.oneWay);
  const ahead = graph.route({ edge: edge.id, t: 0.2 }, { edge: edge.id, t: 0.7 });
  const back = graph.route({ edge: edge.id, t: 0.7 }, { edge: edge.id, t: 0.2 });
  assert.ok(Math.abs(ahead.length - 0.5 * edge.length) < 1e-9);
  assert.deepEqual(ahead.steps, [{ edge: edge.id, forward: true }]);
  assert.deepEqual(back.steps, [{ edge: edge.id, forward: false }]);
  assert.equal(graph.route({ edge: edge.id, t: 0.4 }, { edge: edge.id, t: 0.4 }).length, 0);
});

test('grafo: voltar numa mão única obriga a dar a volta no quarteirão', () => {
  const oneWays = city.edges.filter((edge) => edge.oneWay);
  assert.ok(oneWays.length > 0);
  for (const edge of oneWays) {
    const route = graph.route({ edge: edge.id, t: 0.8 }, { edge: edge.id, t: 0.2 });
    assert.ok(route.length > edge.length, 'mais longo que a própria via');
    assert.ok(route.steps.length >= 3);
    assert.ok(route.steps.every((step) => step.forward || !city.edges[step.edge].oneWay));
  }
});

test('grafo: a rota é a mais curta (confere com Dijkstra simples)', () => {
  const rng = createRng(5);
  for (let i = 0; i < 80; i++) {
    const from = rng.pick(city.pois);
    const to = rng.pick(city.pois);
    if (from.edge === to.edge) continue;
    assert.ok(Math.abs(graph.route(spot(from), spot(to)).length - slowShortest(from, to)) < 1e-6);
  }
});

/** Dijkstra sem heurística nem heap, só para servir de gabarito. */
function slowShortest(from, to) {
  const first = city.edges[from.edge];
  const last = city.edges[to.edge];
  const cost = city.nodes.map(() => Infinity);
  const done = new Set();
  cost[first.b] = (1 - from.t) * first.length;
  if (!first.oneWay) cost[first.a] = from.t * first.length;
  for (;;) {
    let id = -1;
    cost.forEach((value, i) => {
      if (!done.has(i) && value < Infinity && (id === -1 || value < cost[id])) id = i;
    });
    if (id === -1) break;
    done.add(id);
    for (const edgeId of city.nodes[id].edges) {
      const edge = city.edges[edgeId];
      if (edge.oneWay && edge.a !== id) continue;
      const next = edge.a === id ? edge.b : edge.a;
      cost[next] = Math.min(cost[next], cost[id] + edge.length);
    }
  }
  const viaA = cost[last.a] + to.t * last.length;
  const viaB = last.oneWay ? Infinity : cost[last.b] + (1 - to.t) * last.length;
  return Math.min(viaA, viaB);
}

test('grafo: projectOnEdge e nearbyEdges', () => {
  for (const edge of city.edges) {
    const p = graph.pointOnEdge(edge.id, 0.25, -3);
    const found = graph.projectOnEdge(edge.id, p.x, p.z);
    assert.ok(Math.abs(found.t - 0.25) < 1e-9 && Math.abs(found.dist - 3) < 1e-9);
    const expected = new Set([...city.nodes[edge.a].edges, ...city.nodes[edge.b].edges]);
    expected.delete(edge.id);
    assert.deepEqual([...graph.nearbyEdges(edge.id)].sort((x, y) => x - y), [...expected].sort((x, y) => x - y));
  }
  const out = {};
  assert.equal(graph.projectOnEdge(0, 0, 0, out), out);
});
