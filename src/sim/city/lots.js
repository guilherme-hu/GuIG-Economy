/**
 * Lotes: terrenos retangulares ao longo das ruas, dos dois lados, em fileiras (frente e fundos de quarteirão).
 * Um lote só entra se não encostar em rua, cruzamento, rio, borda do mapa ou outro lote.
 */
import { round2 } from './geometry.js';

const EPS = 0.01;

export function placeLots(city, river, edgeDistricts, cfg, rng) {
  const ctx = createContext(city, river, cfg);
  const styles = cfg.lots.districts;
  const maxRows = Math.max(...Object.values(styles).map((s) => s.rows));
  // todas as frentes primeiro: fundos de uma rua não roubam a testada de outra
  for (let row = 0; row < maxRows; row++) {
    for (const edge of city.edges) {
      const district = edgeDistricts[edge.id];
      if (edge.bridge || row >= styles[district].rows) continue;
      for (const side of [1, -1]) fillSide(ctx, edge, side, row, district, rng);
    }
  }
  return ctx.lots;
}

function createContext(city, river, cfg) {
  const cell = cfg.lots.cellSize;
  const maxRadius = Math.max(...city.nodes.map((n) => n.radius));
  const ctx = {
    city, river, cfg, cell,
    lots: [],
    boxes: [], // retângulos internos, com eixos, na mesma ordem de `lots`
    lotCells: new Map(),
    edgeCells: new Map(),
    stamp: new Int32Array(city.edges.length),
    tick: 0,
    centro: { x: cfg.centro.center.x * cfg.size, z: cfg.centro.center.z * cfg.size, radius: cfg.centro.radius * cfg.size },
  };
  const reach = maxRadius + cfg.sidewalk;
  for (const edge of city.edges) {
    const a = city.nodes[edge.a];
    const b = city.nodes[edge.b];
    forCells(ctx, Math.min(a.x, b.x) - reach, Math.min(a.z, b.z) - reach, Math.max(a.x, b.x) + reach, Math.max(a.z, b.z) + reach, (key) =>
      bucket(ctx.edgeCells, key).push(edge),
    );
  }
  return ctx;
}

function bucket(map, key) {
  let list = map.get(key);
  if (!list) map.set(key, (list = []));
  return list;
}

function forCells(ctx, minX, minZ, maxX, maxZ, visit) {
  const c = ctx.cell;
  for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++) {
    for (let j = Math.floor(minZ / c); j <= Math.floor(maxZ / c); j++) visit(i * 4096 + j);
  }
}

/** Anda ao longo de um lado da rua encaixando lotes; onde não cabe, avança um passo e tenta de novo. */
function fillSide(ctx, edge, side, row, district, rng) {
  const { city, cfg } = ctx;
  const style = cfg.lots.districts[district];
  const setback = edge.halfWidth + cfg.sidewalk + cfg.lots.setback + row * (style.rowDepth + cfg.lots.rowGap);
  const end = edge.length - city.nodes[edge.b].radius - cfg.sidewalk;
  let s = city.nodes[edge.a].radius + cfg.sidewalk;
  while (s < end) {
    const box = fitLot(ctx, edge, side, s, end, setback, row, style, rng);
    if (!box) {
      s += cfg.lots.step;
      continue;
    }
    commitLot(ctx, box, district, rng);
    s += box.w + style.gap;
  }
}

/** Tenta o tipo sorteado no tamanho sorteado; se não couber, o tipo principal no tamanho mínimo. */
function fitLot(ctx, edge, side, s, end, setback, row, style, rng) {
  const main = style.kinds[0];
  const kind = pickKind(ctx, edge, s, row, style, rng);
  const options = [
    { kind: kind.kind, w: sizeIn(kind.w, rng), d: sizeIn(kind.d, rng) },
    { kind: main.kind, w: main.w[0], d: main.d[0] },
  ];
  for (const option of options) {
    if (s + option.w > end) continue;
    const box = lotBox(ctx.city, edge, side, s, setback, option);
    if (lotFits(ctx, box)) return box;
  }
  return null;
}

const sizeIn = ([min, max], rng) => Math.round(rng.range(min, max) * 10) / 10;

function pickKind(ctx, edge, s, row, style, rng) {
  const a = ctx.city.nodes[edge.a];
  const centrality = Math.max(0, 1 - Math.hypot(a.x + edge.dir.x * s - ctx.centro.x, a.z + edge.dir.z * s - ctx.centro.z) / ctx.centro.radius);
  let roll = rng.next();
  for (const kind of style.kinds) {
    if (kind.frontOnly && row > 0) continue;
    roll -= kind.core ? kind.share * 2 * centrality : kind.share;
    if (roll < 0) return kind;
  }
  return style.kinds[0];
}

/** Retângulo com eixos: `u` ao longo da rua (frente `w`), `v` para dentro do quarteirão (profundidade `d`). */
function lotBox(city, edge, side, s, setback, { kind, w, d }) {
  const a = city.nodes[edge.a];
  const vx = -edge.dir.z * side;
  const vz = edge.dir.x * side;
  const along = s + w / 2;
  const out = setback + d / 2;
  return {
    kind, w, d,
    x: a.x + edge.dir.x * along + vx * out,
    z: a.z + edge.dir.z * along + vz * out,
    ux: edge.dir.x, uz: edge.dir.z, vx, vz,
  };
}

function commitLot(ctx, box, district, rng) {
  const index = ctx.boxes.length;
  ctx.boxes.push(box);
  bucket(ctx.lotCells, Math.floor(box.x / ctx.cell) * 4096 + Math.floor(box.z / ctx.cell)).push(index);
  ctx.lots.push({
    x: round2(box.x), z: round2(box.z), w: box.w, d: box.d,
    heading: Math.round(Math.atan2(-box.vz, -box.vx) * 1e4) / 1e4, // a fachada olha de volta para a rua
    district, kind: box.kind, seed: rng.int(0, 0x7fffffff),
  });
}

/* ---------- testes de encaixe ---------- */

const lotFits = (ctx, box) => insideMap(ctx, box) && clearOfLots(ctx, box) && clearOfRoads(ctx, box) && clearOfRiver(ctx, box);

const corners = (b) =>
  [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => ({
    x: b.x + (b.ux * b.w * i + b.vx * b.d * j) / 2,
    z: b.z + (b.uz * b.w * i + b.vz * b.d * j) / 2,
  }));

function insideMap(ctx, box) {
  const limit = ctx.cfg.size / 2 - ctx.cfg.lots.mapBorder;
  return corners(box).every((p) => Math.abs(p.x) <= limit && Math.abs(p.z) <= limit);
}

function clearOfLots(ctx, box) {
  const ci = Math.floor(box.x / ctx.cell);
  const cj = Math.floor(box.z / ctx.cell);
  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 1; j <= cj + 1; j++) {
      const list = ctx.lotCells.get(i * 4096 + j);
      if (list && list.some((index) => boxesOverlap(box, ctx.boxes[index], ctx.cfg.lots.minGap))) return false;
    }
  }
  return true;
}

/** Teste dos eixos separadores entre dois retângulos orientados, exigindo `gap` de folga. */
function boxesOverlap(p, q, gap) {
  const dx = q.x - p.x;
  const dz = q.z - p.z;
  for (const [ax, az] of [[p.ux, p.uz], [p.vx, p.vz], [q.ux, q.uz], [q.vx, q.vz]]) {
    const reach = (b) => (Math.abs(b.ux * ax + b.uz * az) * b.w + Math.abs(b.vx * ax + b.vz * az) * b.d) / 2;
    if (Math.abs(dx * ax + dz * az) > reach(p) + reach(q) + gap) return false;
  }
  return true;
}

function clearOfRoads(ctx, box) {
  const { city, cfg } = ctx;
  const reach = Math.hypot(box.w, box.d) / 2;
  const tick = ++ctx.tick;
  let clear = true;
  forCells(ctx, box.x - reach, box.z - reach, box.x + reach, box.z + reach, (key) => {
    const list = ctx.edgeCells.get(key);
    if (!clear || !list) return;
    for (const edge of list) {
      if (ctx.stamp[edge.id] === tick) continue;
      ctx.stamp[edge.id] = tick;
      const a = toLocal(box, city.nodes[edge.a]);
      const b = toLocal(box, city.nodes[edge.b]);
      const hw = box.w / 2;
      const hd = box.d / 2;
      if (
        segmentBoxDistance(a, b, hw, hd) < edge.halfWidth + cfg.sidewalk - EPS ||
        pointBoxDistance(a.x, a.z, hw, hd) < city.nodes[edge.a].radius + cfg.sidewalk - EPS ||
        pointBoxDistance(b.x, b.z, hw, hd) < city.nodes[edge.b].radius + cfg.sidewalk - EPS
      ) {
        clear = false;
        return;
      }
    }
  });
  return clear;
}

const toLocal = (box, p) => ({
  x: (p.x - box.x) * box.ux + (p.z - box.z) * box.uz,
  z: (p.x - box.x) * box.vx + (p.z - box.z) * box.vz,
});

const pointBoxDistance = (x, z, hw, hd) => Math.hypot(Math.max(Math.abs(x) - hw, 0), Math.max(Math.abs(z) - hd, 0));

/** Distância de um segmento (em coordenadas do lote) ao retângulo [-hw,hw]×[-hd,hd]. */
function segmentBoxDistance(a, b, hw, hd) {
  if (segmentHitsBox(a, b, hw, hd)) return 0;
  let best = Math.min(pointBoxDistance(a.x, a.z, hw, hd), pointBoxDistance(b.x, b.z, hw, hd));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  for (const [cx, cz] of [[hw, hd], [hw, -hd], [-hw, -hd], [-hw, hd]]) {
    const t = Math.min(1, Math.max(0, ((cx - a.x) * dx + (cz - a.z) * dz) / len2));
    best = Math.min(best, Math.hypot(cx - a.x - dx * t, cz - a.z - dz * t));
  }
  return best;
}

/** Recorte de Liang–Barsky: o segmento passa por dentro do retângulo? */
function segmentHitsBox(a, b, hw, hd) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [[-dx, a.x + hw], [dx, hw - a.x], [-dz, a.z + hd], [dz, hd - a.z]]) {
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

function clearOfRiver(ctx, box) {
  const { river, cfg } = ctx;
  const limit = river.width / 2 + cfg.lots.riverBank;
  if (river.line.distance(box) > limit + Math.hypot(box.w, box.d) / 2) return true;
  const cs = corners(box);
  const mids = cs.map((c, i) => ({ x: (c.x + cs[(i + 1) % 4].x) / 2, z: (c.z + cs[(i + 1) % 4].z) / 2 }));
  return cs.concat(mids).every((p) => river.line.distance(p) >= limit);
}
