/**
 * Geometria 2D no plano XZ usada pelo gerador da cidade e pelo grafo.
 * Convenção do projeto: o lado direito de uma direção `d` é `(-d.z, d.x)`.
 */

export const distance = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);

const orient = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);

/** Verdadeiro se os interiores de ab e cd se cruzam. Encostar numa ponta não conta. */
export function segmentsCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const o1 = orient(ax, az, bx, bz, cx, cz);
  const o2 = orient(ax, az, bx, bz, dx, dz);
  const o3 = orient(cx, cz, dx, dz, ax, az);
  const o4 = orient(cx, cz, dx, dz, bx, bz);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** Ponto de cruzamento de ab com cd, com `t` em ab; null se não se cruzam. */
export function segmentIntersection(ax, az, bx, bz, cx, cz, dx, dz) {
  const rx = bx - ax;
  const rz = bz - az;
  const sx = dx - cx;
  const sz = dz - cz;
  const denom = rx * sz - rz * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / denom;
  const u = ((cx - ax) * rz - (cz - az) * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + rx * t, z: az + rz * t, t, u };
}

/** Parâmetro (0..1) do ponto de ab mais próximo de p. */
export function closestT(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return 0;
  const t = ((px - ax) * dx + (pz - az) * dz) / len2;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function pointSegmentDistance(px, pz, ax, az, bx, bz) {
  const t = closestT(px, pz, ax, az, bx, bz);
  return Math.hypot(px - (ax + (bx - ax) * t), pz - (az + (bz - az) * t));
}

/** Menor ângulo (0..π) entre duas direções dadas em radianos. */
export function angleBetween(a, b) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/**
 * Linha poligonal com consultas por distância e por comprimento de arco.
 * Usada para o rio e para as margens (cópias deslocadas do rio).
 */
export function createPolyline(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + distance(points[i - 1].x, points[i - 1].z, points[i].x, points[i].z));
  }
  const length = cum[cum.length - 1];

  /** Ponto mais próximo: distância, lado (signed > 0 = direita do sentido da linha) e arco `s`. */
  function nearest(x, z) {
    let best = { dist: Infinity, signed: 0, s: 0, x: 0, z: 0 };
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const t = closestT(x, z, a.x, a.z, b.x, b.z);
      const qx = a.x + (b.x - a.x) * t;
      const qz = a.z + (b.z - a.z) * t;
      const dist = Math.hypot(x - qx, z - qz);
      if (dist >= best.dist) continue;
      const right = orient(a.x, a.z, b.x, b.z, x, z) > 0;
      best = { dist, signed: right ? dist : -dist, s: cum[i - 1] + (cum[i] - cum[i - 1]) * t, x: qx, z: qz };
    }
    return best;
  }

  /** Ponto e direção unitária no arco `s`. */
  function at(s) {
    const clamped = Math.min(Math.max(s, 0), length);
    let i = 1;
    while (i < points.length - 1 && cum[i] < clamped) i++;
    const a = points[i - 1];
    const b = points[i];
    const span = cum[i] - cum[i - 1] || 1;
    const t = (clamped - cum[i - 1]) / span;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / span, dz: (b.z - a.z) / span };
  }

  /** Primeiro cruzamento do segmento ab com a linha: ponto, `t` em ab e arco `s`; null se não cruza. */
  function intersect(ax, az, bx, bz) {
    let best = null;
    for (let i = 1; i < points.length; i++) {
      const c = points[i - 1];
      const d = points[i];
      const hit = segmentIntersection(ax, az, bx, bz, c.x, c.z, d.x, d.z);
      if (hit && (!best || hit.t < best.t)) best = { x: hit.x, z: hit.z, t: hit.t, s: cum[i - 1] + (cum[i] - cum[i - 1]) * hit.u };
    }
    return best;
  }

  /** Cópia deslocada `d` metros para a direita (negativo = esquerda). */
  function offset(d) {
    const moved = points.map((p, i) => {
      const prev = points[Math.max(i - 1, 0)];
      const next = points[Math.min(i + 1, points.length - 1)];
      const len = distance(prev.x, prev.z, next.x, next.z) || 1;
      const dx = (next.x - prev.x) / len;
      const dz = (next.z - prev.z) / len;
      return { x: p.x - dz * d, z: p.z + dx * d };
    });
    return createPolyline(moved);
  }

  return { points, length, nearest, at, intersect, crosses: (ax, az, bx, bz) => intersect(ax, az, bx, bz) !== null, offset };
}

/** Distância entre o segmento ab e um retângulo orientado (centro, meias medidas, heading). Zero se encostam. */
export function segmentRectDistance(ax, az, bx, bz, rect) {
  const cos = Math.cos(rect.heading);
  const sin = Math.sin(rect.heading);
  const local = (x, z) => [(x - rect.x) * cos + (z - rect.z) * sin, -(x - rect.x) * sin + (z - rect.z) * cos];
  const [u1, v1] = local(ax, az);
  const [u2, v2] = local(bx, bz);
  const hu = rect.hu;
  const hv = rect.hv;
  if (segmentHitsBox(u1, v1, u2, v2, hu, hv)) return 0;
  let best = Math.min(pointBoxDistance(u1, v1, hu, hv), pointBoxDistance(u2, v2, hu, hv));
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) best = Math.min(best, pointSegmentDistance(su * hu, sv * hv, u1, v1, u2, v2));
  }
  return best;
}

function pointBoxDistance(u, v, hu, hv) {
  return Math.hypot(Math.max(Math.abs(u) - hu, 0), Math.max(Math.abs(v) - hv, 0));
}

/** Recorte de Liang–Barsky: o segmento passa por dentro da caixa centrada na origem? */
function segmentHitsBox(u1, v1, u2, v2, hu, hv) {
  let t0 = 0;
  let t1 = 1;
  const du = u2 - u1;
  const dv = v2 - v1;
  const edges = [
    [-du, u1 + hu],
    [du, hu - u1],
    [-dv, v1 + hv],
    [dv, hv - v1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Dois retângulos orientados se sobrepõem? (teorema do eixo separador) */
export function rectsOverlap(a, b) {
  const axes = [a.heading, a.heading + Math.PI / 2, b.heading, b.heading + Math.PI / 2];
  for (const angle of axes) {
    const ax = Math.cos(angle);
    const az = Math.sin(angle);
    const gap = Math.abs((b.x - a.x) * ax + (b.z - a.z) * az);
    if (gap > rectRadius(a, ax, az) + rectRadius(b, ax, az)) return false;
  }
  return true;
}

function rectRadius(rect, ax, az) {
  const cos = Math.cos(rect.heading);
  const sin = Math.sin(rect.heading);
  return rect.hu * Math.abs(cos * ax + sin * az) + rect.hv * Math.abs(-sin * ax + cos * az);
}
