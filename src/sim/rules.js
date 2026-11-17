/**
 * As regras que custam caro: batida (em veículo ou parede), radar de sinal vermelho, contramão e calçada.
 * Só alguns cruzamentos têm radar: nos outros dá para furar o sinal sem multa — o risco é só a batida.
 * Fala com o resto por eventos; `sidewalkLeft` e `cameraAhead()` alimentam os avisos do HUD.
 */
export function createRules({ city, signals, traffic, bike, economy, events, rng, config: cfg }) {
  const { edges, nodes } = city;
  const cameras = new Set(nodes.filter((node) => node.signal && rng.chance(cfg.cameraShare)).map((node) => node.id));
  let insideNode = -1; // cruzamento em que a moto está
  let approach = -1; // via pela qual ela vinha antes de entrar nele
  let wrongWay = 0; // segundos seguidos na contramão
  let finedEdge = -1; // via de mão única já multada (uma multa por via)
  let repairCooldown = 0;
  let sidewalkTime = 0;
  let sidewalkCooldown = 0;

  const rules = {
    cameras,
    /** Segundos até a multa de calçada, ou `null` se a moto não está na calçada. */
    sidewalkLeft: null,

    step(dt) {
      if (bike.frozen || !bike.road) return;
      repairCooldown -= dt;
      if (bike.wallHit) impact(bike.wallHit, 'parede');
      checkVehicles();
      checkRedLight();
      checkWrongWay(dt);
      checkSidewalk(dt);
    },

    /** Radar mais próximo à frente da moto: `{ distance }` ou `null`. */
    cameraAhead() {
      let best = null;
      const fx = Math.cos(bike.heading);
      const fz = Math.sin(bike.heading);
      for (const id of cameras) {
        const dx = nodes[id].x - bike.x;
        const dz = nodes[id].z - bike.z;
        const distance = Math.hypot(dx, dz);
        if (distance > cfg.cameraWarnDistance || distance < nodes[id].radius) continue;
        if ((dx * fx + dz * fz) / distance < cfg.cameraWarnCone) continue;
        if (!best || distance < best.distance) best = { id, distance };
      }
      return best;
    },
  };

  /** Três faixas: tranco (devagar), conserto (médio) e acidente (rápido). */
  /** `chargeable`: o conserto só sai do bolso quando foi a moto que bateu. */
  function impact(speed, kind, vehicleId, crashAt = cfg.crashSpeed, chargeable = true) {
    if (speed > crashAt) {
      bike.frozen = true;
      return events.emit('crash', { kind, vehicleId, relSpeed: speed });
    }
    events.emit('bump', { kind, speed });
    if (!chargeable || speed < cfg.damageSpeed || repairCooldown > 0) return;
    repairCooldown = cfg.repairCooldown;
    economy.chargeFine(cfg.repairCost, 'conserto');
    events.emit('damage', { kind, amount: cfg.repairCost });
  }

  function checkVehicles() {
    for (const v of traffic.vehicles) {
      if (!v.active) continue;
      // Posição da moto no referencial do veículo: `along` no comprimento, `across` na largura.
      const dx = bike.x - v.x;
      const dz = bike.z - v.z;
      const fx = Math.cos(v.heading);
      const fz = Math.sin(v.heading);
      const along = dx * fx + dz * fz;
      const across = dz * fx - dx * fz;
      if (Math.abs(along) > v.length / 2 + bike.radius || Math.abs(across) > v.width / 2 + bike.radius) continue;

      const bx = Math.cos(bike.heading) * bike.speed;
      const bz = Math.sin(bike.heading) * bike.speed;
      const relSpeed = Math.hypot(bx - fx * v.speed, bz - fz * v.speed);
      // Quem bate leva a pior: se o veículo estava mais rápido que a moto, foi ele que bateu nela, e é preciso
      // mais força para ser acidente (uma raspada de carro na moto parada é conserto, não morte).
      const hitByIt = v.speed > Math.abs(bike.speed);
      impact(relSpeed, 'veiculo', v.id, hitByIt ? cfg.crashSpeedWhenHit : cfg.crashSpeed, !hitByIt);
      if (bike.frozen) return;
      // A moto é empurrada para fora da lataria e perde o embalo.
      const push = v.width / 2 + bike.radius - Math.abs(across);
      const side = Math.sign(across) || 1;
      bike.x += -fz * side * push;
      bike.z += fx * side * push;
      bike.speed *= cfg.bumpKeep;
    }
  }

  function checkRedLight() {
    const edge = edges[bike.road.edge];
    let now = -1;
    for (const id of [edge.a, edge.b]) {
      if (Math.hypot(bike.x - nodes[id].x, bike.z - nodes[id].z) < nodes[id].radius) now = id;
    }
    if (now < 0) approach = bike.road.edge;
    else if (now !== insideNode && cameras.has(now) && Math.abs(bike.speed) > cfg.fineMinSpeed && signals.stateFor(now, approach) === 'vermelho') {
      fine('sinal', cfg.fineRedLight);
    }
    insideNode = now;
  }

  function checkWrongWay(dt) {
    const edge = edges[bike.road.edge];
    const along = (Math.cos(bike.heading) * edge.dir.x + Math.sin(bike.heading) * edge.dir.z) * bike.speed;
    wrongWay = edge.oneWay && along < -cfg.fineMinSpeed && insideNode < 0 ? wrongWay + dt : 0;
    if (wrongWay < cfg.wrongWayGrace || finedEdge === edge.id) return;
    finedEdge = edge.id;
    fine('contramao', cfg.fineWrongWay);
  }

  /** Na calçada corre um contador; zerou, multa, e o contador recomeça depois de um intervalo. */
  function checkSidewalk(dt) {
    sidewalkCooldown -= dt;
    if (!bike.onSidewalk) {
      sidewalkTime = 0;
      rules.sidewalkLeft = null;
      return;
    }
    if (sidewalkCooldown > 0) return (rules.sidewalkLeft = null);
    sidewalkTime += dt;
    rules.sidewalkLeft = Math.max(0, cfg.sidewalkGrace - sidewalkTime);
    if (sidewalkTime < cfg.sidewalkGrace) return;
    sidewalkTime = 0;
    sidewalkCooldown = cfg.sidewalkCooldown;
    fine('calcada', cfg.fineSidewalk);
  }

  function fine(kind, amount) {
    economy.chargeFine(amount, kind);
    events.emit('fine', { kind, amount });
  }

  return rules;
}
