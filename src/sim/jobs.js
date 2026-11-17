/**
 * Corridas do Rapidão: gera ofertas, cuida da coleta e da entrega, e paga pela economia.
 * Ofertas curtas, médias e longas. Paga como os apps reais: um mínimo por rota até alguns km e um valor por km
 * a partir daí — e só o trecho restaurante → cliente; o caminho até o restaurante ("km morto") não é pago.
 * Corrida longa paga mais, mas o prazo por km aperta.
 */
const REROUTE_EVERY = 0.5; // s entre recálculos do GPS
const REFILL_DELAY = [1.5, 4]; // s até aparecer a próxima oferta

export function createJobs({ city, graph, rng, events, economy, config }) {
  const restaurants = city.pois.filter((poi) => poi.type === 'restaurante');
  const customers = city.pois.filter((poi) => poi.type === 'cliente');
  let nextId = 1;
  let refill = 0;
  let reroute = 0;
  let stopped = 0;

  const jobs = {
    offers: [],
    active: null,

    step(dt, bike) {
      if (jobs.active) stepActive(dt, bike);
      else stepOffers(dt, bike);
    },

    accept(offerId, bike) {
      const offer = jobs.offers.find((o) => o.id === offerId);
      if (!offer || jobs.active) return false;
      jobs.offers.length = 0;
      economy.recordOffer(true);
      jobs.active = { offer, phase: 'coleta', timeLeft: offer.deadline, target: offer.restaurant, route: null };
      stopped = 0;
      updateRoute(bike);
      events.emit('job:accepted', { job: jobs.active });
      return true;
    },

    decline(offerId) {
      if (removeOffer(offerId)) economy.recordOffer(false);
    },
  };

  function stepOffers(dt, bike) {
    for (const offer of [...jobs.offers]) {
      offer.expiresIn -= dt;
      if (offer.expiresIn > 0) continue;
      removeOffer(offer.id);
      economy.recordOffer(false);
      events.emit('offer:expired', { offer });
    }
    if (jobs.offers.length >= config.offerCount) return;
    refill -= dt;
    if (refill > 0) return;
    refill = rng.range(...REFILL_DELAY);
    const offer = makeOffer(bike);
    jobs.offers.push(offer);
    events.emit('offer:new', { offer });
  }

  function makeOffer(bike) {
    const band = pickBand();
    const restaurant = rng.pick(nearest(restaurants, bike, config.restaurantChoices));
    const { customer, leg } = customerFor(restaurant, band);
    const distance = graph.route(bike.road, restaurant).length + leg;
    // Tarifa dinâmica de vez em quando, e só para quem aceita quase tudo: aceitação baixa, o app esconde as boas.
    const surge = !economy.hidesGoodOffers() && rng.chance(config.surgeChance) ? rng.range(1.1, config.surgeMax) : 1;
    const realKm = (leg / 1000) * config.kmScale;
    return {
      id: nextId++,
      band: bandOf(leg), // pela distância de fato: se não achou cliente na faixa pedida, vale a que saiu
      restaurant,
      customer,
      distance, // o que se vai rodar: até o restaurante + até o cliente
      paidDistance: leg, // o que se recebe: só restaurante → cliente
      surge,
      pay: round2((config.minPay + config.payPerKm * Math.max(0, realKm - config.freeKm)) * surge),
      deadline: Math.round(distance / referenceSpeed(distance) + config.deadlineBuffer),
      expiresIn: config.offerLifetime,
    };
  }

  const bandOf = (leg) => (config.bands.find((b) => leg <= b.max) ?? config.bands.at(-1)).name;

  function pickBand() {
    let roll = rng.next();
    for (const band of config.bands) if ((roll -= band.share) < 0) return band;
    return config.bands.at(-1);
  }

  /** Os `count` POIs mais perto da moto em linha reta. */
  function nearest(list, bike, count) {
    const away = (poi) => Math.hypot(poi.x - bike.x, poi.z - bike.z);
    return [...list].sort((a, b) => away(a) - away(b)).slice(0, count);
  }

  /** Cliente cuja rota a partir do restaurante cai na faixa pedida (ou o mais perto disso). */
  function customerFor(restaurant, band) {
    const straight = (poi) => Math.hypot(poi.x - restaurant.x, poi.z - restaurant.z);
    const inReach = customers.filter((poi) => straight(poi) <= band.max && straight(poi) >= band.min / 2);
    const pool = inReach.length ? inReach : customers;
    let best = null;
    for (let i = 0; i < config.customerTries; i++) {
      const customer = rng.pick(pool);
      const leg = graph.route(restaurant, customer).length;
      const miss = Math.max(band.min - leg, leg - band.max, 0);
      if (!best || miss < best.miss) best = { customer, leg, miss };
      if (miss === 0) break;
    }
    return best;
  }

  /** Velocidade média que o app "espera": sobe com a distância, apertando as corridas longas. */
  function referenceSpeed(distance) {
    const k = clamp01((distance - config.refDistanceShort) / (config.refDistanceLong - config.refDistanceShort));
    return config.refSpeedShort + k * (config.refSpeedLong - config.refSpeedShort);
  }

  function stepActive(dt, bike) {
    const job = jobs.active;
    job.timeLeft -= dt;
    if (job.timeLeft < -config.cancelAfterLate) return cancel(job);

    reroute -= dt;
    if (reroute <= 0) updateRoute(bike);

    const near = Math.hypot(bike.x - job.target.x, bike.z - job.target.z) < config.stopRadius;
    stopped = near && Math.abs(bike.speed) < config.stopSpeed ? stopped + dt : 0;
    if (stopped < config.pickupStopTime) return;
    stopped = 0;
    if (job.phase === 'coleta') pickUp(job, bike);
    else deliver(job);
  }

  function updateRoute(bike) {
    reroute = REROUTE_EVERY;
    jobs.active.route = graph.route(bike.road, jobs.active.target);
  }

  function pickUp(job, bike) {
    job.phase = 'entrega';
    job.target = job.offer.customer;
    updateRoute(bike);
    events.emit('job:pickup', { job });
  }

  function deliver(job) {
    const { pay, deadline } = job.offer;
    const lateBy = Math.max(0, -job.timeLeft);
    const tip = round2(pay * config.maxTipShare * clamp01(job.timeLeft / deadline));
    jobs.active = null;
    economy.payDelivery({ pay, tip, lateBy });
    events.emit('job:delivered', { job, pay, tip, lateBy });
  }

  function cancel(job) {
    jobs.active = null;
    economy.cancelDelivery();
    events.emit('job:cancelled', { job, reason: 'atraso' });
  }

  function removeOffer(offerId) {
    const index = jobs.offers.findIndex((o) => o.id === offerId);
    if (index < 0) return false;
    jobs.offers.splice(index, 1);
    return true;
  }

  return jobs;
}

/** Estratégia dos robôs (simulação e `?bot=`): a oferta que paga mais por metro rodado. */
export const bestPerMeter = (offers) => offers.reduce((a, b) => (b.pay / b.distance > a.pay / a.distance ? b : a));

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const round2 = (v) => Math.round(v * 100) / 100;
