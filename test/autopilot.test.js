import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { generateCity } from '../src/sim/city/generator.js';
import { createGraph } from '../src/sim/city/graph.js';
import { createBike } from '../src/sim/bike.js';
import { createAutopilot } from '../src/sim/autopilot.js';

const city = generateCity(config.city, createRng(config.seed).fork('cidade'));
const graph = createGraph(city);
const DT = 1 / 60;

function spawnAt(poi) {
  const edge = city.edges[poi.edge];
  const facing = poi.side > 0 ? 0 : Math.PI;
  return { x: poi.x, z: poi.z, heading: Math.atan2(edge.dir.z, edge.dir.x) + facing };
}

/** Leva a moto de um POI a outro no piloto automático; devolve o que aconteceu no caminho. */
function drive(from, to, maxSeconds = 600) {
  const bike = createBike(config.bike, { city, graph }, spawnAt(from));
  const pilot = createAutopilot({ city, graph, bike, config: config.autopilot });
  assert.ok(pilot.goTo({ edge: to.edge, t: to.t }));
  const trip = { bike, seconds: 0, hits: 0, topSpeed: 0 };
  while (pilot.active && trip.seconds < maxSeconds) {
    bike.step(pilot.step(DT), DT);
    trip.seconds += DT;
    if (bike.wallHit > 0) trip.hits++;
    trip.topSpeed = Math.max(trip.topSpeed, bike.speed);
  }
  // Chegando, ele segura o freio; um segundo basta para a moto parar de vez.
  for (let i = 0; i < 1 / DT; i++) bike.step(pilot.step(DT), DT);
  trip.arrived = pilot.arrived;
  trip.missBy = Math.hypot(bike.x - to.x, bike.z - to.z);
  return trip;
}

const home = city.pois[city.homeId];
const farthest = (type) =>
  city.pois.filter((poi) => poi.type === type).sort((p, q) => Math.hypot(q.x - home.x, q.z - home.z) - Math.hypot(p.x - home.x, p.z - home.z))[0];

test('piloto automático: atravessa a cidade de ponta a ponta sem bater em prédio', () => {
  const target = farthest('cliente');
  const straight = Math.hypot(target.x - home.x, target.z - home.z);
  assert.ok(straight > city.size * 0.8, `destino a ${straight.toFixed(0)} m em linha reta`);
  const trip = drive(home, target);
  assert.ok(trip.arrived, `não chegou em ${trip.seconds.toFixed(0)} s`);
  assert.equal(trip.hits, 0);
  assert.ok(trip.missBy < config.jobs.stopRadius, `parou a ${trip.missBy.toFixed(1)} m do marcador`);
  assert.ok(Math.abs(trip.bike.speed) < config.jobs.stopSpeed);
  assert.ok(trip.bike.distance > straight);
  assert.ok(trip.topSpeed > 10, 'anda em velocidade de rua');
});

test('piloto automático: faz uma sequência de entregas entre POIs sem bater', () => {
  const rng = createRng(11);
  let hits = 0;
  for (let i = 0; i < 12; i++) {
    const from = rng.pick(city.pois);
    const to = rng.pick(city.pois);
    if (from === to) continue;
    const trip = drive(from, to);
    assert.ok(trip.arrived, `${from.name} → ${to.name}: não chegou`);
    assert.ok(trip.missBy < config.jobs.stopRadius, `${from.name} → ${to.name}: parou a ${trip.missBy.toFixed(1)} m`);
    hits += trip.hits;
  }
  assert.equal(hits, 0);
});

test('piloto automático: sem rota não comanda nada', () => {
  const bike = createBike(config.bike, { city, graph }, spawnAt(home));
  const pilot = createAutopilot({ city, graph, bike, config: config.autopilot });
  assert.deepEqual(pilot.step(), { throttle: 0, steer: 0, brake: false, horn: false });
  assert.equal(pilot.active, false);
});

test('piloto automático: largado torto contra os prédios, segue viagem', () => {
  const target = farthest('restaurante');
  const start = spawnAt(home);
  const bike = createBike(config.bike, { city, graph }, start);
  const pilot = createAutopilot({ city, graph, bike, config: config.autopilot });
  // Larga a moto depois de uma investida contra os prédios (ela raspa na parede e segue, não encalha mais).
  for (let i = 0; i < 240; i++) bike.step({ throttle: 1, steer: i < 40 ? 1 : 0, brake: false, horn: false }, DT);
  assert.ok(pilot.goTo({ edge: target.edge, t: target.t }));
  let seconds = 0;
  while (pilot.active && seconds < 600) {
    bike.step(pilot.step(DT), DT);
    seconds += DT;
  }
  assert.ok(pilot.arrived, 'chegou mesmo saindo torto');
});

// ---- no trânsito

/** Uma via longa e reta que chega num cruzamento com semáforo, e a moto 80 m antes da linha. */
function approach() {
  const edge = city.edges.filter((e) => e.length > 90 && !e.oneWay && city.nodes[e.b].signal).sort((a, b) => b.length - a.length)[0];
  const node = city.nodes[edge.b];
  const bike = createBike(config.bike, { city, graph }, { ...graph.pointOnEdge(edge.id, 0.1, edge.halfWidth / 2), heading: Math.atan2(edge.dir.z, edge.dir.x) });
  const beyond = node.edges.map((id) => city.edges[id]).find((e) => e.id !== edge.id && graph.canTravel(e.id, node.id));
  const target = { edge: beyond.id, t: beyond.a === node.id ? 0.5 : 0.5 };
  const lineAt = edge.length - node.radius; // distância da linha de retenção a partir de a
  const along = () => (bike.x - city.nodes[edge.a].x) * edge.dir.x + (bike.z - city.nodes[edge.a].z) * edge.dir.z;
  return { edge, node, bike, target, lineAt, along };
}

test('piloto no trânsito: para antes da linha no vermelho; o perfil "nunca" fura', () => {
  const red = { stateFor: () => 'vermelho' };
  for (const obeyLights of ['sempre', 'nunca']) {
    const { bike, target, lineAt, along } = approach();
    const pilot = createAutopilot({ city, graph, bike, config: { ...config.autopilot, obeyLights }, signals: red, traffic: { vehicles: [] } });
    pilot.goTo(target);
    for (let i = 0; i < 60 * 25; i++) bike.step(pilot.step(DT), DT);
    if (obeyLights === 'sempre') {
      assert.ok(along() < lineAt, `passou da linha no vermelho (${along().toFixed(1)} > ${lineAt.toFixed(1)})`);
      assert.ok(Math.abs(bike.speed) < 0.5, 'ficou parado esperando');
    } else {
      assert.ok(along() > lineAt || pilot.arrived, 'o perfil "nunca" fura o sinal');
    }
  }
});

test('piloto no trânsito: freia atrás de um carro parado sem encostar', () => {
  const { edge, bike, target } = approach();
  const at = graph.pointOnEdge(edge.id, 0.6, edge.halfWidth / 2);
  const car = { active: true, x: at.x, z: at.z, heading: Math.atan2(edge.dir.z, edge.dir.x), speed: 0, length: 4.2, width: 2.2 };
  const pilot = createAutopilot({ city, graph, bike, config: config.autopilot, traffic: { vehicles: [car] } });
  pilot.goTo(target);
  for (let i = 0; i < 60 * 20; i++) bike.step(pilot.step(DT), DT);
  const gap = Math.hypot(car.x - bike.x, car.z - bike.z) - car.length / 2;
  assert.ok(gap > 1, `encostou no carro (folga de ${gap.toFixed(2)} m)`);
  assert.ok(Math.abs(bike.speed) < 0.5, 'ficou parado atrás dele');
});
