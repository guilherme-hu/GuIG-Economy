/**
 * Balanceamento: um robô joga dias inteiros com o piloto automático e uma estratégia de escolha de corridas.
 * Sem trânsito e sem multas (o piloto ainda não desvia de carros nem respeita sinal): é o teto do que dá para ganhar.
 * `ritmo` reduz a velocidade do piloto para imitar o trânsito.
 *
 *   node scripts/balance.js [dias=3]
 */
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { createEvents } from '../src/core/events.js';
import { generateCity } from '../src/sim/city/generator.js';
import { createGraph } from '../src/sim/city/graph.js';
import { createEconomy } from '../src/sim/economy.js';
import { createBike } from '../src/sim/bike.js';
import { createJobs } from '../src/sim/jobs.js';
import { createShift } from '../src/sim/shift.js';
import { createAutopilot } from '../src/sim/autopilot.js';

const DT = 1 / 60;
const days = Number(process.argv[2] ?? 3);

const strategies = {
  primeira: (offers) => offers[0],
  curtas: (offers) => offers.reduce((a, b) => (b.distance < a.distance ? b : a)),
  'R$/km': (offers) => offers.reduce((a, b) => (b.pay / b.distance > a.pay / a.distance ? b : a)),
  longas: (offers) => offers.reduce((a, b) => (b.pay > a.pay ? b : a)),
};

function playDays(choose, pace) {
  const rng = createRng(config.seed);
  const city = generateCity(config.city, rng.fork('cidade'));
  const graph = createGraph(city);
  const events = createEvents();
  const economy = createEconomy(config.economy, events);
  const home = city.pois[city.homeId];
  const spawn = { ...graph.pointOnEdge(home.edge, home.t, 0), heading: 0 };
  const bike = createBike(config.bike, { city, graph }, spawn);
  const jobs = createJobs({ city, graph, rng: rng.fork('ofertas'), events, economy, config: config.jobs });
  const shift = createShift({ economy, jobs, events, config: config.shift });
  // Acima de 1, o robô também entra nas curvas e freia mais tarde, como um entregador com pressa.
  const bold = Math.max(1, pace);
  const pilot = createAutopilot({ city, graph, bike, config: { ...config.autopilot, cruise: config.autopilot.cruise * pace, cornerGrip: config.autopilot.cornerGrip * bold ** 2, brake: config.autopilot.brake * bold } });
  const results = [];
  events.on('shift:end', ({ statement, bills, metBills }) => results.push({ ...statement, bills, metBills }));
  events.on('game:over', ({ reason }) => results.push({ over: reason, rating: economy.rating }));

  for (let d = 0; d < days && !results.some((r) => r.over); d++) {
    d === 0 ? shift.start() : shift.nextDay();
    bike.reset(spawn);
    let target = null;
    while (shift.running) {
      // Como uma pessoa: olha as ofertas que estão na tela e escolhe antes de alguma expirar.
      const ready = jobs.offers.length >= config.jobs.offerCount || jobs.offers.some((o) => o.expiresIn < 2);
      if (!jobs.active && ready && shift.timeLeft > 0) jobs.accept(choose(jobs.offers).id, bike);
      if (jobs.active?.target !== target) {
        target = jobs.active?.target ?? null;
        if (target) pilot.goTo(target);
        else pilot.stop();
      }
      const before = bike.distance;
      bike.step(pilot.active ? pilot.step(DT) : { throttle: 0, steer: 0, brake: true, horn: false }, DT);
      economy.chargeFuel(bike.distance - before);
      economy.tick(DT);
      jobs.step(DT, bike);
      shift.step(DT);
    }
  }
  return results;
}

const money = (v) => v.toFixed(2).padStart(8);
console.log(`${days} dias · turno de ${config.shift.duration / 60} min = ${config.economy.shiftHours} h reais · contas do dia 1: R$ ${config.shift.billsDay1}`);
console.log('estratégia  ritmo  entregas atras.  bruto  gorjeta  combust.  aluguel   líquido   contas  R$/h  pagou');
for (const pace of (process.argv[3] ?? "1.4,1,0.8,0.65").split(",").map(Number)) {
  for (const [name, choose] of Object.entries(strategies)) {
    for (const [i, r] of playDays(choose, pace).entries()) {
      if (r.over) {
        console.log(`${name.padEnd(10)} ${String(pace).padEnd(5)} fim de jogo: ${r.over} (nota ${r.rating})`);
        continue;
      }
      console.log(
        `${name.padEnd(10)} ${String(pace).padEnd(5)} d${i + 1} ${String(r.deliveries).padStart(4)} ${String(r.late).padStart(5)} ${money(r.gross)} ${money(r.tips)} ${money(r.fuel)} ${money(r.rent)} ${money(r.net)} ${money(r.bills)} ${r.perHour.toFixed(1).padStart(6)}  ${r.metBills ? 'sim' : 'não'}`,
      );
    }
  }
}
