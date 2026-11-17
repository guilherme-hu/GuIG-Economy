import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvents } from '../src/core/events.js';
import { createEconomy } from '../src/sim/economy.js';
import { config } from '../src/config.js';

const cfg = config.economy;

function setup() {
  const events = createEvents();
  const log = [];
  events.on('*', (type, payload) => log.push({ type, ...payload }));
  return { eco: createEconomy(cfg, events), log };
}

const isCents = (v) => v === Math.round(v * 100) / 100;

test('economy: o extrato fecha e bate com a variação do dinheiro', () => {
  const { eco } = setup();
  eco.startDay();
  for (let i = 0; i < 30; i++) eco.payDelivery({ pay: 7.1, tip: 0.2, lateBy: 0 });
  eco.payDelivery({ pay: 12.337, tip: 0, lateBy: 15 });
  eco.chargeFine(60, 'sinal');
  eco.chargeFine(30, 'contramao');
  for (let i = 0; i < 20000; i++) eco.chargeFuel(0.37); // metros por passo, como no jogo
  eco.tick(config.shift.duration);

  const s = eco.statement();
  assert.equal(s.net, Math.round((s.gross + s.tips - s.fuel - s.rent - s.fines) * 100) / 100);
  assert.equal(eco.money, Math.round((cfg.startMoney + s.net) * 100) / 100);
  for (const key of ['gross', 'tips', 'fuel', 'rent', 'fines', 'net']) assert.ok(isCents(s[key]), key);
  assert.equal(s.gross, 225.34);
  assert.equal(s.tips, 6);
  assert.equal(s.fines, 90);
  assert.equal(s.fuel, 2.59); // 7,4 km × R$ 0,35
  assert.equal(s.deliveries, 31);
  assert.equal(s.late, 1);
  assert.ok(Math.abs(s.distanceKm - 7.4) < 1e-6);
});

test('economy: R$/hora converte o turno de jogo numa jornada real', () => {
  const { eco } = setup();
  eco.startDay();
  eco.payDelivery({ pay: 140, tip: 0, lateBy: 0 });
  eco.tick(config.shift.duration / 2);
  const s = eco.statement();
  assert.equal(s.hours, cfg.shiftHours / 2);
  assert.equal(s.perHour, Math.round((s.net / s.hours) * 100) / 100);
  assert.equal(createEconomy(cfg, createEvents()).statement().perHour, 0); // sem tempo trabalhado
});

test('economy: dinheiro pode ficar negativo', () => {
  const { eco } = setup();
  eco.startDay();
  eco.chargeFine(60, 'sinal');
  assert.equal(eco.money, cfg.startMoney - cfg.bikeRentPerDay - 60);
  assert.ok(eco.money < 0);
});

test('economy: aluguel é cobrado uma vez por dia e o dia é zerado', () => {
  const { eco, log } = setup();
  eco.startDay();
  for (let i = 0; i < 1000; i++) eco.tick(1 / 60);
  eco.payDelivery({ pay: 10, tip: 1, lateBy: 0 });
  assert.equal(eco.day.rent, cfg.bikeRentPerDay);
  assert.equal(log.filter((e) => e.reason === 'aluguel').length, 1);

  eco.endDay();
  eco.startDay();
  assert.equal(log.filter((e) => e.reason === 'aluguel').length, 2);
  assert.deepEqual(eco.day, {
    gross: 0, tips: 0, fuel: 0, rent: cfg.bikeRentPerDay, fines: 0,
    deliveries: 0, late: 0, cancelled: 0, distance: 0, seconds: 0,
  });
});

test('economy: endDay acumula na carreira', () => {
  const { eco } = setup();
  let earned = 0;
  for (let d = 0; d < 3; d++) {
    eco.startDay();
    eco.payDelivery({ pay: 55.55, tip: 3.33, lateBy: 0 });
    eco.tick(100);
    earned += eco.endDay().net;
  }
  assert.equal(eco.career.days, 3);
  assert.equal(eco.career.deliveries, 3);
  assert.equal(eco.career.seconds, 300);
  assert.equal(eco.career.earned, Math.round(earned * 100) / 100);
  assert.equal(eco.money, Math.round((cfg.startMoney + eco.career.earned) * 100) / 100);
});

test('economy: nota respeita teto e piso', () => {
  const { eco, log } = setup();
  for (let i = 0; i < 50; i++) eco.rate(cfg.ratingOnTime);
  assert.equal(eco.rating, cfg.maxRating);
  const before = log.length;
  eco.rate(1); // já no teto: nada muda, nada é emitido
  assert.equal(log.length, before);
  eco.rate(-100);
  assert.equal(eco.rating, 0);
  assert.deepEqual(log.at(-1), { type: 'rating:changed', rating: 0, delta: -cfg.maxRating });
});

test('economy: nota sobe no prazo, cai com o atraso e com cancelamento', () => {
  const { eco } = setup();
  const round = (v) => Math.round(v * 100) / 100;
  eco.startDay();
  eco.payDelivery({ pay: 5, tip: 0, lateBy: 0 });
  assert.equal(eco.rating, round(cfg.startRating + cfg.ratingOnTime));

  let prev = eco.rating;
  eco.payDelivery({ pay: 5, tip: 0, lateBy: 0.001 });
  assert.equal(eco.rating, round(prev - cfg.ratingLateMin));

  prev = eco.rating;
  eco.payDelivery({ pay: 5, tip: 0, lateBy: config.jobs.cancelAfterLate * 10 });
  assert.equal(eco.rating, round(prev - cfg.ratingLateMax));

  prev = eco.rating;
  eco.cancelDelivery();
  assert.equal(eco.rating, round(prev - cfg.ratingCancelled));
  assert.equal(eco.day.cancelled, 1);
  assert.equal(eco.day.late, 2);
});

test('economy: desativação exatamente abaixo da nota mínima', () => {
  const { eco } = setup();
  eco.rate(cfg.minRating - cfg.startRating); // cai exatamente no mínimo
  assert.equal(eco.rating, cfg.minRating);
  assert.equal(eco.isDeactivated(), false);
  eco.rate(-0.01);
  assert.equal(eco.isDeactivated(), true);
});

test('economy: aceitação reflete a janela móvel', () => {
  const { eco } = setup();
  const n = cfg.acceptanceWindow;
  assert.equal(eco.acceptance, 1);
  assert.equal(eco.hidesGoodOffers(), false);

  eco.recordOffer(true);
  eco.recordOffer(false);
  assert.equal(eco.acceptance, 0.5);

  for (let i = 0; i < n; i++) eco.recordOffer(false);
  assert.equal(eco.acceptance, 0);
  assert.equal(eco.hidesGoodOffers(), true);

  for (let i = 0; i < n; i++) {
    eco.recordOffer(true);
    assert.equal(eco.acceptance, (i + 1) / n); // as recusas antigas saem da janela uma a uma
  }
  assert.equal(eco.hidesGoodOffers(), false);
});

test('economy: eventos saem com os payloads da tabela', () => {
  const { eco, log } = setup();
  eco.startDay();
  eco.payDelivery({ pay: 10, tip: 2.5, lateBy: 0 });
  eco.chargeFine(60, 'sinal');
  eco.chargeFuel(1000);

  const rent = cfg.bikeRentPerDay;
  const start = cfg.startMoney;
  assert.deepEqual(log, [
    { type: 'money:changed', money: start - rent, delta: -rent, reason: 'aluguel' },
    { type: 'money:changed', money: start - rent + 12.5, delta: 12.5, reason: 'entrega' },
    { type: 'rating:changed', rating: cfg.startRating + cfg.ratingOnTime, delta: cfg.ratingOnTime },
    { type: 'money:changed', money: start - rent - 47.5, delta: -60, reason: 'multa', kind: 'sinal' },
    { type: 'money:changed', money: start - rent - 47.5 - cfg.fuelPerKm, delta: -cfg.fuelPerKm, reason: 'combustivel' },
  ]);
});
