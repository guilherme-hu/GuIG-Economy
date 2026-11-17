/**
 * Trânsito: um pool fixo de veículos que andam pela faixa da direita, param no vermelho,
 * freiam para o que estiver à frente (inclusive a moto) e escolhem o caminho ao acaso em cada cruzamento.
 * Só existem perto do jogador: nascem fora da vista e somem quando ficam longe.
 */
export function createTraffic({ city, graph, signals, rng, config: cfg }) {
  const { edges, nodes } = city;
  const point = { x: 0, z: 0 };
  const bikeBody = { length: 2, width: 0.8 };
  const vehicles = Array.from({ length: cfg.poolSize }, (_, id) => ({
    id, active: false, type: 'carro', model: '', x: 0, z: 0, heading: 0, speed: 0, length: 4, width: 2, braking: false,
    edge: 0, forward: true, s: 0, lane: 0, pace: 1, runsRed: false, stuck: 0,
  }));

  function step(dt, focus) {
    spawn(focus);
    for (const v of vehicles) {
      if (!v.active) continue;
      if (Math.hypot(v.x - focus.x, v.z - focus.z) > cfg.despawn) v.active = false;
      else drive(v, dt, focus);
    }
  }

  function drive(v, dt, focus) {
    const edge = edges[v.edge];
    const endNode = v.forward ? edge.b : edge.a;
    const stopAt = edge.length - nodes[endNode].radius - v.length / 2;

    let free = gapAhead(v, focus) - cfg.followGap;
    if (v.s < stopAt + 1 && mustWait(v, endNode, stopAt)) free = Math.min(free, stopAt - v.s);

    const target = Math.min(edge.speedLimit * v.pace, Math.sqrt(2 * cfg.brake * Math.max(0, free)));
    v.braking = target < v.speed - 0.5;
    v.speed = target < v.speed ? Math.max(target, v.speed - cfg.hardBrake * dt) : Math.min(target, v.speed + cfg.accel * dt);
    v.s += v.speed * dt;
    if (v.s >= edge.length) turnAt(v, endNode, edge.length);
    if (v.active) place(v, 1 - Math.exp(-cfg.smoothing * dt));
    unstick(v, dt, focus);
  }

  /** Vermelho ou amarelo que ainda dá para respeitar; ou cruzamento sem semáforo já ocupado por outra via. */
  function mustWait(v, nodeId, stopAt) {
    const light = signals.stateFor(nodeId, v.edge);
    if (light === 'vermelho') return true;
    if (light === 'amarelo') return !v.runsRed && (v.speed * v.speed) / (2 * cfg.hardBrake) < stopAt - v.s;
    if (light === 'verde') return false;
    const node = nodes[nodeId];
    return vehicles.some((w) => w.active && w.edge !== v.edge && Math.hypot(w.x - node.x, w.z - node.z) < node.radius);
  }

  /** Distância até o obstáculo mais próximo no corredor à frente (outro veículo ou a moto). */
  // ponytail: varredura O(n²) no pool; com 50 veículos são 2500 testes por passo. Se o pool crescer, usar grade espacial.
  function gapAhead(v, focus) {
    const fx = Math.cos(v.heading);
    const fz = Math.sin(v.heading);
    let gap = Infinity;
    const check = (other, body) => {
      const dx = other.x - v.x;
      const dz = other.z - v.z;
      const along = dx * fx + dz * fz;
      if (along <= 0 || along > cfg.lookAhead) return;
      if (Math.abs(dx * fz - dz * fx) > (v.width + body.width) / 2) return;
      gap = Math.min(gap, along - (v.length + body.length) / 2);
    };
    for (const w of vehicles) if (w.active && w !== v) check(w, w);
    check(focus, bikeBody);
    return gap;
  }

  function turnAt(v, nodeId, travelled) {
    const options = nodes[nodeId].edges.filter((id) => id !== v.edge && graph.canTravel(id, nodeId));
    const next = options.length ? rng.pick(options) : v.edge; // beco sem saída: volta
    if (!graph.canTravel(next, nodeId)) return (v.active = false);
    v.edge = next;
    v.forward = edges[next].a === nodeId;
    v.s -= travelled;
    v.lane = rng.int(0, edges[next].lanes - 1);
  }

  /** Aproxima a posição desenhada do ponto ideal na faixa; `k = 1` encaixa de vez. */
  function place(v, k) {
    const edge = edges[v.edge];
    const side = v.forward ? 1 : -1;
    const lateral = (v.lane + 0.5) * (edge.halfWidth / edge.lanes) * side;
    const t = Math.min(1, Math.max(0, v.s / edge.length));
    graph.pointOnEdge(v.edge, v.forward ? t : 1 - t, lateral, point);
    const heading = Math.atan2(edge.dir.z * side, edge.dir.x * side);
    v.x += (point.x - v.x) * k;
    v.z += (point.z - v.z) * k;
    v.heading += Math.atan2(Math.sin(heading - v.heading), Math.cos(heading - v.heading)) * k;
  }

  /** Veículo travado há muito tempo e longe do jogador some, para um nó cego não virar engarrafamento eterno. */
  function unstick(v, dt, focus) {
    v.stuck = v.speed < 0.2 ? v.stuck + dt : 0;
    if (v.stuck > cfg.stuckTime && Math.hypot(v.x - focus.x, v.z - focus.z) > cfg.stuckMinDistance) v.active = false;
  }

  function spawn(focus) {
    const v = vehicles.find((w) => !w.active);
    if (!v) return;
    // ponytail: sorteia vias da cidade inteira até cair no anel em volta do jogador (~6% de acerto por tentativa).
    for (let attempt = 0; attempt < cfg.spawnTries; attempt++) {
      const edge = rng.pick(edges);
      const t = rng.next();
      graph.pointOnEdge(edge.id, t, 0, point);
      const distance = Math.hypot(point.x - focus.x, point.z - focus.z);
      if (distance < cfg.spawnMin || distance > cfg.spawnMax) continue;
      if (vehicles.some((w) => w.active && Math.hypot(w.x - point.x, w.z - point.z) < cfg.spawnClearance)) continue;
      Object.assign(v, rng.pick(cfg.fleet), {
        active: true, edge: edge.id, forward: edge.oneWay || rng.chance(0.5), lane: rng.int(0, edge.lanes - 1),
        pace: 1 + rng.range(-cfg.speedVariance, cfg.speedVariance), runsRed: rng.chance(cfg.runRedShare), stuck: 0,
      });
      v.s = (v.forward ? t : 1 - t) * edge.length;
      v.speed = 0; // nasce parado: longe da vista, e nunca em cima de um sinal vermelho sem espaço para frear
      place(v, 1);
      return;
    }
  }

  return { vehicles, step };
}
