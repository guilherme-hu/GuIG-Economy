/** GPS: da rota até o destino, tira a próxima manobra para o HUD. */
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
