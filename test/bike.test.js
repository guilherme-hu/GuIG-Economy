import test from 'node:test';
import assert from 'node:assert/strict';
import { createBike } from '../src/sim/bike.js';
import { config } from '../src/config.js';

const DT = 1 / 60;

/** Uma rua reta de 1 km ao longo de +X, centrada em z = 0. */
function straightRoad() {
  const city = { edges: [{ id: 0, a: 0, b: 1, halfWidth: 3.4, bridge: false }], nodes: [{ x: 0, z: 0, radius: 5 }, { x: 1000, z: 0, radius: 5 }] };
  const graph = {
    nearestEdge: (x, z) => ({ edge: 0, t: Math.max(0, Math.min(1, x / 1000)), dist: Math.abs(z), side: Math.sign(z) || 1 }),
    pointOnEdge: (edge, t) => ({ x: t * 1000, z: 0 }),
  };
  return { city, graph };
}

const newBike = (spawn = { x: 100, z: 0, heading: 0 }) => createBike(config.bike, straightRoad(), spawn);
const run = (bike, input, seconds) => {
  for (let i = 0; i < seconds / DT; i++) bike.step({ throttle: 0, steer: 0, brake: false, ...input }, DT);
};

test('acelera até perto da máxima e nunca passa dela', () => {
  const bike = newBike();
  run(bike, { throttle: 1 }, 3);
  assert.ok(bike.speed > 50 / 3.6, `0–3 s deveria passar de 50 km/h, deu ${bike.speed * 3.6}`);
  run(bike, { throttle: 1 }, 30);
  assert.ok(bike.speed <= config.bike.maxSpeed);
  assert.ok(bike.speed > config.bike.maxSpeed * 0.85);
});

test('freio forte para a moto e ela não anda de ré sozinha', () => {
  const bike = newBike();
  run(bike, { throttle: 1 }, 4);
  run(bike, { brake: true }, 3);
  assert.equal(bike.speed, 0);
});

test('parada não gira; em movimento vira para o lado pedido e inclina', () => {
  const bike = newBike();
  run(bike, { steer: 1 }, 1);
  assert.equal(bike.heading, 0);
  run(bike, { throttle: 1 }, 1);
  run(bike, { throttle: 1, steer: 1 }, 0.4);
  assert.ok(bike.heading > 0, 'steer positivo vira para a direita (+z)');
  assert.ok(bike.lean > 0);
});

test('não atravessa o limite da rua e perde velocidade ao bater de frente', () => {
  const bike = newBike({ x: 100, z: 0, heading: Math.PI / 2 });
  run(bike, { throttle: 1 }, 4);
  const limit = 3.4 + config.bike.offRoadMargin - config.bike.radius;
  assert.ok(Math.abs(bike.z) <= limit + 1e-6, `z=${bike.z}`);
  assert.ok(bike.speed < 6, `deveria ter freado na parede, speed=${bike.speed}`);
});

test('batendo de frente na lateral, a moto vira para longe da parede e consegue sair', () => {
  const bike = newBike({ x: 100, z: 0, heading: Math.PI / 2 - 0.05 });
  run(bike, { throttle: 1 }, 5);
  const alongRoad = Math.abs(Math.cos(bike.heading));
  assert.ok(alongRoad > 0.7, `deveria estar alinhada com a rua, cos=${alongRoad}`);
  assert.ok(bike.x > 110, `deveria ter seguido pela rua, x=${bike.x}`);
});

test('na calçada a velocidade fica limitada', () => {
  const bike = newBike({ x: 100, z: 5, heading: 0 });
  run(bike, { throttle: 1 }, 6);
  assert.ok(bike.onSidewalk);
  assert.ok(bike.speed <= config.bike.sidewalkSpeed + 0.01, `speed=${bike.speed}`);
});

test('conta a distância rodada', () => {
  const bike = newBike();
  run(bike, { throttle: 1 }, 5);
  assert.ok(Math.abs(bike.distance - (bike.x - 100)) < 0.5);
});

test('congelada após acidente, ignora o acelerador', () => {
  const bike = newBike();
  bike.frozen = true;
  run(bike, { throttle: 1 }, 2);
  assert.equal(bike.speed, 0);
});
