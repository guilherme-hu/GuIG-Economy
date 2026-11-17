/** As regras que custam caro: batida em veículo, sinal vermelho e contramão. Fala com o resto só por eventos. */
export function createRules({ city, signals, traffic, bike, economy, events, config: cfg }) {
  const { edges, nodes } = city;
  let insideNode = -1; // cruzamento em que a moto está
  let approach = -1; // via pela qual ela vinha antes de entrar nele
  let wrongWay = 0; // segundos seguidos na contramão
  let finedEdge = -1; // via de mão única já multada (uma multa por via)

  function step(dt) {
    if (bike.frozen || !bike.road) return;
    checkCollisions();
    checkRedLight();
    checkWrongWay(dt);
  }

  function checkCollisions() {
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

      const relSpeed = Math.hypot(Math.cos(bike.heading) * bike.speed - fx * v.speed, Math.sin(bike.heading) * bike.speed - fz * v.speed);
      if (relSpeed > cfg.crashSpeed) {
        bike.frozen = true;
        return events.emit('crash', { vehicleId: v.id, relSpeed });
      }
      // Toque leve: a moto é empurrada para fora da lataria e perde o embalo.
      const push = v.width / 2 + bike.radius - Math.abs(across);
      const side = Math.sign(across) || 1;
      bike.x += -fz * side * push;
      bike.z += fx * side * push;
      bike.speed *= cfg.bumpKeep;
      events.emit('bump', { kind: 'veiculo', speed: relSpeed });
    }
  }

  function checkRedLight() {
    const edge = edges[bike.road.edge];
    let now = -1;
    for (const id of [edge.a, edge.b]) {
      if (Math.hypot(bike.x - nodes[id].x, bike.z - nodes[id].z) < nodes[id].radius) now = id;
    }
    if (now < 0) approach = bike.road.edge;
    else if (now !== insideNode && Math.abs(bike.speed) > cfg.fineMinSpeed && signals.stateFor(now, approach) === 'vermelho') {
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

  function fine(kind, amount) {
    economy.chargeFine(amount, kind);
    events.emit('fine', { kind, amount });
  }

  return { step };
}
