/** Geometria 2D no plano XZ usada pelo gerador de cidade. */
export const TAU = Math.PI * 2;

export const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
export const round2 = (v) => Math.round(v * 100) / 100;

export function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  let t = len2 ? ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}

/** Onde os segmentos ab e cd se cruzam: `{ t, u }` (frações em ab e em cd) ou null. */
export function segmentCrossing(a, b, c, d) {
  const rx = b.x - a.x;
  const rz = b.z - a.z;
  const sx = d.x - c.x;
  const sz = d.z - c.z;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den;
  const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den;
  return t < 0 || t > 1 || u < 0 || u > 1 ? null : { t, u };
}

/** true se ab e cd se cruzam fora das pontas (ponta em comum não conta). */
export function segmentsCross(a, b, c, d, eps = 1e-6) {
  const hit = segmentCrossing(a, b, c, d);
  return !!hit && hit.t > eps && hit.t < 1 - eps && hit.u > eps && hit.u < 1 - eps;
}

/** Menor ângulo (0..π) entre duas direções dadas em radianos. */
export function angleGap(a, b) {
  const d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
}

/** Polilinha com comprimento de arco: `at(s)` devolve o ponto a `s` metros do início. */
export function createPolyline(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  const length = cum[cum.length - 1];

  function at(s) {
    const c = Math.min(Math.max(s, 0), length);
    let i = 0;
    while (i < points.length - 2 && cum[i + 1] < c) i++;
    const span = cum[i + 1] - cum[i];
    return lerp(points[i], points[i + 1], span ? (c - cum[i]) / span : 0);
  }

  /** Ponto mais próximo da polilinha: distância, arco e lado (1 = direita do sentido da linha). */
  function nearest(p) {
    let best = { dist: Infinity, s: 0, side: 1 };
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const dx = points[i + 1].x - a.x;
      const dz = points[i + 1].z - a.z;
      const len2 = dx * dx + dz * dz;
      let t = len2 ? ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
      if (d >= best.dist) continue;
      const side = dx * (p.z - a.z) - dz * (p.x - a.x) >= 0 ? 1 : -1;
      best = { dist: d, s: cum[i] + t * (cum[i + 1] - cum[i]), side };
    }
    return best;
  }

  const distance = (p) => {
    let best = Infinity;
    for (let i = 0; i < points.length - 1; i++) best = Math.min(best, distToSegment(p, points[i], points[i + 1]));
    return best;
  };

  return { points, cum, length, at, nearest, distance };
}

/** Cruzamentos entre duas polilinhas: `[{ sA, sB, x, z }]`. */
export function polylineCrossings(A, B) {
  const hits = [];
  for (let i = 0; i < A.points.length - 1; i++) {
    for (let j = 0; j < B.points.length - 1; j++) {
      const hit = segmentCrossing(A.points[i], A.points[i + 1], B.points[j], B.points[j + 1]);
      if (!hit) continue;
      const p = lerp(A.points[i], A.points[i + 1], hit.t);
      hits.push({
        sA: A.cum[i] + hit.t * (A.cum[i + 1] - A.cum[i]),
        sB: B.cum[j] + hit.u * (B.cum[j + 1] - B.cum[j]),
        x: p.x,
        z: p.z,
      });
    }
  }
  return hits;
}

/** Embaralha no lugar (Fisher–Yates) com o rng injetado. */
export function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
