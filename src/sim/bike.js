/**
 * Física arcade da moto: velocidade escalar + direção.
 * Sem malha de colisão: a moto só existe a até certa distância do eixo de alguma via;
 * passar disso é "bater no prédio" (empurra de volta e perde velocidade).
 */
const GRAVITY = 9.81;

export function createBike(config, { city, graph }, spawn) {
  const bike = {
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    lean: 0,
    steer: 0,
    radius: config.radius,
    road: null, // último graph.nearestEdge
    distance: 0, // metros rodados (combustível)
    wallHit: 0, // velocidade do impacto com parede neste passo (0 = nenhum)
    onSidewalk: false,
    frozen: false, // true após acidente: ignora comandos

    reset(at) {
      bike.x = at.x;
      bike.z = at.z;
      bike.heading = at.heading ?? 0;
      bike.speed = 0;
      bike.lean = 0;
      bike.steer = 0;
      bike.wallHit = 0;
      bike.frozen = false;
      bike.road = graph.nearestEdge(bike.x, bike.z);
    },

    step(input, dt) {
      const control = bike.frozen ? IDLE : input;
      accelerate(control, dt);
      if (bike.onSidewalk) bike.speed = approach(bike.speed, clamp(bike.speed, -config.sidewalkSpeed, config.sidewalkSpeed), config.sidewalkBrake * dt);
      turn(control, dt);
      move(dt);
      keepOnRoad();
    },
  };

  function accelerate(input, dt) {
    const { throttle, brake } = input;
    if (brake) {
      bike.speed = approach(bike.speed, 0, config.hardBrake * dt);
    } else if (throttle > 0) {
      if (bike.speed < 0) bike.speed = approach(bike.speed, 0, config.brake * dt);
      else bike.speed += config.accel * throttle * (1 - (bike.speed / config.maxSpeed) ** 2) * dt;
    } else if (throttle < 0) {
      if (bike.speed > 0.3) bike.speed = approach(bike.speed, 0, config.brake * dt);
      else bike.speed = approach(bike.speed, -config.reverseSpeed, config.accel * 0.5 * dt);
    }
    bike.speed -= bike.speed * config.drag * dt * (throttle === 0 ? 1 : 0.15);
    if (throttle === 0 && Math.abs(bike.speed) < 0.05) bike.speed = 0;
  }

  function turn(input, dt) {
    bike.steer = approach(bike.steer, input.steer, config.steerResponse * dt);
    const v = Math.abs(bike.speed);
    // Parado não gira; rápido, a curva é limitada pela aceleração lateral.
    const rate = Math.min(config.steerRate * Math.min(1, v / config.steerFullSpeed), config.maxLateralAccel / Math.max(v, 0.01));
    const yaw = bike.steer * rate * Math.sign(bike.speed || 1);
    bike.heading = wrapAngle(bike.heading + yaw * dt);
    const targetLean = clamp(Math.atan((v * yaw) / GRAVITY), -config.maxLean, config.maxLean);
    bike.lean = approach(bike.lean, targetLean, config.leanResponse * dt);
  }

  function move(dt) {
    bike.x += Math.cos(bike.heading) * bike.speed * dt;
    bike.z += Math.sin(bike.heading) * bike.speed * dt;
    bike.distance += Math.abs(bike.speed) * dt;
  }

  const limitOf = (edgeId) => {
    const edge = city.edges[edgeId];
    return edge.halfWidth + (edge.bridge ? config.bridgeMargin : config.offRoadMargin) - bike.radius;
  };
  const probe = {};

  function keepOnRoad() {
    bike.wallHit = 0;
    const road = graph.nearestEdge(bike.x, bike.z);
    bike.road = road;
    if (!road) return;
    let wall = road.edge;
    let dist = road.dist;
    let t = road.t;
    let limit = limitOf(wall);
    let onAsphalt = dist <= city.edges[wall].halfWidth + bike.radius;

    // A via de eixo mais próximo nem sempre é a que a moto está usando: na boca de uma ponte, onde uma rua
    // chega numa avenida, ou com uma rua correndo ao lado de uma avenida larga. Vale a que deixa a moto mais para dentro.
    for (const other of graph.edgesAround(bike.x, bike.z)) {
      graph.projectOnEdge(other, bike.x, bike.z, probe);
      if (probe.dist <= city.edges[other].halfWidth + bike.radius) onAsphalt = true;
      if (probe.dist - limitOf(other) >= dist - limit) continue;
      wall = other;
      dist = probe.dist;
      t = probe.t;
      limit = limitOf(other);
    }
    bike.onSidewalk = !onAsphalt && !insideJunction(city.edges[wall]);
    if (dist <= limit) return;

    // Empurra de volta para o limite, ao longo da normal que sai do eixo da via.
    const axis = graph.pointOnEdge(wall, t, 0);
    const nx = (bike.x - axis.x) / dist;
    const nz = (bike.z - axis.z) / dist;
    bike.x = axis.x + nx * limit;
    bike.z = axis.z + nz * limit;

    // Quanto mais de frente, mais velocidade perde; de raspão, desliza ao longo da parede.
    const dirX = Math.cos(bike.heading) * Math.sign(bike.speed || 1);
    const dirZ = Math.sin(bike.heading) * Math.sign(bike.speed || 1);
    const headOn = dirX * nx + dirZ * nz; // 1 = de frente para a parede
    if (headOn <= 0) return;
    const impact = Math.abs(bike.speed) * headOn;
    if (impact > config.wallHitMinSpeed) bike.wallHit = impact;
    // Sobra a parte da velocidade que corre ao longo da parede, e o guidão vira para longe dela:
    // a moto raspa e segue, em vez de ficar encalhada de frente para o muro.
    bike.speed *= Math.max(config.wallBounce, Math.sqrt(1 - headOn * headOn));
    const cross = dirX * nz - dirZ * nx; // > 0: a parede está no sentido em que o heading cresce
    bike.heading = wrapAngle(bike.heading - Math.sign(cross || 1) * headOn * config.wallDeflect);
  }

  /** Dentro da área de um cruzamento não há calçada no caminho. */
  function insideJunction(edge) {
    return [edge.a, edge.b].some((id) => {
      const node = city.nodes[id];
      return Math.hypot(bike.x - node.x, bike.z - node.z) < node.radius + bike.radius;
    });
  }

  bike.reset(spawn);
  return bike;
}

const IDLE = { throttle: 0, steer: 0, brake: true, horn: false };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function approach(value, target, maxDelta) {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

function wrapAngle(a) {
  if (a > Math.PI) return a - 2 * Math.PI;
  if (a < -Math.PI) return a + 2 * Math.PI;
  return a;
}
