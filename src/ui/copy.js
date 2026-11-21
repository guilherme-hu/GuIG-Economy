/**
 * Todos os textos do jogo, num lugar só.
 * Voz do Rapidão: curta, cordial e corporativa, como um app de entrega de verdade. Sem emojis.
 * A crítica vem do contraste entre o tom e a regra, nunca de sermão.
 */
import { money, rating, clock } from './format.js';

export const copy = {
  game: {
    title: 'GuIG Economy',
    subtitle: 'Um dia de trabalho na economia dos aplicativos.',
  },

  brand: {
    name: 'Rapidão',
    pitchTitle: 'Ganhe no seu tempo. Seja seu próprio chefe.',
    pitchText: 'Faça seus horários, escolha suas corridas e receba por entrega.*',
    perks: ['Sem patrão', 'Horário livre', 'Saque na hora'],
    pitchFootnote:
      '*Ganhos sujeitos à sua nota, à taxa de aceitação e à demanda. Combustível, aluguel da moto, multas e acidentes por sua conta.',
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
      { keys: ['M'], label: 'Som liga/desliga' },
      { keys: ['Esc'], label: 'Pausar' },
    ],
    or: 'ou',
  },

  menu: {
    start: 'Começar o turno',
    hint: 'Enter',
    goal: 'Entregue no prazo, pague as contas do dia e não perca a conta.',
    keyboardTitle: 'Este jogo precisa de teclado',
    keyboardText: 'A moto é pilotada pelas teclas. Abra este link num computador para jogar.',
  },

  pause: {
    title: 'Pausado',
    text: 'O turno espera. As contas, não.',
    resume: 'Voltar ao turno',
    restart: 'Recomeçar o dia',
    toMenu: 'Sair para o menu',
    toMenuNote: 'Recomeçar volta ao início deste dia, com o dinheiro e a nota de antes. Sair para o menu recomeça no dia 1.',
  },

  settings: {
    open: 'Configurações',
    title: 'Configurações',
    text: 'Gráficos mais leves deixam o jogo mais fluido em computadores modestos.',
    back: 'Voltar',
    options: [
      { name: 'sound', label: 'Som', choices: [['on', 'Ligado'], ['off', 'Desligado']] },
      { name: 'shadows', label: 'Sombras', choices: [['on', 'Ligadas'], ['off', 'Desligadas']] },
      { name: 'resolution', label: 'Resolução', choices: [['alta', 'Alta'], ['leve', 'Leve']] },
      { name: 'fps', label: 'Limite de quadros', choices: [['30', '30 fps'], ['60', '60 fps'], ['0', 'Sem limite']] },
    ],
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
      surge: 'Alta demanda',
      to: 'Entregar para',
      deadline: 'prazo',
      accept: 'Aceitar',
      decline: 'Recusar',
      expires: (s) => `Você tem ${s} s para aceitar`,
      busy: 'Termine a entrega atual para aceitar outra.',
      emptyTitle: 'Procurando corridas',
      emptyText: 'Fique online. O tempo de espera não é pago.',
    },

    ride: {
      phaseColeta: 'Indo coletar',
      phaseEntrega: 'Indo entregar',
      stepColeta: 'Coleta',
      stepEntrega: 'Entrega',
      timeLeft: 'Tempo restante',
      late: 'Atrasado',
      lateHint: 'Atrasos derrubam sua nota.',
      cancelHint: 'Com mais de 1 min de atraso, o pedido é cancelado sem pagamento.',
      pay: 'Você recebe',
      remaining: 'Faltam',
      pickupAt: 'Retirar em',
      deliverTo: 'Entregar para',
      emptyTitle: 'Nenhuma corrida em andamento',
      emptyText: 'Parado, você não ganha. Aceite uma oferta.',
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
      billsMet: 'Contas do dia pagas',
      reputation: 'Sua reputação',
      ratingLabel: 'Nota',
      ratingMin: (min) => `Mínimo para continuar ativo: ${rating(min)}`,
      ratingRisk: 'Sua conta está em risco de desativação.',
      acceptance: 'Taxa de aceitação',
      acceptanceOk: 'Aceite mais corridas para ver ofertas melhores.',
      acceptanceLow: 'Você está vendo menos ofertas. Aceite mais.',
    },
  },

  /** Notificações prontas: main.js passa o resultado para phone.notify(). */
  warning: {
    radar: { title: 'Radar à frente', hint: 'Sinal vermelho aqui dá multa' },
    calcada: { title: 'Na calçada!', hint: 'Infração de trânsito: multa em' },
  },

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
    fineSidewalk: (amount) => ({
      kind: 'multa',
      title: `Multa: ${money(amount)}`,
      text: 'Trânsito na calçada. O valor já saiu do seu saldo.',
    }),
    repair: (amount) => ({
      kind: 'multa',
      title: `Conserto: ${money(amount)}`,
      text: 'Você danificou a moto. O conserto é por sua conta.',
    }),
    tip: (amount) => ({
      kind: 'gorjeta',
      title: `Gorjeta de ${money(amount)}`,
      text: 'O cliente gostou da rapidez.',
    }),
    payment: (amount) => ({
      kind: 'pagamento',
      title: `Você recebeu ${money(amount)}`,
      text: 'Entrega concluída. Já tem corrida esperando.',
    }),
    ratingDown: (value) => ({
      kind: 'nota',
      title: `Sua nota caiu para ${rating(value)}`,
      text: 'Entregas atrasadas afetam sua avaliação.',
    }),
    ratingUp: (value) => ({
      kind: 'nota',
      title: `Sua nota subiu para ${rating(value)}`,
      text: 'Clientes satisfeitos avaliam melhor.',
    }),
    late: (seconds) => ({
      kind: 'nota',
      title: `Entrega com ${clock(seconds)} de atraso`,
      text: 'Sem gorjeta. Atrasos derrubam sua nota.',
    }),
    cancelled: () => ({
      kind: 'multa',
      title: 'Pedido cancelado',
      text: 'O atraso passou do limite. Esta corrida não será paga.',
    }),
    pickup: (customer) => ({
      kind: 'info',
      title: 'Pedido coletado',
      text: `Agora entregue para ${customer}. O relógio continua correndo.`,
    }),
    offerExpired: () => ({
      kind: 'info',
      title: 'Oferta expirada',
      text: 'Isso reduz sua taxa de aceitação.',
    }),
    sound: (muted) => ({
      kind: 'info',
      title: muted ? 'Som desligado' : 'Som ligado',
      text: 'Aperte M para trocar.',
    }),
    lowAcceptance: () => ({
      kind: 'info',
      title: 'Sua taxa de aceitação está baixa',
      text: 'Parceiros que aceitam mais veem ofertas melhores.',
    }),
    shiftStart: () => ({
      kind: 'info',
      title: 'Você está online',
      text: 'Boas entregas.',
    }),
  },

  statement: {
    eyebrow: 'Seus ganhos de hoje',
    title: 'Turno encerrado',
    receiptDay: (day) => `Dia ${day}`,
    rows: {
      gross: 'Corridas',
      tips: 'Gorjetas',
      fuel: 'Combustível',
      rent: 'Aluguel da moto',
      fines: 'Multas',
    },
    net: 'Líquido do dia',
    deliveries: (n) => (n === 1 ? '1 entrega' : `${n} entregas`),
    late: (n) => (n === 1 ? '1 atrasada' : `${n} atrasadas`),
    perHourLabel: 'Por hora',
    billsTitle: 'Contas do dia',
    billsMetTag: 'Pagas',
    billsMissedTag: (missing) => `Faltaram ${money(missing)}`,
    billsMet: 'Aluguel, comida e luz pagos. Amanhã as contas sobem um pouco.',
    billsMissed: 'Aluguel, comida e luz. Amanhã as contas sobem um pouco.',
    evictionWarning: 'Mais um dia sem pagar as contas e você é despejado.',
    minimumWage: (perHour) => `Salário mínimo: ${money(perHour)}/h`,
    realFines: (real, hours) => `Fora do jogo, essas multas custariam ${money(real)}, cerca de ${hours === 1 ? '1 hora' : `${hours} horas`} de corridas.`,
    footnote:
      'O Rapidão é uma plataforma de tecnologia. Combustível, aluguel, multas e riscos são de responsabilidade do parceiro.',
    next: 'Começar o próximo dia',
  },

  gameOver: {
    acidente: {
      tag: 'Acidente',
      title: 'Você sofreu um acidente',
      message: 'O Rapidão lamenta o ocorrido e lembra que você não tem vínculo com a plataforma.',
      aside: 'Seu pedido foi repassado a outro parceiro.',
      reality: 'Fora do jogo, sem vínculo de emprego não há salário nem estabilidade durante a recuperação: só o seguro que a plataforma decide oferecer, nas regras dela.',
    },
    desativado: {
      tag: 'Conta desativada',
      title: 'Sua conta foi desativada',
      message: 'Sua avaliação ficou abaixo do mínimo de 4,20. A decisão é automática.',
      aside: 'Não cabe recurso.',
      reality: 'Fora do jogo, bloqueios por nota ou por regra do app costumam ser automáticos, e o entregador quase nunca sabe ao certo o motivo.',
    },
    despejado: {
      tag: 'Despejado',
      title: 'Você foi despejado',
      message: 'Dois dias seguidos sem pagar as contas.',
      aside: 'Parceiros que ficam mais tempo online ganham mais. O aplicativo segue disponível para você.',
      reality: 'Fora do jogo, para tirar um salário mínimo o entregador precisa de pelo menos uma entrega por hora, por mais de 44 horas na semana (ANPET).',
    },
    stats: {
      days: 'Dias trabalhados',
      deliveries: 'Entregas',
      earned: 'Total recebido',
      perHour: 'Média por hora',
    },
    toMenu: 'Voltar ao menu',
  },

  // Introdução antes do primeiro turno (ui/intro.js). Valores do jogo chegam de config.js por `v`;
  // os de fora do jogo, com fonte em docs/valores-e-fontes.md, ficam escritos aqui.
  intro: {
    skip: 'Pular',
    next: 'Continuar',
    done: 'Começar',
    count: (n, total) => `${n} de ${total}`,
    review: 'Rever a introdução',
    slides: (v) => [
      {
        title: 'Este é você',
        text: `Você mora de aluguel, e a moto também é alugada: ${money(v.rentPerWeek)} por semana. O Rapidão é a sua renda principal.`,
      },
      {
        title: 'Como o app paga',
        text: `${money(v.minPay)} por entrega de até ${v.freeKm} km e ${money(v.payPerKm)} por km a mais. Esperar oferta não paga nada. Ir até o restaurante também não.`,
      },
      {
        title: 'Quanto isso dá',
        text: 'Fora do jogo, um entregador fatura de R$ 28 a R$ 31 por hora, bruto, em jornadas de menos de 4 horas por dia (Cebrap). Combustível e moto saem desse valor.',
      },
      {
        title: 'O que você precisa',
        text: `${money(v.bills)} por dia, já descontados os custos: é o salário mínimo líquido dividido por 30. Abaixo disso, o aluguel atrasa.`,
      },
      {
        title: 'O que pode dar errado',
        text: 'Uma multa por sinal vermelho custa R$ 293,47, cerca de 10 horas de trabalho. No jogo ela vale um décimo disso. Um acidente encerra tudo, e você não tem vínculo com a plataforma.',
      },
      {
        title: 'Por que a pressa',
        text: `O prazo é curto, a gorjeta depende de chegar antes e a nota cai com cada atraso. Abaixo de ${rating(v.minRating)}, a conta é desativada.`,
      },
      {
        title: 'Seu turno começa agora.',
        text: 'Fique online, aceite uma corrida e boa entrega.',
      },
    ],
  },
};
