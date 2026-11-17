import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { createEvents } from '../src/core/events.js';
import { generateCity } from '../src/sim/city/generator.js';
import { createGraph } from '../src/sim/city/graph.js';
import { createEconomy } from '../src/sim/economy.js';
import { createBike } from '../src/sim/bike.js';
import { createJobs } from '../src/sim/jobs.js';
import { createAutopilot } from '../src/sim/autopilot.js';

const DT = 1 / 60;

function world() {
  const rng = createRng(config.seed);
  const city = generateCity(config.city, rng.fork('cidade'));
  const graph = createGraph(city);
  const events = createEvents();
  const economy = createEconomy(config.economy, events);
  const home = city.pois[city.homeId];
  const bike = createBike(config.bike, { city, graph }, { x: home.x, z: home.z, heading: 0 });
  const jobs = createJobs({ city, graph, rng: rng.fork('ofertas'), events, economy, config: config.jobs });
  return { city, graph, events, economy, bike, jobs };
}

test('ofertas: curtas, médias e longas; longa paga mais e tem prazo mais apertado por km; mínimo sempre garantido', () => {
  const { jobs, bike } = world();
  const offers = [];
  for (let i = 0; i < 20000 && offers.length < 80; i++) {
    jobs.step(DT, bike);
    for (const o of jobs.offers.splice(0)) offers.push(o);
  }
  assert.ok(offers.length >= 60);
  for (const band of config.jobs.bands) assert.ok(offers.some((o) => o.band === band.name), `faltou oferta ${band.name}`);
  for (const o of offers) {
    assert.ok(o.pay >= config.jobs.minPay, 'nunca abaixo da taxa mínima');
    assert.ok(o.distance >= o.paidDistance, 'o trecho pago está dentro do percurso');
  }
  const base = (o) => o.pay / o.surge;
  offers.sort((a, b) => a.paidDistance - b.paidDistance);
  const short = offers[0];
  const long = offers.at(-1);
  assert.ok(base(long) > base(short), 'a longa paga mais que a curta');
  assert.ok((long.deadline - config.jobs.deadlineBuffer) / long.distance < (short.deadline - config.jobs.deadlineBuffer) / short.distance);
});

test('piloto automático coleta e entrega: dinheiro entra, gorjeta nunca passa do teto', () => {
  const { jobs, bike, economy, city, graph, events } = world();
  const pilot = createAutopilot({ city, graph, bike, config: config.autopilot });
  let target = null;
  const delivered = [];
  events.on('job:delivered', (e) => delivered.push(e));
  while (!jobs.offers.length) jobs.step(DT, bike);
  assert.ok(jobs.accept(jobs.offers[0].id, bike));
  for (let i = 0; i < 60 * 600 && jobs.active; i++) {
    if (jobs.active.target !== target) pilot.goTo((target = jobs.active.target));
    bike.step(pilot.step(DT), DT);
    jobs.step(DT, bike);
  }
  assert.equal(jobs.active, null, 'a corrida deveria ter terminado em 10 min de jogo');
  assert.equal(delivered.length, 1, 'deveria ter entregado (e não cancelado)');
  const { pay, tip } = delivered[0];
  assert.ok(tip >= 0 && tip <= pay * config.jobs.maxTipShare + 0.01);
  assert.ok(Math.abs(economy.money - (pay + tip)) < 0.01);
});
