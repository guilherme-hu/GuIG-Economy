/** GPS: da rota até o destino, tira a próxima manobra, e um piloto automático que a segue. */
const TURN_ANGLE = 0.5; // rad: mudança de direção que conta como curva
const UTURN_ANGLE = 2.6;

/** `{ turn, distance, street, remaining }` para o HUD, ou `null` sem rota. */
export function nextManeuver(route, city) {
  if (!route) return null;
  const { points, steps } = route;
  let distance = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const ax = points[i].x - points[i - 1].x;
    const az = points[i].z - points[i - 1].z;
    const bx = points[i + 1].x - points[i].x;
    const bz = points[i + 1].z - points[i].z;
    distance += Math.hypot(ax, az);
    const angle = Math.atan2(ax * bz - az * bx, ax * bx + az * bz); // positivo = direita
    if (Math.abs(angle) < TURN_ANGLE) continue;
    const turn = Math.abs(angle) > UTURN_ANGLE ? 'retorno' : angle > 0 ? 'direita' : 'esquerda';
    return { turn, distance, street: city.edges[steps[i]?.edge]?.name ?? '', remaining: route.length };
  }
  return { turn: 'chegada', distance: route.length, street: '', remaining: route.length };
}

/**
 * Piloto automático: devolve comandos (mesmo formato de `input.state`) para seguir a rota.
 * Serve para verificar o jogo sem humano e para os bots de balanceamento.
 */
export function createAutopilot(config) {
  const command = { throttle: 0, steer: 0, brake: false, horn: false };

  return function drive(bike, route, maneuver) {
    command.throttle = 0;
    command.steer = 0;
    command.brake = true;
    if (!route || route.length < config.arriveDistance) return command;

    const aim = pointAhead(route.points, Math.max(config.lookahead, Math.abs(bike.speed) * config.lookaheadTime));
    const error = wrap(Math.atan2(aim.z - bike.z, aim.x - bike.x) - bike.heading);
    command.steer = Math.max(-1, Math.min(1, error * config.steerGain));

    // Velocidade que ainda permite frear até a curva e até o destino.
    const brakingTo = (speed, distance) => Math.sqrt(speed * speed + 2 * config.decel * Math.max(0, distance));
    let target = Math.min(config.cruise, brakingTo(0, route.length - config.arriveDistance));
    if (maneuver && maneuver.turn !== 'chegada') target = Math.min(target, brakingTo(config.cornerSpeed, maneuver.distance - config.cornerMargin));
    if (Math.abs(error) > 1) target = Math.min(target, config.cornerSpeed); // muito desalinhado: manobra devagar

    command.brake = bike.speed > target + 2;
    command.throttle = bike.speed < target ? 1 : 0;
    return command;
  };
}

/** Ponto a `distance` metros do início da polilinha. */
function pointAhead(points, distance) {
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    if (distance <= length || i === points.length - 1) {
      const k = length > 0 ? Math.min(1, distance / length) : 1;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * k, z: points[i - 1].z + (points[i].z - points[i - 1].z) * k };
    }
    distance -= length;
  }
  return points[points.length - 1];
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
