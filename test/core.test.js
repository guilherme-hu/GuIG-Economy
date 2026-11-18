import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createEvents } from '../src/core/events.js';
import { createLoop } from '../src/core/loop.js';

test('rng: mesma seed gera a mesma sequência', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('rng: valores ficam nos intervalos pedidos', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const f = r.range(2, 5);
    assert.ok(f >= 2 && f < 5);
    const n = r.int(1, 3);
    assert.ok(n >= 1 && n <= 3 && Number.isInteger(n));
  }
});

test('rng: fork é independente e determinístico', () => {
  const a = createRng(1).fork('trânsito').next();
  const b = createRng(1).fork('trânsito').next();
  const c = createRng(1).fork('ofertas').next();
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('events: entrega, cancela assinatura e suporta curinga', () => {
  const events = createEvents();
  const seen = [];
  const off = events.on('multa', (p) => seen.push(p.valor));
  events.on('*', (type) => seen.push(type));
  events.emit('multa', { valor: 60 });
  off();
  events.emit('multa', { valor: 30 });
  assert.deepEqual(seen, [60, 'multa', 'multa']);
});

test('loop: maxFps limita os quadros desenhados sem deriva', () => {
  let tick = null;
  globalThis.requestAnimationFrame = (fn) => (tick = fn);
  const run = (maxFps, hz, seconds) => {
    let frames = 0;
    const loop = createLoop({ step() {}, render: () => frames++ });
    loop.maxFps = maxFps;
    loop.start();
    for (let i = 1; i <= hz * seconds; i++) tick((i * 1000) / hz);
    loop.stop();
    return frames / seconds;
  };
  assert.ok(Math.abs(run(60, 144, 10) - 60) < 1); // monitor de 144 Hz, limite 60
  assert.ok(Math.abs(run(30, 60, 10) - 30) < 1);
  assert.equal(run(0, 144, 10), 144); // sem limite
});
