/**
 * Semáforos. Cada nó sinalizado alterna duas fases (A e B) de aproximações mais ou menos opostas.
 * Ciclo: A verde → amarelo → tudo vermelho → B verde → amarelo → tudo vermelho.
 * O estado é calculado na hora a partir do relógio: `step` não percorre nós e nada aloca.
 */
const NONE = -1;

export function createSignals(city, cfg) {
  const yellowEnd = cfg.green + cfg.yellow;
  const half = yellowEnd + cfg.allRed;
  const cycle = 2 * half;
  const phases = new Int8Array(city.edges.length * 2).fill(NONE); // [aresta × 2 + ponta] → fase 0 (A) ou 1 (B)
  const offsets = new Float64Array(city.nodes.length);
  const heads = [];
  let time = 0;

  for (const node of city.nodes) if (node.signal && node.edges.length) setupNode(node);

  /** Posição de (nó, aresta) em `phases`, ou NONE se a aresta não incide no nó. */
  function slot(nodeId, edgeId) {
    const edge = city.edges[edgeId];
    if (!edge) return NONE;
    if (edge.a === nodeId) return edgeId * 2;
    if (edge.b === nodeId) return edgeId * 2 + 1;
    return NONE;
  }

  function setupNode(node) {
    offsets[node.id] = ((node.id * cfg.offsetStep) % 1) * cycle; // derivado do id: determinístico, sem rng
    const axis = mainAxis(node);
    for (const edgeId of node.edges) {
      const { dir } = city.edges[edgeId];
      const along = Math.abs(dir.x * axis.x + dir.z * axis.z);
      const across = Math.abs(dir.x * axis.z - dir.z * axis.x);
      phases[slot(node.id, edgeId)] = along >= across ? 0 : 1; // mais alinhada ao eixo que atravessada = fase A
      heads.push({ nodeId: node.id, edgeId });
    }
  }

  /** Eixo da fase A: a direção de uma das duas aproximações mais opostas entre si (num T, o par alinhado). */
  function mainAxis(node) {
    let axis = city.edges[node.edges[0]].dir;
    let lowest = Infinity;
    for (const i of node.edges) {
      for (const j of node.edges) {
        const dot = outwardDot(node.id, city.edges[i], city.edges[j]);
        if (dot < lowest) {
          lowest = dot;
          axis = city.edges[i].dir;
        }
      }
    }
    return axis;
  }

  /** Produto escalar das direções das duas arestas saindo do nó (−1 = opostas). */
  function outwardDot(nodeId, e, f) {
    const sign = (e.a === nodeId ? 1 : -1) * (f.a === nodeId ? 1 : -1);
    return sign * (e.dir.x * f.dir.x + e.dir.z * f.dir.z);
  }

  /** Segundos desde que a fase abriu o verde, em [0, cycle). */
  function sinceGreen(nodeId, phase) {
    return (time + offsets[nodeId] + phase * half) % cycle;
  }

  function phaseOf(nodeId, edgeId) {
    const i = slot(nodeId, edgeId);
    return i === NONE ? NONE : phases[i];
  }

  return {
    /** Todas as aproximações sinalizadas (lista estática), para o render criar as luminárias. */
    heads,

    step(dt) {
      time = (time + dt) % cycle;
    },

    /** Estado para quem chega no nó `nodeId` vindo pela aresta `edgeId`; `null` se ali não há semáforo. */
    stateFor(nodeId, edgeId) {
      const phase = phaseOf(nodeId, edgeId);
      if (phase === NONE) return null;
      const t = sinceGreen(nodeId, phase);
      return t < cfg.green ? 'verde' : t < yellowEnd ? 'amarelo' : 'vermelho';
    },

    /** Segundos até o estado dessa aproximação mudar; `null` se ali não há semáforo. */
    timeToChange(nodeId, edgeId) {
      const phase = phaseOf(nodeId, edgeId);
      if (phase === NONE) return null;
      const t = sinceGreen(nodeId, phase);
      return (t < cfg.green ? cfg.green : t < yellowEnd ? yellowEnd : cycle) - t;
    },
  };
}
