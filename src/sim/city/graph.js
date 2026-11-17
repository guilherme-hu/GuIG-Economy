/**
 * Grafo de navegação sobre a cidade gerada: "em que rua estou?" (spatial hash) e rotas (A*).
 * Em todo lugar, `edge` é o id da aresta (índice em `city.edges`).
 */

/** Células por lado do spatial hash: ~50 m por célula numa cidade de 1600 m, perto de meio quarteirão. */
const CELLS_PER_SIDE = 32;

export function createGraph(city) {
  const { nodes, edges } = city;
  const hash = createEdgeHash(city);
  const search = createSearch(nodes.length + 1);
  const GOAL = nodes.length; // nó virtual: o ponto de chegada no meio de uma aresta

  const otherEnd = (edgeId, nodeId) => (edges[edgeId].a === nodeId ? edges[edgeId].b : edges[edgeId].a);
  const canTravel = (edgeId, fromNodeId) => !edges[edgeId].oneWay || edges[edgeId].a === fromNodeId;

  /** Ponto a `t` (0..1) de a para b, deslocado `lateral` metros para a direita de a→b. */
  function pointOnEdge(edgeId, t, lateral = 0) {
    const edge = edges[edgeId];
    const a = nodes[edge.a];
    const along = t * edge.length;
    return { x: a.x + edge.dir.x * along - edge.dir.z * lateral, z: a.z + edge.dir.z * along + edge.dir.x * lateral };
  }

  /**
   * Aresta mais próxima de (x, z): `{ edge, t, dist, side }`, com `dist` até o eixo e `side` = 1 à direita de a→b.
   * Passe `out` para reaproveitar o objeto de resultado em laços quentes.
   */
  function nearestEdge(x, z, out = {}) {
    const id = hash.nearest(x, z);
    const edge = edges[id];
    const a = nodes[edge.a];
    out.edge = id;
    out.t = hash.t;
    out.dist = Math.sqrt(hash.d2);
    out.side = edge.dir.x * (z - a.z) - edge.dir.z * (x - a.x) >= 0 ? 1 : -1;
    return out;
  }

  /** Rota mais curta entre dois pontos no meio de arestas, respeitando mão única; null se não existe. */
  function route(from, to) {
    return directRoute(from, to) ?? searchRoute(from, to);
  }

  /** Mesma aresta, com o destino à frente ou numa rua de mão dupla: é só seguir pelo eixo. */
  function directRoute(from, to) {
    if (from.edge !== to.edge) return null;
    const forward = to.t >= from.t;
    if (!forward && edges[from.edge].oneWay) return null;
    return {
      points: [pointOnEdge(from.edge, from.t), pointOnEdge(to.edge, to.t)],
      steps: [{ edge: from.edge, forward }],
      length: Math.abs(to.t - from.t) * edges[from.edge].length,
    };
  }

  function searchRoute(from, to) {
    const first = edges[from.edge];
    const last = edges[to.edge];
    const target = pointOnEdge(to.edge, to.t);
    const heuristic = (n) => (n === GOAL ? 0 : Math.hypot(nodes[n].x - target.x, nodes[n].z - target.z));
    search.reset();
    search.relax(first.b, (1 - from.t) * first.length, -1, from.edge, heuristic);
    if (!first.oneWay) search.relax(first.a, from.t * first.length, -1, from.edge, heuristic);

    for (let u = search.pop(); u >= 0 && u !== GOAL; u = search.pop()) {
      const g = search.cost[u];
      if (u === last.a) search.relax(GOAL, g + to.t * last.length, u, to.edge, heuristic);
      if (u === last.b && !last.oneWay) search.relax(GOAL, g + (1 - to.t) * last.length, u, to.edge, heuristic);
      for (const id of nodes[u].edges) {
        const edge = edges[id];
        if (edge.oneWay && edge.a !== u) continue;
        search.relax(edge.a === u ? edge.b : edge.a, g + edge.length, u, id, heuristic);
      }
    }
    return search.closed(GOAL) ? buildRoute(from, to) : null;
  }

  /** Volta do destino até a origem pelos predecessores e monta pontos e passos na ordem de viagem. */
  function buildRoute(from, to) {
    const points = [pointOnEdge(to.edge, to.t)];
    const steps = [];
    for (let n = GOAL; n >= 0; n = search.parent[n]) {
      const prev = search.parent[n];
      const edge = edges[search.via[n]];
      const arrivesAt = n === GOAL ? (prev === edge.a ? edge.b : edge.a) : n;
      steps.push({ edge: edge.id, forward: arrivesAt === edge.b });
      if (prev >= 0) points.push({ x: nodes[prev].x, z: nodes[prev].z });
    }
    points.push(pointOnEdge(from.edge, from.t));
    return { points: points.reverse(), steps: steps.reverse(), length: search.cost[GOAL] };
  }

  return { nearestEdge, route, canTravel, otherEnd, pointOnEdge };
}

/* ---------- spatial hash ---------- */

/** Grade uniforme sobre a caixa dos nós; cada célula lista as arestas cuja caixa a toca. */
function createEdgeHash(city) {
  const { nodes, edges } = city;
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minZ = Math.min(minZ, n.z);
    maxX = Math.max(maxX, n.x);
    maxZ = Math.max(maxZ, n.z);
  }
  const N = CELLS_PER_SIDE;
  const cell = Math.max(maxX - minX, maxZ - minZ, 1) / N;
  const cellOf = (v, min) => Math.min(N - 1, Math.max(0, Math.floor((v - min) / cell)));
  const buckets = Array.from({ length: N * N }, () => []);
  for (const edge of edges) {
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    for (let i = cellOf(Math.min(a.x, b.x), minX); i <= cellOf(Math.max(a.x, b.x), minX); i++) {
      for (let j = cellOf(Math.min(a.z, b.z), minZ); j <= cellOf(Math.max(a.z, b.z), minZ); j++) buckets[i * N + j].push(edge.id);
    }
  }

  const seen = new Int32Array(edges.length);
  let stamp = 0;
  let px = 0;
  let pz = 0;
  let best = -1;
  const self = { nearest, t: 0, d2: 0 };

  function scanCell(i, j) {
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const list = buckets[i * N + j];
    for (let k = 0; k < list.length; k++) {
      const id = list[k];
      if (seen[id] === stamp) continue;
      seen[id] = stamp;
      const edge = edges[id];
      const a = nodes[edge.a];
      let along = (px - a.x) * edge.dir.x + (pz - a.z) * edge.dir.z;
      along = along < 0 ? 0 : along > edge.length ? edge.length : along;
      const dx = px - a.x - edge.dir.x * along;
      const dz = pz - a.z - edge.dir.z * along;
      const d2 = dx * dx + dz * dz;
      if (d2 >= self.d2) continue;
      self.d2 = d2;
      self.t = along / edge.length;
      best = id;
    }
  }

  /** Quanto do entorno do ponto os anéis 0..ring já cobriram (lado encostado na borda da grade cobre tudo). */
  function covered(ci, cj, ring) {
    const left = ci - ring <= 0 ? Infinity : px - (minX + (ci - ring) * cell);
    const right = ci + ring >= N - 1 ? Infinity : minX + (ci + ring + 1) * cell - px;
    const top = cj - ring <= 0 ? Infinity : pz - (minZ + (cj - ring) * cell);
    const bottom = cj + ring >= N - 1 ? Infinity : minZ + (cj + ring + 1) * cell - pz;
    return Math.min(left, right, top, bottom);
  }

  /** Varre anéis de células em volta do ponto até nenhuma aresta de fora poder ganhar. Devolve o id. */
  function nearest(x, z) {
    px = x;
    pz = z;
    best = -1;
    self.d2 = Infinity;
    stamp++;
    const ci = cellOf(x, minX);
    const cj = cellOf(z, minZ);
    for (let ring = 0; ring < N; ring++) {
      for (let i = ci - ring; i <= ci + ring; i++) {
        scanCell(i, cj - ring);
        if (ring) scanCell(i, cj + ring);
      }
      for (let j = cj - ring + 1; j < cj + ring; j++) {
        scanCell(ci - ring, j);
        scanCell(ci + ring, j);
      }
      const reach = covered(ci, cj, ring);
      if (best >= 0 && self.d2 <= reach * reach) break;
    }
    return best;
  }

  return self;
}

/* ---------- A* ---------- */

/** Estado reutilizável do A* (custos, predecessores e heap binário), para não alocar a cada rota. */
function createSearch(size) {
  const cost = new Float64Array(size);
  const parent = new Int32Array(size);
  const via = new Int32Array(size);
  const state = new Int32Array(size); // == stamp: aberto; == stamp + 1: fechado
  const heapNode = [];
  const heapKey = [];
  let stamp = 0;

  function reset() {
    stamp += 2;
    heapNode.length = 0;
    heapKey.length = 0;
  }

  function relax(node, g, from, edgeId, heuristic) {
    if (state[node] === stamp + 1) return;
    if (state[node] === stamp && cost[node] <= g) return;
    state[node] = stamp;
    cost[node] = g;
    parent[node] = from;
    via[node] = edgeId;
    push(node, g + heuristic(node));
  }

  function push(node, key) {
    let i = heapNode.length;
    heapNode.push(node);
    heapKey.push(key);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (heapKey[up] <= key) break;
      heapNode[i] = heapNode[up];
      heapKey[i] = heapKey[up];
      i = up;
    }
    heapNode[i] = node;
    heapKey[i] = key;
  }

  /** Tira o nó aberto de menor custo estimado e o fecha; -1 quando acabou. Entradas velhas são puladas. */
  function pop() {
    while (heapNode.length) {
      const top = heapNode[0];
      const node = heapNode.pop();
      const key = heapKey.pop();
      if (heapNode.length) siftDown(node, key);
      if (state[top] === stamp + 1) continue;
      state[top] = stamp + 1;
      return top;
    }
    return -1;
  }

  function siftDown(node, key) {
    const n = heapNode.length;
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= n) break;
      if (child + 1 < n && heapKey[child + 1] < heapKey[child]) child++;
      if (heapKey[child] >= key) break;
      heapNode[i] = heapNode[child];
      heapKey[i] = heapKey[child];
      i = child;
    }
    heapNode[i] = node;
    heapKey[i] = key;
  }

  return { cost, parent, via, reset, relax, pop, closed: (node) => state[node] === stamp + 1 };
}
