/** Lotes: os retângulos ao longo das ruas onde a renderização vai pôr prédios, casas, galpões e praças. */
import { createPolyline, distance, rectsOverlap, segmentRectDistance } from './geometry.js';

const CELL = 64;

/** Índice espacial simples: guarda itens pelas células que a caixa deles cobre. */
function createBuckets() {
  const cells = new Map();
  const each = (minX, minZ, maxX, maxZ, visit) => {
    for (let i = Math.floor(minX / CELL); i <= Math.floor(maxX / CELL); i++) {
      for (let j = Math.floor(minZ / CELL); j <= Math.floor(maxZ / CELL); j++) visit(i * 4096 + j);
    }
  };
  return {
    add(item, minX, minZ, maxX, maxZ) {
      each(minX, minZ, maxX, maxZ, (key) => {
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
      });
    },
    query(minX, minZ, maxX, maxZ) {
      const found = new Set();
      each(minX, minZ, maxX, maxZ, (key) => cells.get(key)?.forEach((item) => found.add(item)));
      return found;
    },
  };
}

function corners(rect) {
  const cos = Math.cos(rect.heading);
  const sin = Math.sin(rect.heading);
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([su, sv]) => ({
    x: rect.x + su * rect.hu * cos - sv * rect.hv * sin,
    z: rect.z + su * rect.hu * sin + sv * rect.hv * cos,
  }));
}

export function generateLots(city, cfg, districtAt, rng) {
  const rules = cfg.lots;
  const river = createPolyline(city.river.points);
  const centro = { x: cfg.centro.x * cfg.size, z: cfg.centro.z * cfg.size, core: cfg.centro.radius * cfg.size * cfg.centro.core };
  const limit = cfg.size / 2 - 2;
  const roads = createBuckets();
  const placed = createBuckets();
  const lots = [];

  for (const edge of city.edges) {
    const a = city.nodes[edge.a];
    const b = city.nodes[edge.b];
    roads.add(edge, Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z));
  }

  function fits(rect) {
    const points = corners(rect);
    const reach = Math.hypot(rect.hu, rect.hv);
    if (points.some((p) => Math.abs(p.x) > limit || Math.abs(p.z) > limit)) return false;
    const dry = city.river.width / 2 + rules.riverMargin;
    if ([rect, ...points].some((p) => river.nearest(p.x, p.z).dist < dry)) return false;

    const pad = reach + 12;
    for (const road of roads.query(rect.x - pad, rect.z - pad, rect.x + pad, rect.z + pad)) {
      const a = city.nodes[road.a];
      const b = city.nodes[road.b];
      if (segmentRectDistance(a.x, a.z, b.x, b.z, rect) < road.halfWidth + cfg.sidewalk) return false;
    }
    for (const other of placed.query(rect.x - reach, rect.z - reach, rect.x + reach, rect.z + reach)) {
      if (rectsOverlap(rect, other)) return false;
    }
    return true;
  }

  function pickKind(district, x, z) {
    let roll = rng.next();
    let kind = 'predio';
    for (const [name, share] of Object.entries(rules.mix[district])) {
      kind = name;
      roll -= share;
      if (roll < 0) break;
    }
    const inCore = district === 'centro' && distance(x, z, centro.x, centro.z) < centro.core;
    return kind === 'predio' && inCore && rng.chance(rules.skyscraperShare) ? 'arranha-ceu' : kind;
  }

  function fillSide(edge, side) {
    const a = city.nodes[edge.a];
    const b = city.nodes[edge.b];
    const district = districtAt((a.x + b.x) / 2, (a.z + b.z) / 2);
    const end = edge.length - b.radius - 2;
    // Fachada virada para a rua: aponta do lote para o eixo da via.
    const heading = Math.atan2(-side * edge.dir.x, side * edge.dir.z);
    let s = a.radius + 2;

    while (s < end) {
      const kind = pickKind(district, a.x + edge.dir.x * s, a.z + edge.dir.z * s);
      const w = rng.range(...rules[kind].w);
      const d = rng.range(...rules[kind].d);
      if (s + w > end) break;
      const along = s + w / 2;
      const lateral = side * (edge.halfWidth + cfg.sidewalk + rules.setback + d / 2);
      const x = a.x + edge.dir.x * along - edge.dir.z * lateral;
      const z = a.z + edge.dir.z * along + edge.dir.x * lateral;
      const rect = { x, z, hu: d / 2, hv: w / 2, heading };
      if (!fits(rect)) {
        s += 6;
        continue;
      }
      const reach = Math.hypot(rect.hu, rect.hv);
      placed.add(rect, x - reach, z - reach, x + reach, z + reach);
      lots.push({ x: round(x), z: round(z), w: round(w), d: round(d), heading, district, kind, seed: rng.int(0, 0x7fffffff) });
      s += w + rng.range(...rules.gap);
    }
  }

  // Avenidas primeiro: a fachada delas tem prioridade sobre a das ruas que chegam de lado.
  const ordered = [...city.edges].sort((p, q) => (p.kind === q.kind ? p.id - q.id : p.kind === 'avenida' ? -1 : 1));
  for (const edge of ordered) {
    if (edge.bridge) continue;
    fillSide(edge, 1);
    fillSide(edge, -1);
  }
  return lots;
}

const round = (value) => Math.round(value * 100) / 100;
