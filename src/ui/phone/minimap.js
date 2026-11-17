/**
 * Minimapa GPS em canvas 2D.
 * O mapa GIRA com a moto (frente sempre para cima): "vire à esquerda" é esquerda na tela,
 * que é o que se consegue ler num relance enquanto pilota. O jogador fica no terço de baixo
 * para sobrar mapa à frente. Um "N" no canto mostra onde ficou o norte.
 */

// Espelham src/ui/tokens.css (canvas não lê variáveis CSS sem custo por frame).
const COLOR = {
  ground: '#151722',
  river: '#1d3b63',
  riverEdge: '#2a5288',
  street: '#343849',
  avenue: '#565c78',
  routeCasing: '#0b0c11',
  route: '#c8ff2e',
  player: '#c8ff2e',
  ink: '#0b0c11',
  paper: '#f5f6ee',
  pickup: '#ffb627',
  dropoff: '#ff5a4e',
  faint: 'rgba(236, 238, 244, 0.55)',
};

const PLAYER_Y = 0.68; // fração da altura onde fica o jogador
const DEFAULT_SPAN = 320; // metros visíveis na largura quando `zoom` não é dado

/** Ângulo que leva a direção `heading` do mundo para "cima" na tela. */
const mapRotation = (heading) => -Math.PI / 2 - heading;

/** Mundo → pixels do canvas (CSS px). Exportada para o teste da página de dev. */
export function projectToMinimap(point, bike, zoom, width, height) {
  const rot = mapRotation(bike.heading || 0);
  const dx = point.x - bike.x;
  const dz = point.z - bike.z;
  return {
    x: width / 2 + zoom * (dx * Math.cos(rot) - dz * Math.sin(rot)),
    y: height * PLAYER_Y + zoom * (dx * Math.sin(rot) + dz * Math.cos(rot)),
  };
}

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  return { dpr, width, height };
}

function strokePolyline(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].z);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].z);
  ctx.stroke();
}

function drawRiver(ctx, river) {
  if (!river?.points?.length) return;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = COLOR.riverEdge;
  ctx.lineWidth = river.width + 6;
  strokePolyline(ctx, river.points);
  ctx.strokeStyle = COLOR.river;
  ctx.lineWidth = river.width;
  strokePolyline(ctx, river.points);
}

/** Um `stroke` por tipo de via; só entram as arestas perto do jogador. */
function drawEdges(ctx, city, bike, reach, kind, color, minWidth) {
  const { nodes, edges } = city;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  let width = minWidth;
  ctx.beginPath();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if ((edge.kind === 'avenida') !== (kind === 'avenida')) continue;
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    if (!a || !b) continue;
    const far = reach + (edge.length || 0) / 2;
    const mx = (a.x + b.x) / 2 - bike.x;
    const mz = (a.z + b.z) / 2 - bike.z;
    if (mx * mx + mz * mz > far * far) continue;
    if (edge.halfWidth * 2 > width) width = edge.halfWidth * 2;
    ctx.moveTo(a.x, a.z);
    ctx.lineTo(b.x, b.z);
  }
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawRoute(ctx, route, zoom) {
  if (!route?.points || route.points.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR.routeCasing;
  ctx.lineWidth = 9 / zoom;
  strokePolyline(ctx, route.points);
  ctx.strokeStyle = COLOR.route;
  ctx.lineWidth = 5 / zoom;
  strokePolyline(ctx, route.points);
}

function drawPlayer(ctx, x, y, unit) {
  ctx.fillStyle = 'rgba(200, 255, 46, 0.16)';
  ctx.beginPath();
  ctx.arc(x, y, unit * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - unit * 1.25);
  ctx.lineTo(x + unit * 0.95, y + unit);
  ctx.lineTo(x, y + unit * 0.45);
  ctx.lineTo(x - unit * 0.95, y + unit);
  ctx.closePath();
  ctx.fillStyle = COLOR.player;
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = unit * 0.32;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
}

/** Pino no destino; se o destino está fora do quadro, vira um marcador preso na borda. */
function drawTarget(ctx, target, bike, zoom, width, height, unit) {
  const p = projectToMinimap(target, bike, zoom, width, height);
  const color = target.type === 'restaurante' ? COLOR.pickup : COLOR.dropoff;
  const pad = unit * 1.8;
  const inside = p.x > pad && p.x < width - pad && p.y > pad && p.y < height - pad;

  if (!inside) {
    const cx = width / 2;
    const cy = height * PLAYER_Y;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const scale = Math.min(
      dx > 0 ? (width - pad - cx) / dx : dx < 0 ? (pad - cx) / dx : Infinity,
      dy > 0 ? (height - pad - cy) / dy : dy < 0 ? (pad - cy) / dy : Infinity,
    );
    const ex = cx + dx * scale;
    const ey = cy + dy * scale;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.beginPath();
    ctx.moveTo(unit * 1.2, 0);
    ctx.lineTo(-unit * 0.5, -unit * 0.85);
    ctx.lineTo(-unit * 0.5, unit * 0.85);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = unit * 0.3;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    return;
  }

  const r = unit * 0.95;
  const headY = p.y - unit * 2.1;
  ctx.fillStyle = 'rgba(11, 12, 17, 0.45)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, unit * 0.7, unit * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.quadraticCurveTo(p.x - r * 1.05, headY + r * 0.9, p.x - r, headY);
  ctx.arc(p.x, headY, r, Math.PI, 0);
  ctx.quadraticCurveTo(p.x + r * 1.05, headY + r * 0.9, p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = unit * 0.3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.beginPath();
  ctx.arc(p.x, headY, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawNorth(ctx, heading, width, unit) {
  const x = width - unit * 2;
  const y = unit * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(11, 12, 17, 0.7)';
  ctx.beginPath();
  ctx.arc(0, 0, unit * 1.25, 0, Math.PI * 2);
  ctx.fill();
  // norte do mundo = -z; no quadro ele aponta para onde a rotação do mapa mandar
  ctx.rotate(mapRotation(heading));
  ctx.fillStyle = COLOR.dropoff;
  ctx.beginPath();
  ctx.moveTo(0, -unit * 0.95);
  ctx.lineTo(unit * 0.38, 0);
  ctx.lineTo(-unit * 0.38, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLOR.faint;
  ctx.beginPath();
  ctx.moveTo(0, unit * 0.95);
  ctx.lineTo(unit * 0.38, 0);
  ctx.lineTo(-unit * 0.38, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ city?: object, bike?: {x,z,heading}, route?: {points:[{x,z}]}, target?: {x,z,type}, zoom?: number }} view
 *   `zoom` em px (CSS) por metro; padrão: 320 m visíveis na largura.
 */
export function drawMinimap(canvas, { city, bike, route, target, zoom } = {}) {
  const { dpr, width, height } = fitCanvas(canvas);
  if (!width || !height) return;
  const ctx = canvas.getContext('2d');
  const scale = zoom || width / DEFAULT_SPAN;
  const unit = Math.max(6, width / 34); // tamanho-base dos símbolos, em px

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLOR.ground;
  ctx.fillRect(0, 0, width, height);
  if (!bike) return;

  const heading = bike.heading || 0;
  const cx = width / 2;
  const cy = height * PLAYER_Y;

  if (city?.edges && city?.nodes) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mapRotation(heading));
    ctx.scale(scale, scale);
    ctx.translate(-bike.x, -bike.z);
    const reach = Math.hypot(width, height) / scale;
    drawRiver(ctx, city.river);
    drawEdges(ctx, city, bike, reach, 'rua', COLOR.street, 5 / scale);
    drawEdges(ctx, city, bike, reach, 'avenida', COLOR.avenue, 9 / scale);
    drawRoute(ctx, route, scale);
    ctx.restore();
  }

  if (target) drawTarget(ctx, target, bike, scale, width, height, unit);
  drawPlayer(ctx, cx, cy, unit);
  drawNorth(ctx, heading, width, unit);
}
