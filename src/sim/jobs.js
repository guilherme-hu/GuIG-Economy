/**
 * Corridas do Rapidão: gera ofertas, cuida da coleta e da entrega, e paga pela economia.
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
    const restaurant = rng.pick(restaurants);
    const customer = rng.pick(customers);
    const distance = graph.route(bike.road, restaurant).length + graph.route(restaurant, customer).length;
    const surgeCap = economy.hidesGoodOffers() ? 1 : config.surgeMax; // aceitação baixa: o app esconde as boas
    const surge = rng.range(config.surgeMin, surgeCap);
    return {
      id: nextId++,
      restaurant,
      customer,
      distance,
      surge,
      pay: round2((config.basePay + (config.payPerKm * distance) / 1000) * surge),
      deadline: Math.round(distance / referenceSpeed(distance) + config.deadlineBuffer),
      expiresIn: config.offerLifetime,
    };
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

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const round2 = (v) => Math.round(v * 100) / 100;
