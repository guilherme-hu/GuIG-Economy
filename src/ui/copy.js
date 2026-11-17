/**
 * Todos os textos do jogo, num lugar só.
 * Voz do Rapidão: corporativa e falsamente animada. A crítica vem do contraste
 * entre o tom e a regra, nunca de sermão.
 */
import { money, rating, clock } from './format.js';

export const copy = {
  game: {
    title: 'GuIG Economy',
    subtitle: 'Um dia de trabalho na economia dos aplicativos.',
  },

  brand: {
    name: 'Rapidão',
    pitchTitle: 'Você é seu próprio chefe! 🚀',
    pitchText: 'Faça seus horários, escolha suas corridas e ganhe por entrega.*',
    pitchFootnote:
      '*Ganhos sujeitos à sua nota, à sua taxa de aceitação e à demanda. Combustível, aluguel da moto, multas e acidentes ficam por sua conta.',
  },

  controls: {
    title: 'Controles',
    items: [
      { keys: ['W', 'S'], alt: ['↑', '↓'], label: 'Acelerar e frear' },
      { keys: ['A', 'D'], alt: ['←', '→'], label: 'Virar' },
      { keys: ['Espaço'], label: 'Freio forte' },
      { keys: ['Tab'], alt: ['E'], label: 'Abrir o celular' },
      { keys: ['1', '2', '3'], label: 'Aceitar oferta' },
      { keys: ['Q'], label: 'Trocar de aba no celular' },
      { keys: ['H'], label: 'Buzina' },
      { keys: ['Esc'], label: 'Pausar' },
    ],
    or: 'ou',
  },

  menu: {
    start: 'Começar o turno',
    hint: 'Enter',
    goal: 'Entregue no prazo, pague as contas do dia e não perca a conta.',
  },

  pause: {
    title: 'Jogo pausado',
    text: 'O turno espera por você. As contas, não.',
    resume: 'Voltar ao turno',
    restart: 'Recomeçar do dia 1',
  },

  hud: {
    speedUnit: 'km/h',
    shift: 'Turno',
    phase: { coleta: 'Coleta', entrega: 'Entrega' },
    late: 'Atrasado',
    turn: {
      esquerda: 'Vire à esquerda',
      direita: 'Vire à direita',
      reto: 'Siga em frente',
      retorno: 'Faça o retorno',
      chegada: 'Destino à frente',
    },
    in: 'em',
    remaining: (dist) => `${dist} até o destino`,
    arriving: 'Pare no marcador',
  },

  phone: {
    closed: { label: 'Rapidão', open: 'Abrir', close: 'Guardar', key: 'Tab' },
    newOffers: (n) => (n === 1 ? '1 oferta nova' : `${n} ofertas novas`),
    online: 'Online',
    shift: 'Turno',
    tabs: { ofertas: 'Ofertas', corrida: 'Corrida', carteira: 'Carteira' },

    offers: {
      title: 'Corridas para você',
      surge: '🔥 Alta demanda',
      to: 'Entregar para',
      deadline: 'prazo',
      accept: 'Aceitar',
      decline: 'Recusar',
      expires: (s) => `Você tem ${s} s para aceitar`,
      busy: 'Termine a entrega atual para aceitar outra.',
      emptyTitle: 'Procurando corridas…',
      emptyText: 'Continue online! Tempo de espera não é remunerado. 😉',
    },

    ride: {
      phaseColeta: 'Indo coletar',
      phaseEntrega: 'Indo entregar',
      stepColeta: 'Coleta',
      stepEntrega: 'Entrega',
      timeLeft: 'Tempo restante',
      late: 'Atrasado',
      lateHint: 'Atrasos afetam sua nota. Você consegue! 💪',
      cancelHint: 'Com mais de 1 min de atraso, o pedido é cancelado sem pagamento.',
      pay: 'Você recebe',
      remaining: 'Faltam',
      pickupAt: 'Retirar em',
      deliverTo: 'Entregar para',
      emptyTitle: 'Nenhuma corrida em andamento',
      emptyText: 'Parado você não ganha. Aceite uma oferta!',
      emptyAction: 'Ver ofertas',
    },

    wallet: {
      netLabel: 'Líquido parcial de hoje',
      deliveries: (n) => (n === 1 ? '1 entrega' : `${n} entregas`),
      late: (n) => (n === 1 ? '1 atrasada' : `${n} atrasadas`),
      rows: {
        gross: 'Corridas',
        tips: 'Gorjetas',
        fuel: 'Combustível',
        rent: 'Aluguel da moto',
        fines: 'Multas',
      },
      billsTitle: 'Contas do dia',
      billsLeft: (v) => `Faltam ${money(v)}`,
      billsMet: 'Meta batida! 🎉',
      reputation: 'Sua reputação',
      ratingLabel: 'Nota',
      ratingMin: (min) => `Mínimo para continuar ativo: ${rating(min)}`,
      ratingRisk: 'Sua conta está em risco. Continue se esforçando!',
      acceptance: 'Taxa de aceitação',
      acceptanceOk: 'Aceite mais corridas para ver ofertas melhores.',
      acceptanceLow: 'Você está vendo menos ofertas. Aceite mais! 😉',
    },
  },

  /** Notificações prontas: main.js passa o resultado para phone.notify(). */
  notify: {
    fineRedLight: (amount) => ({
      kind: 'multa',
      title: `Multa: ${money(amount)}`,
      text: 'Avanço de sinal vermelho. O valor já saiu do seu saldo.',
    }),
    fineWrongWay: (amount) => ({
      kind: 'multa',
      title: `Multa: ${money(amount)}`,
      text: 'Contramão. O valor já saiu do seu saldo.',
    }),
    tip: (amount) => ({
      kind: 'gorjeta',
      title: `Gorjeta de ${money(amount)}! 🎉`,
      text: 'O cliente adorou a rapidez. Continue assim!',
    }),
    payment: (amount) => ({
      kind: 'pagamento',
      title: `Você recebeu ${money(amount)}`,
      text: 'Entrega concluída. Já tem mais corridas esperando!',
    }),
    ratingDown: (value) => ({
      kind: 'nota',
      title: `Sua nota caiu para ${rating(value)}`,
      text: 'Continue se esforçando! 💪',
    }),
    ratingUp: (value) => ({
      kind: 'nota',
      title: `Sua nota subiu para ${rating(value)} ⭐`,
      text: 'Clientes felizes, parceiro feliz!',
    }),
    late: (seconds) => ({
      kind: 'nota',
      title: `Entrega com ${clock(seconds)} de atraso`,
      text: 'Sem gorjeta desta vez. Atrasos afetam sua nota.',
    }),
    cancelled: () => ({
      kind: 'multa',
      title: 'Pedido cancelado',
      text: 'O atraso passou do limite. Esta corrida não será paga.',
    }),
    pickup: (customer) => ({
      kind: 'info',
      title: 'Pedido coletado',
      text: `Agora é só entregar para ${customer}. O relógio continua!`,
    }),
    offerExpired: () => ({
      kind: 'info',
      title: 'Oferta expirada',
      text: 'Isso reduz sua taxa de aceitação. Fique de olho! 👀',
    }),
    lowAcceptance: () => ({
      kind: 'info',
      title: 'Sua taxa de aceitação está baixa',
      text: 'Parceiros que aceitam mais veem ofertas melhores.',
    }),
    shiftStart: () => ({
      kind: 'info',
      title: 'Você está online! 🚀',
      text: 'Você é seu próprio chefe. Boas entregas!',
    }),
  },

  statement: {
    eyebrow: (day) => `Extrato do dia ${day}`,
    title: 'Parabéns pelo seu dia! 🎉',
    receiptTitle: 'Resumo de ganhos',
    receiptDay: (day) => `Dia ${day}`,
    rows: {
      gross: 'Corridas',
      tips: 'Gorjetas',
      fuel: 'Combustível',
      rent: 'Aluguel da moto',
      fines: 'Multas',
    },
    net: 'Líquido do dia',
    deliveries: 'Entregas',
    late: 'Com atraso',
    hours: 'Horas trabalhadas',
    perHourLabel: 'Você ganhou por hora',
    perHourUnit: '/hora',
    perHourNote: 'Você é seu próprio chefe! 🚀',
    billsTitle: 'Contas do dia',
    billsMetTag: 'Meta batida',
    billsMissedTag: 'Meta não batida',
    billsMet: 'Contas pagas. Amanhã elas voltam um pouco maiores!',
    billsMissed: (missing) => `Faltaram ${money(missing)}. Que tal ficar mais tempo online amanhã? 😉`,
    evictionWarning: 'Dois dias seguidos sem bater a meta e você é despejado.',
    footnote:
      'O Rapidão é uma plataforma de tecnologia. Combustível, aluguel, multas e riscos são de responsabilidade do parceiro.',
    next: 'Começar o próximo dia',
  },

  gameOver: {
    from: 'Mensagem do Rapidão',
    acidente: {
      tag: 'Acidente',
      title: 'Você sofreu um acidente',
      message: 'O Rapidão lamenta o ocorrido e informa que você não possui vínculo com a plataforma.',
      aside: 'Seu pedido foi repassado a outro parceiro. Boa recuperação! 💚',
    },
    desativado: {
      tag: 'Conta desativada',
      title: 'Sua conta foi desativada',
      message: 'Sua nota ficou abaixo do mínimo exigido. A decisão é automática e definitiva.',
      aside: 'Agradecemos pelo tempo em que você foi seu próprio chefe! 🚀',
    },
    despejado: {
      tag: 'Despejado',
      title: 'Você foi despejado',
      message: 'Notamos que você não bateu suas metas. Parceiros que ficam mais tempo online ganham mais!',
      aside: 'Dois dias sem pagar as contas. O aplicativo segue disponível para você. 😉',
    },
    stats: {
      days: 'Dias trabalhados',
      deliveries: 'Entregas',
      earned: 'Total recebido',
      perHour: 'Média por hora',
    },
    restart: 'Tentar de novo',
  },
};
