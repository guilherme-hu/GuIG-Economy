import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignals } from '../src/sim/signals.js';
import { config } from '../src/config.js';

const cfg = config.signals;
const CYCLE = 2 * (cfg.green + cfg.yellow + cfg.allRed);
const DT = 0.05;
const STEPS_PER_CYCLE = Math.round(CYCLE / DT);

/**
 * Cidade-fixture:
 *             3      5
 *             |      |      nó 0: cruzamento em + (semáforo)
 *      2 ---- 0 ---- 1      nó 1: T (semáforo): pernas alinhadas 5–1–6, perna sozinha 0–1
 *      |      |      |      nó 2: sem semáforo
 *      7      4      6
 * Arestas com orientações a→b misturadas, para exercitar as duas pontas.
 */
function fixtureCity() {
  const at = [[0, 0], [100, 0], [-100, 0], [0, -100], [0, 100], [100, -100], [100, 100], [-100, 100]];
  const nodes = at.map(([x, z], id) => ({ id, x, z, edges: [], district: 'centro', signal: id < 2, radius: 8 }));
  const pairs = [[0, 1], [2, 0], [0, 3], [4, 0], [5, 1], [1, 6], [2, 7]];
  const edges = pairs.map(([a, b], id) => {
    const dx = nodes[b].x - nodes[a].x;
    const dz = nodes[b].z - nodes[a].z;
    const length = Math.hypot(dx, dz);
    nodes[a].edges.push(id);
    nodes[b].edges.push(id);
    return { id, a, b, length, dir: { x: dx / length, z: dz / length }, kind: 'rua', lanes: 1, oneWay: false };
  });
  return { size: 400, nodes, edges };
}

const PLUS = { node: 0, eastWest: [0, 1], northSouth: [2, 3] };
const TEE = { node: 1, aligned: [4, 5], lone: [0] };

const isOpen = (state) => state === 'verde' || state === 'amarelo';

test('signals: heads lista todas as aproximações sinalizadas', () => {
  const signals = createSignals(fixtureCity(), cfg);
  const keys = signals.heads.map((h) => `${h.nodeId}:${h.edgeId}`).sort();
  assert.deepEqual(keys, ['0:0', '0:1', '0:2', '0:3', '1:0', '1:4', '1:5']);
});

test('signals: nó sem semáforo ou aresta que não incide devolve null', () => {
  const signals = createSignals(fixtureCity(), cfg);
  assert.equal(signals.stateFor(2, 1), null); // nó sem semáforo
  assert.equal(signals.stateFor(2, 6), null);
  assert.equal(signals.stateFor(0, 4), null); // aresta não incide no nó
  assert.equal(signals.stateFor(0, 99), null); // aresta inexistente
  assert.equal(signals.timeToChange(2, 1), null);
  assert.notEqual(signals.stateFor(0, 1), null);
});

test('signals: aproximações opostas andam juntas; num T a perna sozinha tem fase própria', () => {
  const signals = createSignals(fixtureCity(), cfg);
  for (let i = 0; i < STEPS_PER_CYCLE; i++) {
    const [e, w] = PLUS.eastWest.map((id) => signals.stateFor(PLUS.node, id));
    const [n, s] = PLUS.northSouth.map((id) => signals.stateFor(PLUS.node, id));
    assert.equal(e, w);
    assert.equal(n, s);
    assert.ok(!(isOpen(e) && isOpen(n)), 'fases conflitantes abertas no +');

    const [up, down] = TEE.aligned.map((id) => signals.stateFor(TEE.node, id));
    const lone = signals.stateFor(TEE.node, TEE.lone[0]);
    assert.equal(up, down);
    assert.ok(!(isOpen(up) && isOpen(lone)), 'fases conflitantes abertas no T');
    signals.step(DT);
  }
});

test('signals: toda aproximação recebe verde em cada ciclo e as durações conferem com o config', () => {
  const signals = createSignals(fixtureCity(), cfg);
  const seconds = signals.heads.map(() => ({ verde: 0, amarelo: 0, vermelho: 0 }));
  for (let i = 0; i < STEPS_PER_CYCLE; i++) {
    signals.heads.forEach((h, k) => (seconds[k][signals.stateFor(h.nodeId, h.edgeId)] += DT));
    signals.step(DT);
  }
  const near = (a, b) => Math.abs(a - b) <= 2 * DT;
  for (const s of seconds) {
    assert.ok(near(s.verde, cfg.green), `verde ${s.verde}`);
    assert.ok(near(s.amarelo, cfg.yellow), `amarelo ${s.amarelo}`);
    assert.ok(near(s.vermelho, CYCLE - cfg.green - cfg.yellow), `vermelho ${s.vermelho}`);
  }
});

test('signals: ordem do ciclo é verde → amarelo → vermelho e há um tempo de tudo vermelho', () => {
  const signals = createSignals(fixtureCity(), cfg);
  const next = { verde: 'amarelo', amarelo: 'vermelho', vermelho: 'verde' };
  let prev = signals.stateFor(PLUS.node, 0);
  let allRed = 0;
  for (let i = 0; i < STEPS_PER_CYCLE; i++) {
    signals.step(DT);
    const state = signals.stateFor(PLUS.node, 0);
    if (state !== prev) assert.equal(state, next[prev]);
    prev = state;
    if (state === 'vermelho' && signals.stateFor(PLUS.node, 2) === 'vermelho') allRed += DT;
  }
  assert.ok(Math.abs(allRed - 2 * cfg.allRed) <= 2 * DT, `tudo vermelho ${allRed}`);
});

test('signals: timeToChange acerta o instante da próxima mudança', () => {
  const signals = createSignals(fixtureCity(), cfg);
  for (const { nodeId, edgeId } of signals.heads) {
    const before = signals.stateFor(nodeId, edgeId);
    const wait = signals.timeToChange(nodeId, edgeId);
    assert.ok(wait > 0 && wait <= CYCLE);
    signals.step(wait - 0.01);
    assert.equal(signals.stateFor(nodeId, edgeId), before);
    signals.step(0.02);
    assert.notEqual(signals.stateFor(nodeId, edgeId), before);
  }
});

test('signals: determinístico e defasado entre nós', () => {
  const a = createSignals(fixtureCity(), cfg);
  const b = createSignals(fixtureCity(), cfg);
  let outOfSync = 0;
  for (let i = 0; i < STEPS_PER_CYCLE; i++) {
    for (const h of a.heads) assert.equal(a.stateFor(h.nodeId, h.edgeId), b.stateFor(h.nodeId, h.edgeId));
    if (a.stateFor(PLUS.node, 0) !== a.stateFor(TEE.node, 4)) outOfSync++;
    a.step(DT);
    b.step(DT);
  }
  assert.ok(outOfSync > 0, 'os dois cruzamentos piscam em uníssono');
});
