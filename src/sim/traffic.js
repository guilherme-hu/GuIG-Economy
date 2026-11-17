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
    id, active: false, type: 'carro', model: '', x: 0, z: 0, heading: 0, speed: 0, length: 4, width: 2,
    edge: 0, forward: true, s: 0, lane: 0, pace: 1, runsRed: false, reckless: false, stuck: 0, inNode: -1, next: -1,
  }));
  // Um cruzamento por vez pertence a UMA faixa de chegada: quem vem das outras espera esvaziar.
  // É isso que impede os carros de se atravessarem ao cruzar e ao virar.
  const inside = new Int16Array(nodes.length); // veículos dentro de cada cruzamento
  const heldBy = new Int32Array(nodes.length).fill(-1); // faixa de chegada que está com a vez
  const heldUntil = new Float64Array(nodes.length); // até quando a faixa com a vez ainda pode mandar mais carros
  const lineOf = (v) => v.edge * 4 + v.lane; // duas faixas da mesma avenida não entram juntas: elas se fundiriam na saída
  let clock = 0;

  // A vez dura pouco: senão a faixa que pegou o cruzamento passa a fila inteira e as outras esperam o verde todo.
  const canEnter = (nodeId, v) => inside[nodeId] === 0 || (heldBy[nodeId] === lineOf(v) && clock < heldUntil[nodeId]);
  function enter(v, nodeId) {
    if (inside[nodeId]++ === 0) {
      heldBy[nodeId] = lineOf(v);
      heldUntil[nodeId] = clock + cfg.junctionHold;
    }
    v.inNode = nodeId;
  }
  function leave(v) {
    if (v.inNode < 0) return;
    if (--inside[v.inNode] <= 0) {
      inside[v.inNode] = 0;
      heldBy[v.inNode] = -1;
    }
    v.inNode = -1;
  }
  function remove(v) {
    leave(v);
    v.active = false;
  }

  function step(dt, focus) {
    clock += dt;
    spawn(focus);
    for (const v of vehicles) {
      if (!v.active) continue;
      if (Math.hypot(v.x - focus.x, v.z - focus.z) > cfg.despawn) remove(v);
      else drive(v, dt, focus);
    }
  }

  function drive(v, dt, focus) {
    const edge = edges[v.edge];
    const endNode = v.forward ? edge.b : edge.a;
    const stopAt = edge.length - nodes[endNode].radius - v.length / 2;

    // Quem já entrou no cruzamento segue; quem não entrou decide aqui se espera na linha de retenção.
    const committed = v.inNode === endNode;
    const wait = !committed && mustWait(v, endNode, stopAt);
    let free = gapAhead(v, focus) - cfg.followGap;
    if (wait) free = Math.min(free, stopAt - v.s);

    // Chega no cruzamento em velocidade de curva: sem isso entraria a 100 km/h numa rua curta com sinal fechado.
    const cruise = Math.min(edge.speedLimit * v.pace, Math.sqrt(cfg.junctionSpeed ** 2 + 2 * cfg.brake * Math.max(0, stopAt - v.s)));
    const target = Math.min(cruise, Math.sqrt(2 * cfg.brake * Math.max(0, free)));
    v.speed = target < v.speed ? Math.max(target, v.speed - cfg.hardBrake * dt) : Math.min(target, v.speed + cfg.accel * dt);
    v.s += v.speed * dt;
    if (wait) v.s = Math.min(v.s, stopAt); // a linha de retenção não deixa "vazar" para dentro do cruzamento
    if (!committed && !wait && v.s >= stopAt) {
      leave(v);
      enter(v, endNode);
    } else if (!committed && v.inNode >= 0 && v.s > nodes[v.inNode].radius + v.length / 2) {
      leave(v); // saiu do cruzamento anterior
    }
    if (v.s >= edge.length) turnAt(v, endNode, edge.length);
    if (v.active) place(v, 1 - Math.exp(-cfg.smoothing * dt));
    unstick(v, dt, focus);
  }

  /** Vermelho, amarelo que ainda dá para respeitar, cruzamento ocupado por outra faixa ou sem espaço na saída. */
  function mustWait(v, nodeId, stopAt) {
    const light = signals.stateFor(nodeId, v.edge);
    if (light === 'vermelho') return !(v.reckless && v.runsRed);
    // No amarelo para quem consegue parar; quem está quase parado na linha não arranca. Os 'furões' passam...
    const stopsOnYellow = !v.runsRed && (v.speed < cfg.crawlSpeed || (v.speed * v.speed) / (2 * cfg.hardBrake) < stopAt - v.s);
    if (light === 'amarelo' && stopsOnYellow) return true;
    if (v.reckless) return !canEnter(nodeId, v); // moto fura o sinal e não espera a saída, mas não passa por dentro de um carro
    // ...mas ninguém entra num cruzamento ocupado: dois carros se cruzando lá dentro travariam um ao outro.
    if (!canEnter(nodeId, v)) return true;
    if (exitClear(v, nodeId)) return false;
    // Saída lotada há tempo: desiste e sorteia outra rua. Sem isso, filas que dão a volta no quarteirão travam em ciclo.
    if (v.stuck > cfg.rerouteAfter) v.next = -1;
    return true;
  }

  /** Para onde o veículo vai ao sair deste cruzamento (sorteado uma vez; beco sem saída: volta). */
  function nextEdge(v, nodeId) {
    if (v.next >= 0) return v.next;
    const options = nodes[nodeId].edges.filter((id) => id !== v.edge && graph.canTravel(id, nodeId));
    return (v.next = options.length ? rng.pick(options) : v.edge);
  }

  /** Só entra no cruzamento se couber do outro lado: fila na saída não pode travar o cruzamento. */
  function exitClear(v, nodeId) {
    const next = nextEdge(v, nodeId);
    const forward = edges[next].a === nodeId;
    const lane = Math.min(v.lane, edges[next].lanes - 1);
    const room = nodes[nodeId].radius + v.length + cfg.followGap;
    return !vehicles.some((w) => w.active && w !== v && w.edge === next && w.forward === forward && w.lane === lane && w.s - w.length / 2 < room);
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
      if (Math.abs(dx * fz - dz * fx) > ((v.width + body.width) / 2) * cfg.corridorFit) return;
      gap = Math.min(gap, along - (v.length + body.length) / 2);
    };
    const edge = edges[v.edge];
    const node = v.inNode >= 0 ? v.inNode : v.forward ? edge.b : edge.a;
    for (const w of vehicles) {
      if (!w.active || w === v) continue;
      if (Math.cos(w.heading - v.heading) < -0.5) continue; // quem vem no sentido contrário está na outra mão
      // Só conta quem está no caminho: a mesma rua, a rua de saída ou o mesmo cruzamento. Um carro esperando
      // em outra entrada pode estar "à frente" em linha reta num cruzamento torto — frear por ele trava os dois.
      if (w.edge !== v.edge && w.edge !== v.next && w.inNode !== node) continue;
      check(w, w);
      // Na mesma faixa vale a distância ao longo da via: numa curva o corredor reto não enxerga quem está à frente.
      // Fila só entre iguais: carro atrás de carro, moto atrás de moto. A moto ao lado, no corredor, não é fila.
      if (v.reckless === w.reckless && w.edge === v.edge && w.forward === v.forward && w.lane === v.lane && w.s > v.s) gap = Math.min(gap, w.s - v.s - (v.length + w.length) / 2);
    }
    check(focus, bikeBody);
    return gap;
  }

  function turnAt(v, nodeId, travelled) {
    const next = nextEdge(v, nodeId);
    v.next = -1;
    if (!graph.canTravel(next, nodeId)) return remove(v);
    v.edge = next;
    v.forward = edges[next].a === nodeId;
    v.s -= travelled;
    v.lane = Math.min(v.lane, edges[next].lanes - 1);
  }

  /** Aproxima a posição desenhada do ponto ideal na faixa; `k = 1` encaixa de vez. */
  function place(v, k) {
    const edge = edges[v.edge];
    const side = v.forward ? 1 : -1;
    const laneWidth = edge.halfWidth / edge.lanes;
    const lateral = (v.reckless ? v.lane * laneWidth + cfg.motoLine : (v.lane + 0.5) * laneWidth) * side;
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
    if (v.stuck > cfg.stuckTime && Math.hypot(v.x - focus.x, v.z - focus.z) > cfg.stuckMinDistance) remove(v);
  }

  function spawn(focus) {
    const v = vehicles.find((w) => !w.active);
    if (!v) return;
    // ponytail: sorteia vias da cidade inteira até cair no anel em volta do jogador (~6% de acerto por tentativa).
    for (let attempt = 0; attempt < cfg.spawnTries; attempt++) {
      const edge = rng.pick(edges);
      const t = rng.next() * cfg.spawnSpan; // nunca nasce em cima de um cruzamento
      const forward = edge.oneWay || rng.chance(0.5);
      graph.pointOnEdge(edge.id, forward ? t : 1 - t, 0, point);
      const distance = Math.hypot(point.x - focus.x, point.z - focus.z);
      if (distance < cfg.spawnMin || distance > cfg.spawnMax) continue;
      if (vehicles.some((w) => w.active && Math.hypot(w.x - point.x, w.z - point.z) < cfg.spawnClearance)) continue;
      const moto = rng.chance(cfg.motoShare);
      Object.assign(v, { reckless: false }, moto ? cfg.moto : rng.pick(cfg.fleet), {
        active: true, edge: edge.id, forward, lane: rng.int(0, edge.lanes - 1),
        pace: moto ? rng.range(...cfg.motoPace) : 1 + rng.range(-cfg.speedVariance, cfg.speedVariance),
        runsRed: rng.chance(moto ? cfg.motoRunRed : cfg.runRedShare), stuck: 0, inNode: -1, next: -1,
      });
      v.s = t * edge.length;
      v.speed = 0; // nasce parado: longe da vista, e nunca em cima de um sinal vermelho sem espaço para frear
      place(v, 1);
      return;
    }
  }

  return { vehicles, step };
}
