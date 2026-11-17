/**
 * Consultas sobre a malha viária: em que rua estou, por onde chego lá, que ponto é esse da via.
 * Não altera a cidade. `nearestEdge` e `pointOnEdge` aceitam um objeto de saída para não alocar por frame.
 */
import { closestT } from './geometry.js';

const CELL = 80;

export function createGraph(city) {
  const { nodes, edges } = city;
  const half = city.size / 2;
  const cellsPerSide = Math.ceil(city.size / CELL) + 2;
  const cells = Array.from({ length: cellsPerSide * cellsPerSide }, () => []);
  const cellIndex = (value) => Math.min(Math.max(Math.floor((value + half) / CELL) + 1, 0), cellsPerSide - 1);

  for (const edge of edges) {
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    for (let i = cellIndex(Math.min(a.x, b.x)); i <= cellIndex(Math.max(a.x, b.x)); i++) {
      for (let j = cellIndex(Math.min(a.z, b.z)); j <= cellIndex(Math.max(a.z, b.z)); j++) cells[i * cellsPerSide + j].push(edge.id);
    }
  }

  // Cada consulta ganha um carimbo; aresta já carimbada não é medida de novo.
  const stamps = new Int32Array(edges.length);
  let stamp = 0;

  /** Via mais próxima de (x, z): id da aresta, posição `t` nela, distância ao eixo e lado (1 = direita de a→b). */
  function nearestEdge(x, z, out = {}) {
    stamp++;
    let bestDist = Infinity;
    let bestEdge = -1;
    let bestT = 0;
    const ci = cellIndex(x);
    const cj = cellIndex(z);
    for (let ring = 0; ring < cellsPerSide; ring++) {
      for (let i = ci - ring; i <= ci + ring; i++) {
        if (i < 0 || i >= cellsPerSide) continue;
        for (let j = cj - ring; j <= cj + ring; j++) {
          if (j < 0 || j >= cellsPerSide) continue;
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== ring) continue;
          const bucket = cells[i * cellsPerSide + j];
          for (let k = 0; k < bucket.length; k++) {
            const id = bucket[k];
            if (stamps[id] === stamp) continue;
            stamps[id] = stamp;
            const a = nodes[edges[id].a];
            const b = nodes[edges[id].b];
            const t = closestT(x, z, a.x, a.z, b.x, b.z);
            const dist = Math.hypot(x - (a.x + (b.x - a.x) * t), z - (a.z + (b.z - a.z) * t));
            if (dist < bestDist) {
              bestDist = dist;
              bestEdge = id;
              bestT = t;
            }
          }
        }
      }
      // Tudo a até `ring` células do ponto já foi visto: nada mais longe pode ganhar.
      if (bestDist <= ring * CELL) break;
    }
    const edge = edges[bestEdge];
    const a = nodes[edge.a];
    const cross = edge.dir.x * (z - a.z) - edge.dir.z * (x - a.x);
    out.edge = bestEdge;
    out.t = bestT;
    out.dist = bestDist;
    out.side = cross >= 0 ? 1 : -1;
    return out;
  }

  /** Ponto da via em `t` (0 em a, 1 em b), deslocado `lateral` metros para a direita de a→b. */
  function pointOnEdge(edgeId, t, lateral = 0, out = {}) {
    const edge = edges[edgeId];
    const a = nodes[edge.a];
    const along = t * edge.length;
    out.x = a.x + edge.dir.x * along - edge.dir.z * lateral;
    out.z = a.z + edge.dir.z * along + edge.dir.x * lateral;
    return out;
  }

  /** Ponto do eixo da via mais próximo de (x, z): posição `t` nela e distância. */
  function projectOnEdge(edgeId, x, z, out = {}) {
    const a = nodes[edges[edgeId].a];
    const b = nodes[edges[edgeId].b];
    out.t = closestT(x, z, a.x, a.z, b.x, b.z);
    out.dist = Math.hypot(x - (a.x + (b.x - a.x) * out.t), z - (a.z + (b.z - a.z) * out.t));
    return out;
  }

  // Para cada via, as outras que saem dos mesmos dois cruzamentos.
  const neighbours = edges.map((edge) => [...new Set([...nodes[edge.a].edges, ...nodes[edge.b].edges])].filter((id) => id !== edge.id));
  const nearbyEdges = (edgeId) => neighbours[edgeId];

  const canTravel = (edgeId, fromNodeId) => !edges[edgeId].oneWay || edges[edgeId].a === fromNodeId;
  const otherEnd = (edgeId, nodeId) => (edges[edgeId].a === nodeId ? edges[edgeId].b : edges[edgeId].a);

  // Estado do A*, reaproveitado entre chamadas.
  const cost = new Float64Array(nodes.length);
  const cameFrom = new Int32Array(nodes.length);
  const viaEdge = new Int32Array(nodes.length);
  const heap = createHeap();

  /**
   * Menor caminho de um ponto de uma via a outro, respeitando mão única.
   * `steps` lista as vias na ordem, com `forward` = percorrida no sentido a→b.
   */
  function route(from, to) {
    const first = edges[from.edge];
    const last = edges[to.edge];
    const target = pointOnEdge(to.edge, to.t);
    const origin = pointOnEdge(from.edge, from.t);

    let best = Infinity;
    let bestEnd = -1; // nó por onde se entra na via de destino; -2 = sem sair da via de origem
    if (from.edge === to.edge && (to.t >= from.t || !first.oneWay)) {
      best = Math.abs(to.t - from.t) * first.length;
      bestEnd = -2;
    }

    cost.fill(Infinity);
    heap.clear();
    const estimate = (id) => Math.hypot(nodes[id].x - target.x, nodes[id].z - target.z);
    const visit = (id, value, previous, edgeId) => {
      if (value >= cost[id]) return;
      cost[id] = value;
      cameFrom[id] = previous;
      viaEdge[id] = edgeId;
      heap.push(id, value + estimate(id));
    };
    visit(first.b, (1 - from.t) * first.length, -1, first.id);
    if (!first.oneWay) visit(first.a, from.t * first.length, -1, first.id);

    while (heap.size() > 0) {
      const { id, priority } = heap.pop();
      if (priority >= best) break;
      if (priority > cost[id] + estimate(id) + 1e-9) continue; // entrada velha na fila
      if (id === last.a && cost[id] + to.t * last.length < best) {
        best = cost[id] + to.t * last.length;
        bestEnd = id;
      }
      if (id === last.b && !last.oneWay && cost[id] + (1 - to.t) * last.length < best) {
        best = cost[id] + (1 - to.t) * last.length;
        bestEnd = id;
      }
      for (const edgeId of nodes[id].edges) {
        if (canTravel(edgeId, id)) visit(otherEnd(edgeId, id), cost[id] + edges[edgeId].length, id, edgeId);
      }
    }
    if (best === Infinity) return null;
    if (bestEnd === -2) return { points: [origin, target], steps: [{ edge: first.id, forward: to.t >= from.t }], length: best };

    const points = [target];
    const steps = [{ edge: last.id, forward: bestEnd === last.a }];
    for (let id = bestEnd; id !== -1; id = cameFrom[id]) {
      points.push({ x: nodes[id].x, z: nodes[id].z });
      const edge = edges[viaEdge[id]];
      steps.push({ edge: edge.id, forward: edge.b === id });
    }
    points.push(origin);
    return { points: points.reverse(), steps: steps.reverse(), length: best };
  }

  return { nearestEdge, projectOnEdge, nearbyEdges, route, canTravel, otherEnd, pointOnEdge };
}

/** Fila de prioridade mínima (heap binário) de pares (id, prioridade). */
function createHeap() {
  const ids = [];
  const priorities = [];
  const swap = (i, j) => {
    [ids[i], ids[j]] = [ids[j], ids[i]];
    [priorities[i], priorities[j]] = [priorities[j], priorities[i]];
  };
  return {
    size: () => ids.length,
    clear() {
      ids.length = 0;
      priorities.length = 0;
    },
    push(id, priority) {
      let i = ids.push(id) - 1;
      priorities.push(priority);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (priorities[parent] <= priorities[i]) break;
        swap(i, parent);
        i = parent;
      }
    },
    pop() {
      const top = { id: ids[0], priority: priorities[0] };
      const lastId = ids.pop();
      const lastPriority = priorities.pop();
      if (ids.length > 0) {
        ids[0] = lastId;
        priorities[0] = lastPriority;
        let i = 0;
        for (;;) {
          const left = 2 * i + 1;
          const right = left + 1;
          let smallest = i;
          if (left < ids.length && priorities[left] < priorities[smallest]) smallest = left;
          if (right < ids.length && priorities[right] < priorities[smallest]) smallest = right;
          if (smallest === i) break;
          swap(i, smallest);
          i = smallest;
        }
      }
      return top;
    },
  };
}
