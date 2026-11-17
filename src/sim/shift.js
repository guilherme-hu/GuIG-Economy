/**
 * O dia de trabalho: relógio do turno, contas do dia e os fins de jogo.
 * O turno só fecha quando o relógio zera *e* não há entrega em andamento.
 * Fins: 'desativado' (nota abaixo do mínimo), 'despejado' (dias seguidos sem pagar as contas), 'acidente' (main.js chama gameOver).
 */
export function createShift({ economy, jobs, events, config: cfg }) {
  const shift = {
    day: 0,
    timeLeft: 0,
    bills: 0, // quanto o entregador precisa tirar no dia para pagar as contas
    missedDays: 0, // dias seguidos sem pagar as contas
    running: false,

    start() {
      shift.day++;
      shift.bills = Math.round(cfg.billsDay1 * (1 + cfg.billsGrowth) ** (shift.day - 1) * 100) / 100;
      shift.timeLeft = cfg.duration;
      shift.running = true;
      economy.startDay();
      jobs.offers.length = 0; // ofertas de ontem não valem mais
      events.emit('shift:start', { day: shift.day, bills: shift.bills });
    },

    step(dt) {
      if (!shift.running) return;
      shift.timeLeft = Math.max(0, shift.timeLeft - dt);
      if (economy.isDeactivated()) return shift.gameOver('desativado');
      if (shift.timeLeft === 0 && !jobs.active) endDay();
    },

    /** Depois do extrato: mais um dia, ou o despejo se as contas atrasaram demais. */
    nextDay() {
      if (shift.missedDays >= cfg.missedDaysToLose) return shift.gameOver('despejado');
      shift.start();
    },

    gameOver(reason) {
      const stats = careerStats();
      shift.running = false;
      events.emit('game:over', { reason, stats });
    },
  };

  function endDay() {
    shift.running = false;
    const statement = economy.endDay();
    const metBills = statement.net >= shift.bills;
    shift.missedDays = metBills ? 0 : shift.missedDays + 1;
    events.emit('shift:end', { day: shift.day, statement, bills: shift.bills, metBills });
  }

  /** Totais da carreira, contando o dia em andamento (se o jogo acabou no meio dele). */
  function careerStats() {
    const { career, day } = economy;
    const today = shift.running ? economy.statement() : null;
    const seconds = career.seconds + (today ? day.seconds : 0);
    const earned = career.earned + (today ? today.net : 0);
    const hours = (seconds * economy.hoursPerSecond) || 0;
    return {
      days: career.days + (today ? 1 : 0),
      deliveries: career.deliveries + (today ? day.deliveries : 0),
      earned,
      perHour: hours > 0 ? earned / hours : 0,
    };
  }

  return shift;
}
