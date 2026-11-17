import test from 'node:test';
import assert from 'node:assert/strict';
import { createBike } from '../src/sim/bike.js';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { generateCity } from '../src/sim/city/generator.js';
import { createGraph } from '../src/sim/city/graph.js';

const DT = 1 / 60;

/** Uma rua reta de 1 km ao longo de +X, centrada em z = 0. */
function straightRoad() {
  const city = { edges: [{ id: 0, a: 0, b: 1, halfWidth: 3.4, bridge: false }], nodes: [{ x: 0, z: 0, radius: 5 }, { x: 1000, z: 0, radius: 5 }] };
  const graph = {
    nearestEdge: (x, z) => ({ edge: 0, t: Math.max(0, Math.min(1, x / 1000)), dist: Math.abs(z), side: Math.sign(z) || 1 }),
    pointOnEdge: (edge, t) => ({ x: t * 1000, z: 0 }),
    nearbyEdges: () => [],
    edgesAround: () => [],
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

// ---- na cidade de verdade

const city = generateCity(config.city, createRng(config.seed).fork('cidade'));
const graph = createGraph(city);
const still = { throttle: 0, steer: 0, brake: false, horn: false };

test('todo ponto de asfalto é chão livre, inclusive na boca das pontes e nos cruzamentos', () => {
  const bike = createBike(config.bike, { city, graph }, { x: 0, z: 0, heading: 0 });
  for (const edge of city.edges) {
    const reach = edge.halfWidth - (edge.bridge ? 0 : 0.05);
    for (let s = 0; s <= edge.length; s += 1.5) {
      for (const lateral of [-reach, -reach / 2, 0, reach / 2, reach]) {
        // Na ponte a moto só cabe até o guarda-corpo; fora dela, o asfalto inteiro tem de valer.
        if (edge.bridge && Math.abs(lateral) > edge.halfWidth + config.bike.bridgeMargin - config.bike.radius) continue;
        const spot = graph.pointOnEdge(edge.id, s / edge.length, lateral);
        bike.reset({ ...spot, heading: 0 });
        bike.step(still, DT);
        const moved = Math.hypot(bike.x - spot.x, bike.z - spot.z);
        assert.ok(moved < 1e-9, `via ${edge.id} (${edge.kind}) a ${s.toFixed(1)} m, ${lateral.toFixed(1)} m do eixo: empurrada ${moved.toFixed(2)} m`);
      }
    }
  }
});

test('passar pela boca de uma ponte, na faixa do lado dela, não bate em parede invisível', () => {
  let passes = 0;
  for (const bridge of city.edges.filter((edge) => edge.bridge)) {
    for (const headId of [bridge.a, bridge.b]) {
      const head = city.nodes[headId];
      const far = city.nodes[graph.otherEnd(bridge.id, headId)];
      const arms = head.edges.filter((id) => id !== bridge.id).map((id) => {
        const edge = city.edges[id];
        const sign = edge.b === headId ? 1 : -1; // sentido de quem chega no cruzamento
        return { id, edge, dir: { x: edge.dir.x * sign, z: edge.dir.z * sign } };
      });
      for (const arm of arms) {
        // Só vale para quem segue em frente: precisa existir outra via saindo quase na mesma direção.
        const goesOn = arms.some((other) => other !== arm && -(other.dir.x * arm.dir.x + other.dir.z * arm.dir.z) > 0.94);
        if (!goesOn) continue;
        const { dir } = arm;
        const right = { x: -dir.z, z: dir.x };
        const bridgeSide = Math.sign((far.x - head.x) * right.x + (far.z - head.z) * right.z) || 1;
        const lateral = bridgeSide * arm.edge.halfWidth * 0.75;
        const start = { x: head.x - dir.x * 25 + right.x * lateral, z: head.z - dir.z * 25 + right.z * lateral, heading: Math.atan2(dir.z, dir.x) };
        const bike = createBike(config.bike, { city, graph }, start);
        bike.speed = 10;
        // Vai até 6 m depois do centro do cruzamento, já do outro lado da boca da ponte.
        while ((bike.x - head.x) * dir.x + (bike.z - head.z) * dir.z < 6) {
          const before = { x: bike.x, z: bike.z };
          bike.step({ ...still, throttle: 0.3 }, DT);
          const jump = Math.hypot(bike.x - before.x, bike.z - before.z);
          assert.equal(bike.wallHit, 0, `bateu passando pela ponte ${bridge.id}, na via ${arm.id}`);
          assert.ok(jump < 0.5, `a moto foi arrastada ${jump.toFixed(2)} m de uma vez passando pela ponte ${bridge.id}`);
        }
        passes++;
      }
    }
  }
  assert.ok(passes >= 4, `${passes} passagens testadas`);
});
