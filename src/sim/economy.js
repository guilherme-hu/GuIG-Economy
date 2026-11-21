/**
 * Contabilidade do entregador: dinheiro, nota, taxa de aceitação e extrato do dia.
 *
 * Valores em reais, arredondados para centavos a cada operação: somas de valores já em centavos,
 * re-arredondadas, não acumulam erro de ponto flutuante.
 *
 * R$/hora: um turno de `cfg.shiftDuration` segundos de jogo representa uma jornada de `cfg.shiftHours`
 * horas reais, então horas = segundos × shiftHours ÷ shiftDuration.
 */
const CENTS = 100;
const METERS_PER_KM = 1000;

const round2 = (v) => Math.round(v * CENTS) / CENTS;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function createEconomy(cfg, events) {
  // Janela móvel circular (1 = aceita). Começa cheia de aceites, como uma conta que já tem histórico:
  // vazia, a primeira oferta perdida levava a taxa a 0% e escondia as ofertas boas logo no começo.
  const offers = new Uint8Array(cfg.acceptanceWindow).fill(1);
  let offerIndex = 0;
  let acceptedCount = offers.length;

  const eco = {
    money: cfg.startMoney,
    rating: cfg.startRating,
    acceptance: 1,
    day: { gross: 0, tips: 0, fuel: 0, rent: 0, fines: 0, deliveries: 0, late: 0, cancelled: 0, distance: 0, seconds: 0 },
    career: { days: 0, deliveries: 0, earned: 0, seconds: 0 },
    hoursPerSecond: cfg.shiftHours / cfg.shiftDuration, // horas de jornada real por segundo de jogo
    startDay,
    tick,
    payDelivery,
    cancelDelivery,
    chargeFine,
    chargeFuel,
    rate,
    recordOffer,
    isDeactivated: () => eco.rating < cfg.minRating,
    hidesGoodOffers: () => eco.acceptance < cfg.acceptanceFloor,
    statement,
    endDay,
    snapshot,
    restore,
  };
  const { day, career } = eco;

  function changeMoney(delta, reason, kind) {
    eco.money = round2(eco.money + delta);
    const payload = { money: eco.money, delta, reason };
    if (kind) payload.kind = kind;
    events.emit('money:changed', payload);
  }

  function charge(field, amount, reason, kind) {
    const value = round2(amount);
    day[field] = round2(day[field] + value);
    changeMoney(-value, reason, kind);
  }

  /** Zera o dia e cobra o aluguel da moto: o dia já começa no vermelho. */
  function startDay() {
    for (const key in day) day[key] = 0;
    charge('rent', cfg.bikeRentPerDay, 'aluguel');
  }

  function tick(dt) {
    day.seconds += dt;
  }

  /** Paga a entrega e já aplica a nota: sobe se chegou no prazo, cai conforme o atraso. */
  function payDelivery({ pay, tip = 0, lateBy = 0 }) {
    const paid = round2(pay);
    const tipped = round2(tip);
    day.gross = round2(day.gross + paid);
    day.tips = round2(day.tips + tipped);
    day.deliveries++;
    if (lateBy > 0) day.late++;
    changeMoney(round2(paid + tipped), 'entrega');
    rate(lateBy > 0 ? -latePenalty(lateBy) : cfg.ratingOnTime);
  }

  function latePenalty(lateBy) {
    const share = Math.min(1, lateBy / cfg.ratingLateFullAt);
    return cfg.ratingLateMin + (cfg.ratingLateMax - cfg.ratingLateMin) * share;
  }

  /** Pedido cancelado por atraso: sem pagamento e a nota cai. */
  function cancelDelivery() {
    day.cancelled++;
    rate(-cfg.ratingCancelled);
  }

  function chargeFine(amount, kind) {
    charge('fines', amount, 'multa', kind);
  }

  /** Pode ser chamado a cada passo com poucos metros: só cobra quando a conta do dia vira um centavo. */
  function chargeFuel(meters) {
    day.distance += meters;
    const due = round2((day.distance / METERS_PER_KM) * cfg.fuelPerKm - day.fuel);
    if (due > 0) charge('fuel', due, 'combustivel');
  }

  function rate(delta) {
    const next = round2(clamp(eco.rating + delta, 0, cfg.maxRating));
    const applied = round2(next - eco.rating);
    if (applied === 0) return;
    eco.rating = next;
    events.emit('rating:changed', { rating: next, delta: applied });
  }

  /** Oferta recusada ou expirada conta contra; só as últimas `acceptanceWindow` valem. */
  function recordOffer(accepted) {
    acceptedCount -= offers[offerIndex];
    offers[offerIndex] = accepted ? 1 : 0;
    acceptedCount += offers[offerIndex];
    offerIndex = (offerIndex + 1) % offers.length;
    eco.acceptance = acceptedCount / offers.length;
  }

  function statement() {
    const net = round2(day.gross + day.tips - day.fuel - day.rent - day.fines);
    const hours = day.seconds * eco.hoursPerSecond;
    return {
      gross: day.gross,
      tips: day.tips,
      fuel: day.fuel,
      rent: day.rent,
      fines: day.fines,
      net,
      hours,
      perHour: hours > 0 ? round2(net / hours) : 0,
      deliveries: day.deliveries,
      late: day.late,
      cancelled: day.cancelled,
      distanceKm: day.distance / METERS_PER_KM,
    };
  }

  /** Tudo o que um dia pode mudar, para recomeçá-lo do zero (`restore`). */
  function snapshot() {
    return { money: eco.money, rating: eco.rating, acceptance: eco.acceptance, offers: offers.slice(), offerIndex, acceptedCount, day: { ...day }, career: { ...career } };
  }

  /** Volta ao `snapshot`, sem emitir eventos: quem chama decide o que avisar. */
  function restore(saved) {
    Object.assign(eco, { money: saved.money, rating: saved.rating, acceptance: saved.acceptance });
    offers.set(saved.offers);
    offerIndex = saved.offerIndex;
    acceptedCount = saved.acceptedCount;
    Object.assign(day, saved.day);
    Object.assign(career, saved.career);
  }

  /** Fecha o dia na carreira e devolve o extrato. */
  function endDay() {
    const result = statement();
    career.days++;
    career.deliveries += day.deliveries;
    career.earned = round2(career.earned + result.net);
    career.seconds += day.seconds;
    return result;
  }

  return eco;
}
