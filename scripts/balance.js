/**
 * Balanceamento: um robô joga dias inteiros na cidade de verdade — com trânsito, semáforos, radares,
 * multas e batidas — usando o piloto automático, um perfil de direção e uma estratégia de escolha de corridas.
 *
 *   node scripts/balance.js [dias=3] [perfis=cauteloso,bom,apressado,kamikaze] [sementes=1]
 *
 * Um perfil com "+sinais" (ex.: bom+sinais) roda com semáforos e radares, mas sem carros: mostra o tempo que se
 * perde só com sinais e cruzamentos — o que sobra para quem costura bem no trânsito.
 */
import { config } from '../src/config.js';
import { createRng } from '../src/core/rng.js';
import { createEvents } from '../src/core/events.js';
import { generateCity } from '../src/sim/city/generator.js';
import { createGraph } from '../src/sim/city/graph.js';
import { createEconomy } from '../src/sim/economy.js';
import { createBike } from '../src/sim/bike.js';
import { createJobs, bestPerMeter } from '../src/sim/jobs.js';
import { createShift } from '../src/sim/shift.js';
import { createAutopilot } from '../src/sim/autopilot.js';
import { createSignals } from '../src/sim/signals.js';
import { createTraffic } from '../src/sim/traffic.js';
import { createRules } from '../src/sim/rules.js';

const DT = 1 / 60;
const days = Number(process.argv[2] ?? 3);
const profileNames = (process.argv[3] ?? 'cauteloso,bom,apressado,kamikaze').split(',');
const seeds = Number(process.argv[4] ?? 1);

const ap = config.autopilot;
const profiles = ap.profiles;

const strategies = {
  'R$/km': bestPerMeter,
  primeira: (offers) => offers[0],
};

function playDays(spec, choose, seed) {
  const [profile, mode] = spec.split('+');
  const withCars = mode !== 'sinais';
  const city = generateCity(config.city, createRng(config.seed).fork('cidade'));
  const graph = createGraph(city);
  const run = createRng(seed); // o que muda entre sementes: ofertas, trânsito e radares
  const events = createEvents();
  const economy = createEconomy(config.economy, events);
  const home = city.pois[city.homeId];
  const homeEdge = city.edges[home.edge];
  const spawn = { ...graph.pointOnEdge(home.edge, home.t, home.side * config.city.street.laneWidth * 0.5), heading: Math.atan2(homeEdge.dir.z, homeEdge.dir.x) };
  const bike = createBike(config.bike, { city, graph }, spawn);
  const jobs = createJobs({ city, graph, rng: run.fork('ofertas'), events, economy, config: config.jobs });
  const shift = createShift({ economy, jobs, events, config: config.shift });
  const signals = createSignals(city, config.signals);
  const traffic = withCars ? createTraffic({ city, graph, signals, rng: run.fork('trânsito'), config: config.traffic }) : { vehicles: [], step() {} };
  const rules = createRules({ city, signals, traffic, bike, economy, events, rng: run.fork('radares'), config: config.rules });
  const pilot = createAutopilot({ city, graph, bike, config: { ...ap, ...profiles[profile] }, traffic: withCars ? traffic : null, signals, cameras: rules.cameras });

  const results = [];
  let today = { infractions: {}, damages: 0 };
  events.on('fine', ({ kind }) => (today.infractions[kind] = (today.infractions[kind] ?? 0) + 1));
  events.on('damage', () => today.damages++);
  events.on('shift:end', ({ statement, bills, metBills }) => results.push({ ...statement, bills, metBills, ...today }));
  events.on('game:over', ({ reason }) => results.push({ over: reason, rating: economy.rating, ...economy.day, minutes: (config.shift.duration - shift.timeLeft) / 60, ...today }));
  events.on('crash', ({ vehicleId, kind, relSpeed }) => {
    const v = traffic.vehicles[vehicleId];
    const where = city.nodes.find((n) => Math.hypot(n.x - bike.x, n.z - bike.z) < n.radius + 3);
    const angle = v ? Math.round((Math.acos(Math.max(-1, Math.min(1, Math.cos(v.heading - bike.heading)))) * 180) / Math.PI) : 0;
    today.crash = v
      ? `${v.reckless ? 'moto imprudente' : v.type} a ${Math.round(v.speed * 3.6)} km/h, moto a ${Math.round(bike.speed * 3.6)} km/h, ${angle}°, ${where ? (where.signal ? 'cruzamento com sinal' : 'cruzamento sem sinal') : 'fora de cruzamento'}, t=${Math.round(config.shift.duration - shift.timeLeft)} s`
      : `${kind} a ${Math.round(relSpeed * 3.6)} km/h`;
    shift.gameOver('acidente');
  });

  for (let d = 0; d < days && !results.some((r) => r.over); d++) {
    today = { infractions: {}, damages: 0 };
    d === 0 ? shift.start() : shift.nextDay();
    bike.reset(spawn);
    let target = null;
    let still = 0;
    while (shift.running) {
      // Travamento: parada mais de 60 s com corrida em andamento. Mostra uma vez o que a segura.
      still = jobs.active && Math.abs(bike.speed) < 0.3 ? still + DT : 0;
      if (process.env.TRAVAS && Math.abs(still - 60) < DT / 2) console.log(`  [trava] ${profile} sem ${seed} dia ${d + 1}: ${stuckReport(city, bike, pilot, traffic, signals)}`);
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
      signals.step(DT);
      traffic.step(DT, bike);
      rules.step(DT);
      shift.step(DT);
    }
  }
  return results;
}

/** Por que a moto está parada: o limite do piloto e os veículos perto, com o estado de cada um. */
function stuckReport(city, bike, pilot, traffic, signals) {
  const near = traffic.vehicles
    .filter((v) => v.active && Math.hypot(v.x - bike.x, v.z - bike.z) < 15)
    .map((v) => {
      const fx = Math.cos(bike.heading);
      const fz = Math.sin(bike.heading);
      const dx = v.x - bike.x;
      const dz = v.z - bike.z;
      const edge = city.edges[v.edge];
      const end = v.forward ? edge.b : edge.a;
      return `${v.reckless ? 'moto' : v.type} ${Math.round(v.speed * 3.6)}km/h frente=${(dx * fx + dz * fz).toFixed(1)} lado=${(dx * fz - dz * fx).toFixed(1)} cos=${Math.cos(v.heading - bike.heading).toFixed(2)} noCruz=${v.inNode} sinal=${signals.stateFor(end, v.edge)} parado=${Math.round(v.stuck)}s`;
    });
  return `limite=${pilot.limitedBy} via=${bike.road.edge} perto: ${near.join(' | ') || 'ninguém'}`;
}

const money = (v) => v.toFixed(2).padStart(7);
const list = (counts) => Object.entries(counts).map(([k, n]) => `${n}×${k}`).join(' ') || '-';
console.log(`${days} dias · turno de ${config.shift.duration / 60} min = ${config.economy.shiftHours} h · contas do dia 1: R$ ${config.shift.billsDay1} · com trânsito, sinais, radares, multas e batidas`);
console.log('perfil     estratégia sem dia entr atr   bruto gorjeta  multas  líquido  contas pagou  infrações · consertos');
for (const profile of profileNames) {
  for (const [name, choose] of Object.entries(strategies)) {
    for (let seed = 1; seed <= seeds; seed++) {
      for (const [i, r] of playDays(profile, choose, seed).entries()) {
        const head = `${profile.padEnd(16)} ${name.padEnd(9)} ${String(seed).padStart(3)} d${i + 1}`;
        if (r.over) {
          console.log(`${head}  FIM: ${r.over}${r.crash ? ` (${r.crash})` : ''} · aos ${r.minutes.toFixed(1)} min · ${r.deliveries} entregas, ${r.late} atrasadas, ${r.cancelled} canceladas · nota ${r.rating} · ${list(r.infractions)} · ${r.damages} conserto(s)`);
          continue;
        }
        console.log(
          `${head} ${String(r.deliveries).padStart(4)} ${String(r.late).padStart(3)} ${money(r.gross)} ${money(r.tips)} ${money(r.fines)} ${money(r.net)} ${money(r.bills)}  ${r.metBills ? 'sim' : 'não'}   ${list(r.infractions)} · ${r.damages}`,
        );
      }
    }
  }
}
