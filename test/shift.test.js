import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createEvents } from '../src/core/events.js';
import { createEconomy } from '../src/sim/economy.js';
import { createShift } from '../src/sim/shift.js';

function world() {
  const events = createEvents();
  const economy = createEconomy(config.economy, events);
  const jobs = { offers: [{ id: 1 }], active: null };
  const shift = createShift({ economy, jobs, events, config: config.shift });
  const seen = [];
  events.on('*', (type, payload) => seen.push({ type, ...payload }));
  /** Roda o turno até ele fechar (ou estourar `seconds`). */
  const play = (seconds = config.shift.duration + 1, dt = 0.5) => {
    for (let t = 0; t < seconds && shift.running; t += dt) shift.step(dt);
  };
  return { events, economy, jobs, shift, seen, play };
}
const last = (seen, type) => seen.filter((e) => e.type === type).at(-1);

test('turno: fecha quando o relógio zera, mas espera a entrega em andamento terminar', () => {
  const { shift, jobs, seen, play, economy } = world();
  shift.start();
  assert.equal(jobs.offers.length, 0, 'ofertas de ontem somem');
  jobs.active = { offer: {} };
  play();
  assert.ok(shift.running, 'com entrega em andamento o dia não fecha');
  jobs.active = null;
  shift.step(0.1);
  assert.ok(!shift.running);
  const end = last(seen, 'shift:end');
  assert.equal(end.day, 1);
  assert.equal(end.statement.net, economy.money, 'o extrato fecha com o saldo');
});

test('turno: as contas sobem a cada dia', () => {
  const { shift, play } = world();
  shift.start();
  assert.equal(shift.bills, config.shift.billsDay1);
  play();
  shift.nextDay();
  assert.equal(shift.bills, Math.round(config.shift.billsDay1 * (1 + config.shift.billsGrowth) * 100) / 100);
});

test('fim: despejado depois de dias seguidos sem pagar as contas; um dia bom zera a conta', () => {
  const { shift, seen, play, economy } = world();
  shift.start();
  play();
  shift.nextDay();
  economy.payDelivery({ pay: 500 }); // dia bom
  play();
  assert.equal(shift.missedDays, 0);
  for (let d = 0; d < config.shift.missedDaysToLose; d++) {
    shift.nextDay();
    play();
  }
  assert.ok(!last(seen, 'game:over'));
  shift.nextDay();
  const over = last(seen, 'game:over');
  assert.equal(over.reason, 'despejado');
  assert.equal(over.stats.days, 1 + 1 + config.shift.missedDaysToLose);
});

test('fim: conta desativada quando a nota cai abaixo do mínimo, com o dia em andamento nas estatísticas', () => {
  const { shift, seen, economy } = world();
  shift.start();
  economy.payDelivery({ pay: 10 });
  economy.rate(-(economy.rating - config.economy.minRating) - 0.05);
  shift.step(0.5);
  const over = last(seen, 'game:over');
  assert.equal(over.reason, 'desativado');
  assert.equal(over.stats.days, 1);
  assert.equal(over.stats.deliveries, 1);
  assert.ok(!shift.running);
});
