/**
 * Triangulação de Delaunay (Bowyer–Watson, O(n²): sobra para os ~400 nós da cidade).
 * Devolve `[[a, b, c]]` com índices em `points`. Supõe pontos em posição geral (o gerador sempre aplica jitter).
 */
export function triangulate(points) {
  const n = points.length;
  const all = points.concat(superTriangle(points));
  let triangles = [makeTriangle(all, n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) triangles = insertPoint(all, triangles, i);
  return triangles.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

function superTriangle(points) {
  let reach = 1;
  for (const p of points) reach = Math.max(reach, Math.abs(p.x), Math.abs(p.z));
  const r = reach * 40;
  return [{ x: -r, z: -r }, { x: r, z: -r }, { x: 0, z: r }];
}

function makeTriangle(points, a, b, c) {
  const A = points[a];
  const B = points[b];
  const C = points[c];
  const d = 2 * (A.x * (B.z - C.z) + B.x * (C.z - A.z) + C.x * (A.z - B.z));
  const a2 = A.x * A.x + A.z * A.z;
  const b2 = B.x * B.x + B.z * B.z;
  const c2 = C.x * C.x + C.z * C.z;
  const cx = (a2 * (B.z - C.z) + b2 * (C.z - A.z) + c2 * (A.z - B.z)) / d;
  const cz = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d;
  return { a, b, c, cx, cz, r2: (A.x - cx) ** 2 + (A.z - cz) ** 2 };
}

/** Remove os triângulos cujo circuncírculo contém o ponto e religa a borda do buraco a ele. */
function insertPoint(points, triangles, i) {
  const p = points[i];
  const kept = [];
  const boundary = new Map();
  for (const t of triangles) {
    if ((p.x - t.cx) ** 2 + (p.z - t.cz) ** 2 >= t.r2) {
      kept.push(t);
      continue;
    }
    toggleEdge(boundary, t.a, t.b);
    toggleEdge(boundary, t.b, t.c);
    toggleEdge(boundary, t.c, t.a);
  }
  for (const [u, v] of boundary.values()) kept.push(makeTriangle(points, u, v, i));
  return kept;
}

/** Aresta compartilhada por dois triângulos removidos é interna ao buraco: some. */
function toggleEdge(boundary, u, v) {
  const key = u < v ? u * 65536 + v : v * 65536 + u;
  if (!boundary.delete(key)) boundary.set(key, [u, v]);
}
