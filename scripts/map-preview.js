/**
 * Desenha o mapa gerado em `dev/map-preview.svg` para inspeção visual.
 * Uso: `node scripts/map-preview.js [seed]` (sem seed, usa a de `config.js`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { generateCity } from '../src/sim/city/generator.js';

const LOT_COLORS = { predio: '#8f9bb3', 'arranha-ceu': '#4b5a7a', casa: '#e0a96d', galpao: '#9a8f86', praca: '#7fbf7a' };
const POI_COLORS = { restaurante: '#e5383b', cliente: '#1d6fd8', casa: '#f6c90e' };

const seed = Number(process.argv[2] ?? config.seed);
const started = performance.now();
const city = generateCity(config.city, createRng(seed).fork('cidade'));
const elapsed = performance.now() - started;

const f = (v) => v.toFixed(1);
const half = city.size / 2;
const P = (id) => city.nodes[id];

function riverSvg() {
  const d = city.river.points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.z)}`).join('');
  return `<path d="${d}" fill="none" stroke="#6db3d6" stroke-width="${city.river.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function lotSvg(lot) {
  const deg = (lot.heading * 180) / Math.PI;
  // no referencial do lote, +x é a direção da fachada: profundidade em x, frente em y; a faixa escura marca a fachada
  return (
    `<g transform="translate(${f(lot.x)} ${f(lot.z)}) rotate(${f(deg)})">` +
    `<rect x="${f(-lot.d / 2)}" y="${f(-lot.w / 2)}" width="${f(lot.d)}" height="${f(lot.w)}" fill="${LOT_COLORS[lot.kind]}"/>` +
    `<rect x="${f(lot.d / 2 - 1.5)}" y="${f(-lot.w / 2)}" width="1.5" height="${f(lot.w)}" fill="#0003"/></g>`
  );
}

function edgeSvg(edge, color, extra = 0) {
  const a = P(edge.a);
  const b = P(edge.b);
  return `<line x1="${f(a.x)}" y1="${f(a.z)}" x2="${f(b.x)}" y2="${f(b.z)}" stroke="${color}" stroke-width="${f(edge.halfWidth * 2 + extra)}" stroke-linecap="round"/>`;
}

function arrowSvg(edge) {
  const a = P(edge.a);
  const mx = a.x + edge.dir.x * edge.length * 0.5;
  const mz = a.z + edge.dir.z * edge.length * 0.5;
  const deg = (Math.atan2(edge.dir.z, edge.dir.x) * 180) / Math.PI;
  return `<path d="M-7 -3.2 L5 0 L-7 3.2 Z" fill="#ffd166" transform="translate(${f(mx)} ${f(mz)}) rotate(${f(deg)})"/>`;
}

function nodeSvg(node) {
  if (node.edges.length === 1) return `<circle cx="${f(node.x)}" cy="${f(node.z)}" r="${node.radius}" fill="#3d4250"/>`;
  return node.signal ? `<circle cx="${f(node.x)}" cy="${f(node.z)}" r="3.4" fill="#2bd66a" stroke="#0b3d1c" stroke-width="1"/>` : '';
}

function poiSvg(poi) {
  const r = poi.type === 'cliente' ? 4.5 : 7;
  return `<circle cx="${f(poi.x)}" cy="${f(poi.z)}" r="${r}" fill="${POI_COLORS[poi.type]}" stroke="#fff" stroke-width="1.5"><title>${poi.name}</title></circle>`;
}

function legendSvg() {
  const items = [
    ...Object.entries(LOT_COLORS).map(([k, c]) => [k, c]),
    ...Object.entries(POI_COLORS).map(([k, c]) => [`POI ${k}`, c]),
    ['semáforo', '#2bd66a'], ['ponte', '#c1440e'], ['avenida', '#23262f'], ['mão única', '#ffd166'],
  ];
  const rows = items.map(([label, color], i) =>
    `<rect x="${-half + 14}" y="${-half + 14 + i * 22}" width="16" height="16" fill="${color}"/>` +
    `<text x="${-half + 36}" y="${-half + 27 + i * 22}" font-size="15" font-family="sans-serif" fill="#111">${label}</text>`,
  );
  return `<rect x="${-half + 6}" y="${-half + 6}" width="150" height="${items.length * 22 + 12}" fill="#fffc"/>${rows.join('')}`;
}

const streets = city.edges.filter((e) => e.kind === 'rua' && !e.bridge);
const avenues = city.edges.filter((e) => e.kind === 'avenida' && !e.bridge);
const bridges = city.edges.filter((e) => e.bridge);
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${city.size} ${city.size}" width="100%" height="100%">`,
  `<rect x="${-half}" y="${-half}" width="${city.size}" height="${city.size}" fill="#e9e4d8"/>`,
  riverSvg(),
  ...city.lots.map(lotSvg),
  ...streets.map((e) => edgeSvg(e, '#5b6170')),
  ...avenues.map((e) => edgeSvg(e, '#23262f')),
  ...bridges.map((e) => edgeSvg(e, '#c1440e', 4)),
  ...city.edges.filter((e) => e.oneWay).map(arrowSvg),
  ...city.nodes.map(nodeSvg),
  ...city.pois.map(poiSvg),
  legendSvg(),
  '</svg>',
].join('\n');

mkdirSync(new URL('../dev/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dev/map-preview.svg', import.meta.url), svg);

const count = (list, key) => list.reduce((acc, item) => ((acc[key(item)] = (acc[key(item)] ?? 0) + 1), acc), {});
console.log(`seed ${seed}: gerada em ${elapsed.toFixed(0)} ms → dev/map-preview.svg`);
console.log({
  nós: city.nodes.length,
  arestas: city.edges.length,
  grauMédio: +((2 * city.edges.length) / city.nodes.length).toFixed(2),
  becos: city.nodes.filter((n) => n.edges.length === 1).length,
  semáforos: city.nodes.filter((n) => n.signal).length,
  mãoÚnica: city.edges.filter((e) => e.oneWay).length,
  nósPorDistrito: count(city.nodes, (n) => n.district),
  pontes: bridges.map((e) => e.name),
  avenidas: [...new Set(avenues.map((e) => e.name))],
  pois: count(city.pois, (p) => p.type),
  lotes: city.lots.length,
  lotesPorTipo: count(city.lots, (l) => l.kind),
});
