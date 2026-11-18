/**
 * Trânsito: um pool fixo de veículos que andam pela faixa da direita, param no vermelho,
 * freiam para o que estiver à frente (inclusive a moto) e escolhem o caminho ao acaso em cada cruzamento.
 * Só existem perto do jogador: nascem fora da vista e somem quando ficam longe.
 */
export function createTraffic({ city, graph, signals, rng, config: cfg }) {
  const { edges, nodes } = city;
  const point = { x: 0, z: 0 };
  // A moto do jogador conta com folga: a caixa de colisão dela (raio + lataria) é maior que o corredor
  // estreito em que os carros procuram outros veículos, e um carro que não a vê passa por cima.
  const bikeBody = { length: 2.4, width: 2.6 };
  const vehicles = Array.from({ length: cfg.poolSize }, (_, id) => ({
    id, active: false, type: 'carro', model: '', x: 0, z: 0, heading: 0, speed: 0, length: 4, width: 2,
    edge: 0, forward: true, s: 0, lane: 0, pace: 1, runsRed: false, reckless: false, stuck: 0, inNode: -1, next: -1,
    // Curva pelo cruzamento: Bézier cúbica da linha de retenção até a saída, alinhada com as duas faixas.
    turnNode: -1, turnIn: 0, turnSpan: 1, uTurn: false, p0x: 0, p0z: 0, c1x: 0, c1z: 0, c2x: 0, c2z: 0, p3x: 0, p3z: 0,
  }));
  const exitPoint = { x: 0, z: 0 };
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
    // Motorista impaciente: parado há tempo demais, deixa de esperar a moto do jogador e segue.
    // Desfaz qualquer impasse "um esperando o outro" entre ele e a moto.
    const player = v.stuck > cfg.patience ? null : focus;
    const wait = !committed && mustWait(v, endNode, stopAt, player);
    let free = gapAhead(v, player) - cfg.followGap;
    if (wait) free = Math.min(free, stopAt - v.s);

    // Chega no cruzamento em velocidade de curva: sem isso entraria a 100 km/h numa rua curta com sinal fechado.
    const turnSpeed = nextEdge(v, endNode) === v.edge ? cfg.uTurnSpeed : cfg.junctionSpeed;
    const cruise = Math.min(edge.speedLimit * v.pace, Math.sqrt(turnSpeed ** 2 + 2 * cfg.brake * Math.max(0, stopAt - v.s)));
    let target = Math.min(cruise, Math.sqrt(2 * cfg.brake * Math.max(0, free)));
    if (v.turnNode >= 0 && v.uTurn) target = Math.min(target, cfg.uTurnSpeed); // termina o retorno devagar
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
  function mustWait(v, nodeId, stopAt, focus) {
    const light = signals.stateFor(nodeId, v.edge);
    if (light === 'vermelho') return !(v.reckless && v.runsRed);
    if (focus && playerHasWay(nodes[nodeId], focus)) return true;
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

  /**
   * A moto do jogador tem a preferência quando está no cruzamento ou chegando nele com o sinal aberto.
   * Se ela vem furando o vermelho, ninguém espera por ela: é aí que mora o perigo.
   */
  function playerHasWay(node, bike) {
    const dx = node.x - bike.x;
    const dz = node.z - bike.z;
    const distance = Math.hypot(dx, dz);
    if (distance < node.radius + cfg.playerMargin) return true;
    if (!bike.road || distance - node.radius > Math.abs(bike.speed) * cfg.playerYieldTime) return false;
    const coming = (dx * Math.cos(bike.heading) + dz * Math.sin(bike.heading)) / distance > 0.7;
    return coming && signals.stateFor(node.id, approachOf(node, bike)) !== 'vermelho';
  }

  /** Via pela qual a moto chega ao cruzamento: a mais alinhada com o rumo dela (a via mais próxima pode ser a transversal). */
  function approachOf(node, bike) {
    let best = node.edges[0];
    let bestDot = -Infinity;
    for (const id of node.edges) {
      const into = edges[id].b === node.id ? 1 : -1;
      const dot = (edges[id].dir.x * Math.cos(bike.heading) + edges[id].dir.z * Math.sin(bike.heading)) * into;
      if (dot > bestDot) [best, bestDot] = [id, dot];
    }
    return best;
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
    // A moto do jogador conta só se estiver à frente do para-choque: se está do lado, é ela quem espera.
    // Senão os dois param um pelo outro. Logo à frente, ela conta numa faixa mais larga que o corredor:
    // um carro que dobra a esquina varre mais que a reta.
    if (!focus) return gap;
    const dx = focus.x - v.x;
    const dz = focus.z - v.z;
    const along = dx * fx + dz * fz;
    if (along > v.length / 2) {
      check(focus, bikeBody);
      if (along < cfg.playerNear && Math.abs(dx * fz - dz * fx) < v.width / 2 + cfg.playerSide) gap = Math.min(gap, along - v.length / 2 - 1);
    }
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
    let heading;
    const u = turnProgress(v);
    if (u >= 0) heading = pointOnCurve(v, u, point);
    else {
      lanePoint(v.edge, v.forward, v.s, v.lane, v.reckless, point);
      heading = Math.atan2(edge.dir.z * side, edge.dir.x * side);
    }
    v.x += (point.x - v.x) * k;
    v.z += (point.z - v.z) * k;
    v.heading += Math.atan2(Math.sin(heading - v.heading), Math.cos(heading - v.heading)) * k;
  }

  /** Ponto da faixa `lane` a `s` metros do começo da via, no sentido de `forward`. */
  function lanePoint(edgeId, forward, s, lane, reckless, out) {
    const edge = edges[edgeId];
    const laneWidth = edge.halfWidth / edge.lanes;
    const lateral = (reckless ? lane * laneWidth + cfg.motoLine : (lane + 0.5) * laneWidth) * (forward ? 1 : -1);
    const t = Math.min(1, Math.max(0, s / edge.length));
    return graph.pointOnEdge(edgeId, forward ? t : 1 - t, lateral, out);
  }

  /**
   * Fração (0..1) da curva pelo cruzamento em que o veículo está, ou −1 fora dela.
   * A curva começa na linha de retenção da via de chegada e termina à mesma distância do nó na via de saída.
   */
  function turnProgress(v) {
    const edge = edges[v.edge];
    const endNode = v.forward ? edge.b : edge.a;
    const startNode = v.forward ? edge.a : edge.b;
    const radius = nodes[startNode].radius;
    // Numa via curta as duas curvas se encostam: termina a do cruzamento de trás antes de começar a da frente.
    if (v.turnNode === startNode && v.s < radius) return Math.min(1, (v.turnIn + v.s) / v.turnSpan);
    const entry = Math.max(edge.length - nodes[endNode].radius, Math.min(radius, edge.length / 2));
    if (v.s >= entry) {
      if (v.turnNode !== endNode) planTurn(v, endNode, entry);
      return Math.min(1, (v.s - entry) / v.turnSpan);
    }
    v.turnNode = -1;
    return -1;
  }

  /** Monta a curva: sai na direção da faixa de chegada e chega na direção da faixa de saída, sem tranco nas pontas. */
  function planTurn(v, nodeId, entry) {
    const next = nextEdge(v, nodeId);
    const out = edges[next];
    const forward = out.a === nodeId;
    const radius = nodes[nodeId].radius;
    lanePoint(v.edge, v.forward, entry, v.lane, v.reckless, point);
    lanePoint(next, forward, radius, Math.min(v.lane, out.lanes - 1), v.reckless, exitPoint);
    const inSide = v.forward ? 1 : -1;
    const outSide = forward ? 1 : -1;
    const dx0 = edges[v.edge].dir.x * inSide;
    const dz0 = edges[v.edge].dir.z * inSide;
    const dx3 = out.dir.x * outSide;
    const dz3 = out.dir.z * outSide;
    const gap = Math.hypot(exitPoint.x - point.x, exitPoint.z - point.z);
    // Braços das tangentes: 0,55 da distância até o canto aproxima um arco; num retorno, 2/3 da largura faz o meio círculo.
    let arm0 = gap / 3;
    let arm3 = gap / 3;
    const cross = dx0 * dz3 - dz0 * dx3;
    v.uTurn = next === v.edge;
    if (v.uTurn) arm0 = arm3 = Math.max(gap * 0.67, 2);
    else if (Math.abs(cross) > 0.15) {
      arm0 = Math.abs(((exitPoint.x - point.x) * dz3 - (exitPoint.z - point.z) * dx3) / cross) * 0.55;
      arm3 = Math.abs(((exitPoint.x - point.x) * dz0 - (exitPoint.z - point.z) * dx0) / cross) * 0.55;
    }
    v.turnNode = nodeId;
    v.turnIn = edges[v.edge].length - entry; // metros da curva ainda na via de chegada
    v.turnSpan = v.turnIn + radius;
    v.p0x = point.x;
    v.p0z = point.z;
    v.c1x = point.x + dx0 * arm0;
    v.c1z = point.z + dz0 * arm0;
    v.c2x = exitPoint.x - dx3 * arm3;
    v.c2z = exitPoint.z - dz3 * arm3;
    v.p3x = exitPoint.x;
    v.p3z = exitPoint.z;
  }

  /** Ponto e direção da curva em `u`; devolve o heading. */
  function pointOnCurve(v, u, out) {
    const w = 1 - u;
    const b0 = w * w * w;
    const b1 = 3 * w * w * u;
    const b2 = 3 * w * u * u;
    const b3 = u * u * u;
    out.x = b0 * v.p0x + b1 * v.c1x + b2 * v.c2x + b3 * v.p3x;
    out.z = b0 * v.p0z + b1 * v.c1z + b2 * v.c2z + b3 * v.p3z;
    const tx = w * w * (v.c1x - v.p0x) + 2 * w * u * (v.c2x - v.c1x) + u * u * (v.p3x - v.c2x);
    const tz = w * w * (v.c1z - v.p0z) + 2 * w * u * (v.c2z - v.c1z) + u * u * (v.p3z - v.c2z);
    if (tx * tx + tz * tz < 1e-6) return v.heading;
    return Math.atan2(tz, tx);
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
        runsRed: rng.chance(moto ? cfg.motoRunRed : cfg.runRedShare), stuck: 0, inNode: -1, next: -1, turnNode: -1,
      });
      v.s = t * edge.length;
      v.speed = 0; // nasce parado: longe da vista, e nunca em cima de um sinal vermelho sem espaço para frear
      place(v, 1);
      return;
    }
  }

  return { vehicles, step };
}
