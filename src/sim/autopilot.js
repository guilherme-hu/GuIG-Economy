/**
 * Piloto automático: segue uma rota do grafo devolvendo o mesmo `inputState` que o teclado daria.
 * Serve para verificar o jogo sem um humano pilotando e, mais adiante, para o balanceamento.
 */
export function createAutopilot({ city, graph, bike, config: cfg }) {
  const { edges, nodes } = city;
  const input = { throttle: 0, steer: 0, brake: false, horn: false };
  let path = []; // pontos a seguir, já deslocados para a mão direita
  let lengths = []; // distância acumulada até cada ponto
  let progress = 0; // quanto da rota já ficou para trás, em metros
  let segment = 0;
  let cornerSpeeds = []; // velocidade segura para passar por cada ponto da rota
  let turningAround = 0; // sentido do retorno em andamento (0 = nenhum)
  let stalled = 0; // segundos parado querendo andar
  let backingUp = 0; // segundos de ré que faltam para desencalhar
  const aim = { x: 0, z: 0 };

  const pilot = {
    active: false,
    arrived: false,
    wanted: 0, // velocidade que ele está tentando manter, em m/s
    input,

    /** Passa a seguir a rota (o retorno de `graph.route`). */
    follow(route) {
      path = rightLane(route);
      lengths = [0];
      for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
      cornerSpeeds = path.map((_, i) => cornerSpeed(i));
      progress = 0;
      segment = 0;
      turningAround = 0;
      stalled = 0;
      backingUp = 0;
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
      aimAt(cfg.lookAhead + cfg.lookAheadPerSpeed * pace);
      const error = wrap(Math.atan2(aim.z - bike.z, aim.x - bike.x) - bike.heading);
      // Alvo atrás da moto: escolhe um lado e mantém até completar o retorno, senão o erro fica trocando de sinal.
      if (Math.abs(error) < cfg.turnAroundDone) turningAround = 0;
      else if (Math.abs(error) > cfg.turnAroundStart && !turningAround) turningAround = error >= 0 ? 1 : -1;
      input.steer = turningAround || clamp(error * cfg.steerGain, -1, 1);

      const limit = edges[bike.road.edge].speedLimit * cfg.cruise;
      const cornering = limit * (1 - cfg.cornerSlowdown * Math.min(1, Math.abs(error) / cfg.cornerAngle));
      const wanted = Math.max(Math.min(cornering, plannedSpeed(left)), cfg.crawl);
      pilot.wanted = wanted;
      input.brake = pace > wanted + 4;
      input.throttle = input.brake ? 0 : pace < wanted ? 1 : pace > wanted + 1 ? -1 : 0;
      if (bike.speed < 0) input.throttle = 1;
      unstick(dt, pace, error);
      return input;
    },
  };

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
    for (let distance = progress; ; distance += cfg.aimStep) {
      const along = Math.min(distance, total);
      while (i < path.length - 2 && lengths[i + 1] < along) i++;
      const t = clamp((along - lengths[i]) / (lengths[i + 1] - lengths[i] || 1), 0, 1);
      aim.x = path[i].x + (path[i + 1].x - path[i].x) * t;
      aim.z = path[i].z + (path[i + 1].z - path[i].z) * t;
      if (along >= total || Math.hypot(aim.x - bike.x, aim.z - bike.z) >= reach) return;
    }
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
      points.push({ x: exit.x, z: exit.z });
    });
    points.push(route.points[route.points.length - 1]);
    return points;
  }

  return pilot;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
