import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { generateCity, isStronglyConnected } from '../src/sim/city/generator.js';
import { createPolyline, segmentRectDistance, segmentsCross } from '../src/sim/city/geometry.js';

const build = (seed) => generateCity(config.city, createRng(seed).fork('cidade'));
const city = build(config.seed);
// As propriedades estruturais têm de valer para qualquer seed, não só para a do jogo.
const cities = [city, ...[1, 2, 3, 4, 5, 6, 7].map(build)];

const ends = (c, edge) => [c.nodes[edge.a], c.nodes[edge.b]];
const deadEnds = (c) => c.nodes.filter((node) => node.edges.length === 1).length;

function isConnected(c) {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const id = queue.pop();
    for (const edgeId of c.nodes[id].edges) {
      const edge = c.edges[edgeId];
      const next = edge.a === id ? edge.b : edge.a;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === c.nodes.length;
}

test('cidade: segue o formato do contrato', () => {
  assert.equal(city.size, config.city.size);
  city.nodes.forEach((node, i) => {
    assert.equal(node.id, i);
    assert.ok(['centro', 'bairro', 'industrial'].includes(node.district));
    assert.equal(typeof node.signal, 'boolean');
    assert.ok(node.radius > 0 && node.edges.length > 0);
    for (const edgeId of node.edges) assert.ok(city.edges[edgeId].a === i || city.edges[edgeId].b === i);
  });
  city.edges.forEach((edge, i) => {
    const [a, b] = ends(city, edge);
    assert.equal(edge.id, i);
    assert.ok(a.edges.includes(i) && b.edges.includes(i));
    assert.ok(Math.abs(edge.length - Math.hypot(b.x - a.x, b.z - a.z)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(edge.dir.x, edge.dir.z) - 1) < 1e-9);
    assert.ok(Math.abs(a.x + edge.dir.x * edge.length - b.x) < 1e-6, 'dir aponta de a para b');
    assert.ok(['rua', 'avenida'].includes(edge.kind));
    const road = edge.kind === 'avenida' ? config.city.avenue : config.city.street;
    assert.equal(edge.lanes, road.lanes);
    assert.equal(edge.speedLimit, road.speedLimit);
    assert.equal(edge.halfWidth, road.lanes * road.laneWidth);
  });
  assert.equal(city.river.width, config.city.riverWidth);
  assert.equal(city.pois[city.homeId].type, 'casa');
});

test('cidade: mesma seed gera o mesmo mapa, seed diferente gera outro', () => {
  assert.deepEqual(build(config.seed), city);
  assert.notDeepEqual(cities[1].nodes, city.nodes);
});

test('cidade: o grafo é conexo, também respeitando as mãos únicas', () => {
  for (const c of cities) {
    assert.ok(isConnected(c));
    assert.ok(isStronglyConnected(c));
  }
});

test('cidade: exatamente 3 pontes, e só elas cruzam o rio', () => {
  for (const c of cities) {
    const river = createPolyline(c.river.points);
    const crossing = c.edges.filter((edge) => {
      const [a, b] = ends(c, edge);
      return river.crosses(a.x, a.z, b.x, b.z);
    });
    assert.equal(crossing.length, config.city.bridges);
    assert.ok(crossing.every((edge) => edge.bridge));
    assert.equal(c.edges.filter((edge) => edge.bridge).length, config.city.bridges);
  }
});

test('cidade: grau médio entre 2,4 e 3,4 e pelo menos 8 becos sem saída', () => {
  for (const c of cities) {
    const degree = (2 * c.edges.length) / c.nodes.length;
    assert.ok(degree >= 2.4 && degree <= 3.4, `grau médio ${degree}`);
    assert.ok(deadEnds(c) >= 8, `${deadEnds(c)} becos`);
    assert.ok(c.nodes.every((node) => node.edges.length <= 4));
  }
});

test('cidade: becos sem saída só no Bairro', () => {
  for (const c of cities) {
    const tips = c.nodes.filter((node) => node.edges.length === 1 && c.edges[node.edges[0]].kind === 'rua');
    assert.ok(tips.every((node) => node.district === 'bairro'));
  }
});

test('cidade: nenhuma via cruza outra fora de um cruzamento', () => {
  for (const c of cities) {
    for (let i = 0; i < c.edges.length; i++) {
      for (let j = i + 1; j < c.edges.length; j++) {
        const [a, b] = ends(c, c.edges[i]);
        const [p, q] = ends(c, c.edges[j]);
        assert.ok(!segmentsCross(a.x, a.z, b.x, b.z, p.x, p.z, q.x, q.z), `arestas ${i} e ${j} se cruzam`);
      }
    }
  }
});

test('cidade: ruas têm tamanho de rua e ficam dentro do mundo', () => {
  for (const c of cities) {
    const half = c.size / 2;
    assert.ok(c.nodes.every((node) => Math.abs(node.x) < half && Math.abs(node.z) < half));
    assert.ok(c.edges.every((edge) => edge.length >= 30), 'nenhuma via menor que 30 m');
    for (const edge of c.edges) {
      const [a, b] = ends(c, edge);
      assert.ok(edge.length > a.radius + b.radius, 'sobra pista entre os dois cruzamentos');
    }
  }
});

test('cidade: três distritos, avenidas com semáforo e mão única só no Centro', () => {
  for (const c of cities) {
    for (const district of ['centro', 'bairro', 'industrial']) {
      assert.ok(c.nodes.filter((node) => node.district === district).length >= 20, district);
    }
    const avenues = c.edges.filter((edge) => edge.kind === 'avenida');
    assert.ok(avenues.length >= 40);
    for (const node of c.nodes) {
      const onAvenue = node.edges.some((id) => c.edges[id].kind === 'avenida');
      if (onAvenue && node.edges.length >= 3) assert.ok(node.signal);
      if (node.edges.length < 3) assert.ok(!node.signal);
    }
    const oneWays = c.edges.filter((edge) => edge.oneWay);
    assert.ok(oneWays.length >= 3);
    assert.ok(oneWays.every((edge) => edge.kind === 'rua' && !edge.bridge && ends(c, edge).every((n) => n.district === 'centro')));
  }
});

test('cidade: restaurantes, clientes e casa presos a pontos válidos das ruas', () => {
  for (const c of cities) {
    const count = (type) => c.pois.filter((poi) => poi.type === type).length;
    assert.equal(count('restaurante'), config.city.restaurants);
    assert.equal(count('cliente'), config.city.customers);
    assert.equal(count('casa'), 1);
    c.pois.forEach((poi, i) => {
      const edge = c.edges[poi.edge];
      const a = c.nodes[edge.a];
      assert.equal(poi.id, i);
      assert.ok(poi.name.length > 0 && !edge.bridge && poi.t > 0 && poi.t < 1 && Math.abs(poi.side) === 1);
      const lateral = poi.side * (edge.halfWidth - 1);
      assert.ok(Math.abs(a.x + edge.dir.x * poi.t * edge.length - edge.dir.z * lateral - poi.x) < 1e-6);
      assert.ok(Math.abs(a.z + edge.dir.z * poi.t * edge.length + edge.dir.x * lateral - poi.z) < 1e-6);
    });
    const centralEdge = (poi) => ends(c, c.edges[poi.edge]).some((node) => node.district === 'centro');
    const central = c.pois.filter((poi) => poi.type === 'restaurante' && centralEdge(poi)).length;
    assert.ok(central >= config.city.restaurants / 2, `${central} restaurantes no Centro`);

    const river = createPolyline(c.river.points);
    const home = c.pois[c.homeId];
    assert.ok(ends(c, c.edges[home.edge]).every((node) => node.district === 'bairro'));
    assert.ok(river.nearest(home.x, home.z).signed > 0, 'a casa fica na margem oposta à do Centro');
  }
});

test('cidade: lotes não invadem rua, calçada, rio nem a borda do mundo', () => {
  const river = createPolyline(city.river.points);
  const kinds = new Set(city.lots.map((lot) => lot.kind));
  assert.ok(city.lots.length >= 1000, `${city.lots.length} lotes`);
  assert.deepEqual([...kinds].sort(), ['arranha-ceu', 'casa', 'galpao', 'praca', 'predio']);
  for (const lot of city.lots) {
    const rect = { x: lot.x, z: lot.z, hu: lot.d / 2, hv: lot.w / 2, heading: lot.heading };
    assert.ok(Math.abs(lot.x) < city.size / 2 && Math.abs(lot.z) < city.size / 2);
    assert.ok(river.nearest(lot.x, lot.z).dist > city.river.width / 2 + Math.min(lot.w, lot.d) / 2);
    for (const edge of city.edges) {
      const [a, b] = ends(city, edge);
      const gap = segmentRectDistance(a.x, a.z, b.x, b.z, rect);
      assert.ok(gap >= edge.halfWidth + config.city.sidewalk - 0.05, `lote em cima da via ${edge.id}`);
    }
  }
});

test('cidade: toda fachada dá para uma rua próxima', () => {
  for (const lot of city.lots) {
    const reach = lot.d / 2 + config.city.sidewalk + config.city.avenue.lanes * config.city.avenue.laneWidth + 4;
    const fx = lot.x + Math.cos(lot.heading) * reach;
    const fz = lot.z + Math.sin(lot.heading) * reach;
    const facesStreet = city.edges.some((edge) => {
      const [a, b] = ends(city, edge);
      return segmentsCross(lot.x, lot.z, fx, fz, a.x, a.z, b.x, b.z);
    });
    assert.ok(facesStreet, `lote em (${lot.x}, ${lot.z}) de costas para a rua`);
  }
});
