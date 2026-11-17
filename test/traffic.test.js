import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { createEvents } from '../src/core/events.js';
import { generateCity } from '../src/sim/city/generator.js';
import { createGraph } from '../src/sim/city/graph.js';
import { createSignals } from '../src/sim/signals.js';
import { createTraffic } from '../src/sim/traffic.js';
import { createRules } from '../src/sim/rules.js';
import { createEconomy } from '../src/sim/economy.js';

const DT = 1 / 60;
const rng = createRng(config.seed);
const city = generateCity(config.city, rng.fork('cidade'));
const graph = createGraph(city);

test('trânsito: enche o entorno do jogador e ninguém cruza a linha de retenção no vermelho', () => {
  const signals = createSignals(city, config.signals);
  const traffic = createTraffic({ city, graph, signals, rng: rng.fork('trânsito'), config: config.traffic });
  const centro = city.nodes.find((n) => n.district === 'centro' && n.signal);
  const focus = { x: centro.x, z: centro.z, heading: 0, speed: 0 };
  let violations = 0;
  for (let i = 0; i < 60 * 90; i++) {
    const before = traffic.vehicles.map((v) => (v.active ? { edge: v.edge, s: v.s } : null));
    signals.step(DT);
    traffic.step(DT, focus);
    traffic.vehicles.forEach((v, k) => {
      const was = before[k];
      if (!was || !v.active || was.edge !== v.edge) return;
      const edge = city.edges[v.edge];
      const node = v.forward ? edge.b : edge.a;
      const line = edge.length - city.nodes[node].radius - v.length / 2 + 1.5;
      if (was.s < line && v.s >= line && signals.stateFor(node, v.edge) === 'vermelho') violations++;
      assert.ok(Number.isFinite(v.x) && Number.isFinite(v.z) && Number.isFinite(v.heading));
    });
  }
  const active = traffic.vehicles.filter((v) => v.active);
  assert.ok(active.length >= 25, `esperava trânsito em volta, havia ${active.length}`);
  assert.ok(active.some((v) => v.speed > 5), 'alguém deveria estar andando');
  assert.equal(violations, 0);
});

function rulesWorld(light) {
  const events = createEvents();
  const economy = createEconomy(config.economy, events);
  const node = city.nodes.find((n) => n.signal && n.edges.length >= 3);
  const edge = city.edges[node.edges[0]];
  const into = edge.b === node.id ? 1 : -1;
  const bike = { x: 0, z: 0, heading: Math.atan2(edge.dir.z * into, edge.dir.x * into), speed: 10, radius: 0.55, frozen: false, road: null };
  const traffic = { vehicles: [] };
  const signals = { stateFor: () => light };
  const rules = createRules({ city, signals, traffic, bike, economy, events, config: config.rules });
  const seen = [];
  events.on('*', (type) => seen.push(type));
  /** Leva a moto de 30 m antes do cruzamento até 5 m depois do centro. */
  const cross = () => {
    for (let d = -30; d <= 5; d += bike.speed * DT) {
      bike.x = node.x + Math.cos(bike.heading) * d;
      bike.z = node.z + Math.sin(bike.heading) * d;
      bike.road = graph.nearestEdge(bike.x, bike.z);
      rules.step(DT);
    }
  };
  return { bike, traffic, economy, rules, seen, cross };
}

test('regras: furar o vermelho rende uma multa, uma vez só; no verde, nada', () => {
  const red = rulesWorld('vermelho');
  red.cross();
  assert.equal(red.seen.filter((t) => t === 'fine').length, 1);
  assert.equal(red.economy.money, -config.rules.fineRedLight);
  const green = rulesWorld('verde');
  green.cross();
  assert.ok(!green.seen.includes('fine'));
});

test('regras: bater forte num veículo é acidente; encostar devagar é só um tranco', () => {
  const car = { id: 0, active: true, x: 0, z: 0, heading: 0, speed: 0, length: 4, width: 2.2 };
  const fast = rulesWorld('verde');
  fast.traffic.vehicles.push(car);
  Object.assign(fast.bike, { x: -1.5, z: 0, heading: 0, speed: 15, road: graph.nearestEdge(-1.5, 0) });
  fast.rules.step(DT);
  assert.ok(fast.seen.includes('crash') && fast.bike.frozen);

  const slow = rulesWorld('verde');
  slow.traffic.vehicles.push(car);
  Object.assign(slow.bike, { x: 0, z: 1.2, heading: 0, speed: 3, road: graph.nearestEdge(0, 1.2) });
  slow.rules.step(DT);
  assert.ok(slow.seen.includes('bump') && !slow.bike.frozen);
  assert.ok(Math.abs(slow.bike.z) >= 1.1 + 0.55 - 1e-6, 'a moto foi empurrada para fora da lataria');
});
