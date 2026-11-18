/**
 * Piloto automático: segue uma rota do grafo devolvendo o mesmo `inputState` que o teclado daria.
 * Serve para verificar o jogo sem um humano pilotando e para o balanceamento.
 * Com `traffic` e `signals`, freia para o veículo à frente e para na linha de retenção quando o sinal fecha,
 * conforme `cfg.obeyLights`: 'sempre', 'radar' (só onde há radar, em `cameras`) ou 'nunca'.
 */
export function createAutopilot({ city, graph, bike, config: cfg, traffic = null, signals = null, cameras = null }) {
  const { edges, nodes } = city;
  const input = { throttle: 0, steer: 0, brake: false, horn: false };
  let path = []; // pontos a seguir, já deslocados para a mão direita
  let lengths = []; // distância acumulada até cada ponto
  let progress = 0; // quanto da rota já ficou para trás, em metros
  let segment = 0;
  let cornerSpeeds = []; // velocidade segura para passar por cada ponto da rota
  let junctions = []; // cruzamentos da rota: { at /* índice do ponto no centro dele */, nodeId, edgeId /* via de chegada */ }
  let passing = -1; // cruzamento que ele já decidiu atravessar
  let stopping = -1; // cruzamento em que ele já decidiu parar no amarelo
  let turningAround = 0; // sentido do retorno em andamento (0 = nenhum)
  let stalled = 0; // segundos parado querendo andar
  let backingUp = 0; // segundos de ré que faltam para desencalhar
  const aim = { x: 0, z: 0 };
  const aimDir = { x: 1, z: 0 }; // direção do trecho da rota onde está a mira
  let shift = 0; // m para a esquerda da faixa: > 0 quando está costurando no corredor
  let splitTimer = 0; // s que ele ainda fica no corredor depois de passar o último carro
  let splitTarget = 0; // desvio lateral do corredor, fixado ao entrar nele
  let shiftGoal = 0; // para onde o desvio está indo agora (0 = faixa)
  let waitedOn = 0; // s parado atrás do mesmo veículo parado
  let ignored = null; // veículo que ele decidiu contornar devagar (impasse)
  let ignoreLeft = 0;
  // Pontos da rota à frente (com e sem o desvio do corredor), recalculados a cada passo.
  const look = { lane: makeSamples(), split: makeSamples() };

  const pilot = {
    active: false,
    arrived: false,
    wanted: 0, // velocidade que ele está tentando manter, em m/s
    limitedBy: 'via', // o que limita essa velocidade agora: 'via', 'veículo à frente' ou 'cruzamento'
    blocker: null, // o veículo que o está segurando, se houver
    splitting: false, // costurando no corredor
    input,

    /** Passa a seguir a rota (o retorno de `graph.route`). */
    follow(route) {
      junctions = [];
      passing = -1;
      stopping = -1;
      path = rightLane(route);
      lengths = [0];
      for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
      cornerSpeeds = path.map((_, i) => cornerSpeed(i));
      progress = 0;
      segment = 0;
      turningAround = 0;
      stalled = 0;
      backingUp = 0;
      shift = 0;
      splitTimer = 0;
      pilot.active = path.length > 1;
      pilot.arrived = false;
    },

    /** Traça a rota de onde a moto está até `to` ({ edge, t }) e passa a segui-la. Falso se não há caminho. */
    goTo(to) {
      const route = graph.route({ edge: bike.road.edge, t: bike.road.t }, to);
      if (route) pilot.follow(route);
      return route !== null;
    },

    stop() {
      pilot.active = false;
      Object.assign(input, { throttle: 0, steer: 0, brake: false });
    },

    /** Atualiza e devolve o comando deste passo. `dt` só serve para ele perceber que encalhou. */
    step(dt = 1 / 60) {
      if (!pilot.active) return input;
      advance();
      const total = lengths[lengths.length - 1];
      const left = total - progress;
      const end = path[path.length - 1];
      if (left <= cfg.arrive || Math.hypot(end.x - bike.x, end.z - bike.z) <= cfg.arrive) {
        pilot.arrived = true;
        pilot.stop();
        input.brake = true;
        return input;
      }
      const pace = Math.abs(bike.speed);
      updateSplit(dt);
      aimAt(cfg.lookAhead + cfg.lookAheadPerSpeed * pace);
      if (shift) shiftLeft(aim, aimDir, shift);
      const error = wrap(Math.atan2(aim.z - bike.z, aim.x - bike.x) - bike.heading);
      // Alvo atrás da moto: escolhe um lado e mantém até completar o retorno, senão o erro fica trocando de sinal.
      if (Math.abs(error) < cfg.turnAroundDone) turningAround = 0;
      else if (Math.abs(error) > cfg.turnAroundStart && !turningAround) turningAround = error >= 0 ? 1 : -1;
      input.steer = turningAround || clamp(error * cfg.steerGain, -1, 1);

      const limit = edges[bike.road.edge].speedLimit * cfg.cruise;
      const cornering = limit * (1 - cfg.cornerSlowdown * Math.min(1, Math.abs(error) / cfg.cornerAngle));
      // Trânsito e sinal podem pedir parada total, então ficam fora do piso `crawl`.
      const road = Math.max(Math.min(cornering, plannedSpeed(left)), cfg.crawl);
      const ahead = vehicleAheadSpeed(dt);
      const junction = junctionSpeed();
      const wanted = Math.min(road, ahead, junction, ignoreLeft > 0 ? cfg.nudgeSpeed : Infinity, pilot.splitting ? cfg.splitSpeed : Infinity);
      pilot.wanted = wanted;
      pilot.limitedBy = wanted === road ? 'via' : wanted === ahead ? 'veículo à frente' : 'cruzamento';
      input.brake = pace > wanted + 4 || (wanted < cfg.crawl && pace > wanted + 0.3); // para de verdade, sem ir arrastando
      input.throttle = input.brake ? 0 : pace < wanted ? 1 : pace > wanted + 1 ? -1 : 0;
      if (bike.speed < 0) input.throttle = 1;
      unstick(dt, pace, error);
      return input;
    },
  };

  /**
   * Velocidade que ainda permite frear atrás do primeiro veículo no caminho. "No caminho" é medido ao longo
   * da rota (com o desvio do corredor, se houver), não em linha reta: assim ele enxerga o carro parado logo
   * depois da curva. Se ficar muito tempo parado atrás de um veículo parado, contorna devagar (impasse).
   */
  function vehicleAheadSpeed(dt) {
    pilot.blocker = null;
    if (!traffic) return Infinity;
    const pace = Math.abs(bike.speed);
    ignoreLeft = Math.max(0, ignoreLeft - dt);
    if (!ignoreLeft) ignored = null;
    // No meio da manobra (entrando ou saindo do corredor), vale o que estiver mais perto na faixa ou no corredor:
    // a moto ainda não chegou na linha nova e bateria no carro que está "fora do caminho" só depois da manobra.
    // A moto segue a mira com atraso: vale onde ela está de fato, não só para onde o desvio já foi.
    const offLine = Math.hypot(bike.x - look.split.x[0], bike.z - look.split.z[0]) > cfg.lineTolerance;
    const shifting = Math.abs(shift - shiftGoal) > 0.1 || offLine;
    const inLane = shifting ? firstInPath(look.lane, ignored) : null;
    const inSplit = firstInPath(look.split, ignored);
    const hit = inLane && (!inSplit || inLane.distance < inSplit.distance) ? inLane : inSplit;
    if (!hit) {
      waitedOn = 0;
      return Infinity;
    }
    const { vehicle, distance } = hit;
    pilot.blocker = vehicle;
    waitedOn = pace < 0.3 && vehicle.speed < 0.3 ? waitedOn + dt : 0;
    if (waitedOn > cfg.impatience) {
      ignored = vehicle;
      ignoreLeft = cfg.nudgeTime;
      waitedOn = 0;
    }
    const gap = distance - cfg.followGap - pace * cfg.followTime; // distância em tempo, não só em metros
    const theirs = Math.max(0, Math.cos(vehicle.heading - bike.heading) * vehicle.speed); // quanto ele anda no mesmo sentido
    return Math.sqrt(theirs * theirs + 2 * cfg.brake * Math.max(0, gap));
  }

  /** O primeiro veículo cuja lataria encosta na linha de pontos `samples` (e a que distância, ao longo da rota). */
  function firstInPath(samples, skip, onlyCars = false) {
    let best = null;
    for (const v of traffic.vehicles) {
      if (!v.active || v === skip || (onlyCars && v.reckless)) continue;
      // Quem vem andando no sentido contrário está na outra mão; parado no caminho (numa conversão), conta.
      if (Math.cos(v.heading - bike.heading) < -0.5 && v.speed > 1) continue;
      if (Math.abs(v.x - bike.x) > cfg.carLook + 6 || Math.abs(v.z - bike.z) > cfg.carLook + 6) continue;
      const fx = Math.cos(v.heading);
      const fz = Math.sin(v.heading);
      for (let i = 0; i < samples.count; i++) {
        if (best && samples.d[i] >= best.distance) break;
        const dx = samples.x[i] - v.x;
        const dz = samples.z[i] - v.z;
        if (Math.abs(dx * fx + dz * fz) > v.length / 2 + 0.5) continue;
        if (Math.abs(dx * fz - dz * fx) > v.width / 2 + cfg.carClearance) continue;
        best = { vehicle: v, distance: samples.d[i] };
        break;
      }
    }
    return best;
  }

  /**
   * Corredor: com um carro lento na frente, numa rua de mão dupla de uma faixa, ele vai para perto da faixa do
   * meio e passa pela fila, como os motoboys. Volta para a faixa quando não tem mais carro para passar.
   */
  function updateSplit(dt) {
    const edge = edges[bike.road.edge];
    sampleRoute(look.lane, 0);
    if (traffic && cfg.laneSplit) {
      const blocked = firstInPath(look.lane, null, true);
      const slow = blocked && blocked.distance < cfg.splitLook && blocked.vehicle.speed < edge.speedLimit * cfg.cruise * 0.8;
      // Entra no corredor só numa rua de mão dupla de uma faixa; uma vez nele, fica enquanto a faixa estiver ocupada
      // (perto do cruzamento a "via mais próxima" muda, e voltar para a faixa ali seria cair atrás de um carro parado).
      const canEnter = !edge.oneWay && edge.lanes === 1;
      if (slow && (shift > 0 || canEnter)) {
        if (!splitTimer) splitTarget = Math.max(0, edge.halfWidth / 2 - cfg.splitLine);
        splitTimer = cfg.splitHold;
      } else splitTimer = Math.max(0, splitTimer - dt);
    }
    shiftGoal = splitTimer > 0 ? splitTarget : 0;
    shift += clamp(shiftGoal - shift, -cfg.shiftRate * dt, cfg.shiftRate * dt);
    pilot.splitting = shift > 0.3;
    sampleRoute(look.split, shift);
  }

  function makeSamples() {
    const size = 64;
    return { x: new Float64Array(size), z: new Float64Array(size), d: new Float64Array(size), count: 0 };
  }

  /** Pontos da rota de `sampleStep` em `sampleStep` metros à frente da moto, deslocados `side` metros para a esquerda. */
  function sampleRoute(samples, side) {
    let i = segment;
    samples.count = 0;
    const total = lengths[lengths.length - 1];
    for (let d = 0; d <= cfg.carLook && samples.count < samples.x.length; d += cfg.sampleStep) {
      const along = Math.min(progress + d, total);
      while (i < path.length - 2 && lengths[i + 1] < along) i++;
      const span = lengths[i + 1] - lengths[i] || 1;
      const t = clamp((along - lengths[i]) / span, 0, 1);
      const dirX = (path[i + 1].x - path[i].x) / span;
      const dirZ = (path[i + 1].z - path[i].z) / span;
      samples.x[samples.count] = path[i].x + (path[i + 1].x - path[i].x) * t + dirZ * side;
      samples.z[samples.count] = path[i].z + (path[i + 1].z - path[i].z) * t - dirX * side;
      samples.d[samples.count] = d;
      samples.count++;
      if (along >= total) break;
    }
  }

  /** Desloca `point` `side` metros para a esquerda de `dir`. */
  function shiftLeft(point, dir, side) {
    point.x += dir.z * side;
    point.z -= dir.x * side;
  }


  /**
   * Velocidade que ainda permite parar na linha de retenção do próximo cruzamento da rota, se for preciso parar:
   * sinal fechado (conforme `obeyLights`) ou, com `yieldToTraffic`, um veículo já atravessando o cruzamento.
   * Perto da linha e com passagem livre, ele se compromete a passar e não para mais no meio.
   */
  function junctionSpeed() {
    const next = junctions.find((j) => lengths[j.at] > progress);
    if (!next) return Infinity;
    const toLine = lengths[next.at] - progress - nodes[next.nodeId].radius - 2; // para um pouco antes da linha
    // Cruzamento se atravessa devagar (crossSpeed); os apressados não reduzem (crossSpeed = Infinity).
    const crossing = Math.sqrt(cfg.crossSpeed ** 2 + 2 * cfg.brake * Math.max(0, toLine));
    if (passing === next.nodeId || toLine < -3) return crossing;
    if (mustStopForLight(next, toLine) || (toLine < cfg.yieldLook && someoneCrossing(next.nodeId))) {
      return Math.sqrt(2 * cfg.brake * Math.max(0, toLine));
    }
    if (toLine < cfg.commitDistance) passing = next.nodeId;
    return crossing;
  }

  function mustStopForLight({ nodeId, edgeId }, toLine) {
    if (!signals || cfg.obeyLights === 'nunca') return false;
    if (cfg.obeyLights === 'radar' && !cameras?.has(nodeId)) return false;
    const light = signals.stateFor(nodeId, edgeId);
    const pace = Math.abs(bike.speed);
    const canStop = (pace * pace) / (2 * cfg.brake * 1.5) < toLine;
    // Decidiu parar no amarelo, mantém a decisão: perto da linha, ainda freando, o "dá para parar" vira "não dá"
    // e ele acelerava de volta, entrando no cruzamento já no vermelho.
    if (light === 'amarelo' && cfg.stopOnYellow && (canStop || stopping === nodeId)) stopping = nodeId;
    else if (light !== 'vermelho') stopping = -1;
    return light === 'vermelho' || stopping === nodeId;
  }

  /**
   * Algum veículo, que não vai no mesmo sentido da moto, já dentro do cruzamento. Quem ainda está chegando
   * espera a moto (ver `playerHasWay` no trânsito); esperar por ele também faria os dois travarem.
   */
  function someoneCrossing(nodeId) {
    if (!traffic || !cfg.yieldToTraffic) return false;
    // `inNode` é o registro do próprio trânsito: só quem entrou de fato. Quem está parado na linha não conta.
    return traffic.vehicles.some((v) => v.active && v.inNode === nodeId && Math.cos(v.heading - bike.heading) < 0.8);
  }



  /** De nariz numa parede a moto não anda nem vira: dá uma ré curta, com o guidão ao contrário, e tenta de novo. */
  function unstick(dt, pace, error) {
    stalled = pace < cfg.stallSpeed && input.throttle > 0 ? stalled + dt : 0;
    if (stalled > cfg.stallTime) {
      backingUp = cfg.backUpTime;
      stalled = 0;
    }
    if (backingUp <= 0) return;
    backingUp -= dt;
    input.throttle = -1;
    input.brake = false;
    input.steer = error >= 0 ? -1 : 1;
  }

  /**
   * Atualiza `progress` para o ponto da rota onde a moto está, olhando alguns trechos à frente.
   * Entre trechos quase à mesma distância ganha o mais adiantado: numa curva fechada os dois lados
   * do cotovelo ficam colados, e é melhor considerar a curva feita do que ficar preso antes dela.
   */
  function advance() {
    let best = segment;
    let bestGap = Infinity;
    let bestT = 0;
    for (let i = segment; i < Math.min(segment + cfg.trackWindow, path.length - 1); i++) {
      const a = path[i];
      const b = path[i + 1];
      const span = lengths[i + 1] - lengths[i];
      const t = span > 0 ? clamp(((bike.x - a.x) * (b.x - a.x) + (bike.z - a.z) * (b.z - a.z)) / (span * span), 0, 1) : 1;
      const gap = Math.hypot(bike.x - (a.x + (b.x - a.x) * t), bike.z - (a.z + (b.z - a.z) * t));
      if (gap > bestGap + cfg.trackBias) continue;
      best = i;
      bestT = t;
      bestGap = Math.min(bestGap, gap);
    }
    segment = best;
    progress = Math.max(progress, lengths[best] + bestT * (lengths[best + 1] - lengths[best]));
  }

  /** Maior velocidade agora que ainda permite frear a tempo para cada curva à frente e para a chegada. */
  function plannedSpeed(left) {
    const reach = (speed, distance) => Math.sqrt(speed * speed + 2 * cfg.brake * Math.max(distance, 0));
    let speed = reach(0, left - cfg.arrive);
    for (let i = segment + 1; i < path.length - 1 && lengths[i] - progress < cfg.horizon; i++) {
      speed = Math.min(speed, reach(cornerSpeeds[i], lengths[i] - progress));
    }
    return speed;
  }

  /** Velocidade de curva no ponto `i`: compara o rumo da rota um pouco antes e um pouco depois dele. */
  function cornerSpeed(i) {
    if (i === 0 || i === path.length - 1) return Infinity;
    const before = headingAt(lengths[i] - cfg.cornerWindow);
    const after = headingAt(lengths[i] + cfg.cornerWindow);
    const angle = Math.abs(wrap(after - before));
    if (angle < 0.05) return Infinity;
    return Math.sqrt((cfg.cornerGrip * 2 * cfg.cornerWindow) / angle); // v² = aceleração lateral × raio
  }

  function headingAt(distance) {
    let i = 0;
    while (i < path.length - 2 && lengths[i + 1] < distance) i++;
    return Math.atan2(path[i + 1].z - path[i].z, path[i + 1].x - path[i].x);
  }

  /**
   * Põe em `aim` o primeiro ponto da rota, de onde a moto está em diante, que fica a pelo menos `reach`
   * metros dela em linha reta. Medir em linha reta (e não ao longo da rota) é o que impede a moto de
   * ficar girando em volta de um alvo colado nela depois de um cotovelo.
   */
  function aimAt(reach) {
    const total = lengths[lengths.length - 1];
    let i = segment;
    const setDir = () => {
      const span = lengths[i + 1] - lengths[i] || 1;
      aimDir.x = (path[i + 1].x - path[i].x) / span;
      aimDir.z = (path[i + 1].z - path[i].z) / span;
    };
    for (let distance = progress; ; distance += cfg.aimStep) {
      const along = Math.min(distance, total);
      while (i < path.length - 2 && lengths[i + 1] < along) i++;
      const t = clamp((along - lengths[i]) / (lengths[i + 1] - lengths[i] || 1), 0, 1);
      aim.x = path[i].x + (path[i + 1].x - path[i].x) * t;
      aim.z = path[i].z + (path[i + 1].z - path[i].z) * t;
      if (along >= total || Math.hypot(aim.x - bike.x, aim.z - bike.z) >= reach) return setDir();
    }
  }

  /**
   * Ponto por onde atravessar o cruzamento sem sair da própria mão: o centro dele, deslocado para a direita
   * de quem entra e de quem sai (na reta, fica no meio da faixa; numa curva, abre para o lado certo).
   * Passar pelo centro exato seria andar em cima da faixa do meio, onde as motos costuram na contramão.
   */
  function keepRight(node, inEdge, inForward, nextStep) {
    const outEdge = edges[nextStep.edge];
    const side = (edge, forward) => {
      const sign = forward ? 1 : -1;
      const lateral = edge.oneWay ? 0 : edge.halfWidth / 2;
      return { x: -edge.dir.z * sign * lateral, z: edge.dir.x * sign * lateral }; // direita de quem anda nesse sentido
    };
    const a = side(inEdge, inForward);
    const b = side(outEdge, nextStep.forward);
    return { x: node.x + (a.x + b.x) / 2, z: node.z + (a.z + b.z) / 2 };
  }

  /**
   * Troca cada trecho da rota pelo meio da faixa da direita. Em cada cruzamento a rota passa pelo centro
   * dele: ligar direto a saída de uma via à entrada da outra cortaria a esquina por cima da calçada.
   */
  function rightLane(route) {
    const points = [route.points[0]];
    const offset = (edge, forward) => (edge.oneWay ? 0 : (forward ? 1 : -1) * (edge.halfWidth / 2));
    route.steps.forEach((step, i) => {
      const edge = edges[step.edge];
      const entry = nodes[step.forward ? edge.a : edge.b];
      const exit = nodes[step.forward ? edge.b : edge.a];
      const lateral = offset(edge, step.forward);
      const at = (fromEntry) => graph.pointOnEdge(edge.id, step.forward ? fromEntry / edge.length : 1 - fromEntry / edge.length, lateral);
      const hasRoom = edge.length > entry.radius + exit.radius;
      if (i > 0 && hasRoom) points.push(at(entry.radius));
      if (i === route.steps.length - 1) return;
      if (hasRoom) points.push(at(edge.length - exit.radius));
      junctions.push({ at: points.length, nodeId: exit.id, edgeId: edge.id });
      points.push(keepRight(exit, edge, step.forward, route.steps[i + 1]));
    });
    points.push(route.points[route.points.length - 1]);
    return points;
  }

  return pilot;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
