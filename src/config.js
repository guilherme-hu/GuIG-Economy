/**
 * Todos os números de balanceamento do jogo. Nenhum outro arquivo guarda número mágico.
 * Unidades: metros, segundos, m/s, radianos, reais.
 */
const kmh = (v) => v / 3.6;

export const config = {
  seed: 20261116,

  city: {
    size: 1600,
    nodeSpacing: 92,
    jitter: 0.3,
    edgeRemoval: 0.25,
    bridges: 3,
    riverWidth: 46,
    oneWayShare: 0.15, // das ruas do Centro
    signalShareStreets: 0.4, // cruzamentos rua×rua com grau ≥ 3
    restaurants: 14,
    customers: 40,
    street: { lanes: 1, laneWidth: 4.4, speedLimit: kmh(70) }, // largas o bastante para uma moto passar entre os carros
    avenue: { lanes: 2, laneWidth: 4.2, speedLimit: kmh(100) },
    sidewalk: 3.2,

    // Posições em fração de `size` (−0,5 a +0,5), com (0, 0) no meio do mapa.
    river: { startZ: -0.2, endZ: 0.27, meander: 55, waves: 1.6, segments: 40 },
    bankNorth: 26, // da beira d'água ao eixo da marginal
    bankSouth: 26, // da beira d'água ao primeiro cruzamento do lado sul
    diagonals: [
      { from: [-0.46, 0.4], to: [0.44, -0.46] },
      { from: [0, -0.48], to: [0.3, 0.47] },
    ],
    edgeMargin: 40, // faixa livre entre as ruas e a borda do mundo
    avenueClear: 0.42, // em nodeSpacing: a malha não põe cruzamento mais perto que isso de uma avenida
    hookMax: 1.25, // em nodeSpacing: comprimento máximo de uma travessa ligando a malha à avenida
    hookAngle: 0.7, // rad: ângulo mínimo entre a travessa e a avenida

    centro: { x: 0.08, z: -0.15, radius: 0.24, rotation: 0.26, squeeze: 0.16, core: 0.45 },
    industrial: { x: 0.3, z: 0.36, radius: 0.3 },
    jitterScale: { centro: 0.5, bairro: 1, industrial: 0.6 },
    removalScale: { centro: 0.45, bairro: 1.15, industrial: 0.3 }, // multiplica edgeRemoval
    deadEnds: 12, // mínimo de becos sem saída, todos no Bairro

    restaurantsInCentro: 0.75,
    poiSpacing: 30,
    homeFromCentro: 0.3, // em size: distância mínima da casa ao Centro

    lots: {
      setback: 1.5, // recuo entre a calçada e a fachada
      gap: [1.5, 6],
      riverMargin: 4,
      // Frente (w) e fundo (d) de cada tipo de lote, do tamanho dos modelos 3D na escala do jogo.
      predio: { w: [12, 20], d: [13, 17] },
      'arranha-ceu': { w: [18, 21], d: [18, 21] },
      casa: { w: [12, 19], d: [11, 15] },
      galpao: { w: [20, 32], d: [14, 22] },
      praca: { w: [26, 38], d: [24, 32] },
      mix: {
        centro: { predio: 0.96, praca: 0.04 },
        bairro: { casa: 0.88, predio: 0.06, praca: 0.06 },
        industrial: { galpao: 0.92, predio: 0.08 },
      },
      skyscraperShare: 0.5, // dos prédios dentro do miolo do Centro
    },
  },

  bike: {
    maxSpeed: kmh(130),
    reverseSpeed: kmh(8),
    accel: 11, // ~0–60 km/h em 2 s
    brake: 11,
    hardBrake: 19,
    skid: { onsetSpeed: 6, releaseSpeed: 1.5, fullSpeed: 15, maxSlip: 0.44, gripRecovery: 2.5 },
    drag: 0.35,
    steerRate: 3, // rad/s em baixa velocidade
    steerFullSpeed: 2, // abaixo disso a moto gira menos (parada não gira)
    steerResponse: 10, // quão rápido o guidão segue a tecla
    maxLateralAccel: 24, // limita a curva em alta velocidade (m/s²): 60 km/h faz a curva num raio de ~12 m
    maxLean: 0.7, // ~40°: só o visual; a curva é limitada por maxLateralAccel
    leanResponse: 3.5,
    radius: 0.55,
    offRoadMargin: 3.2, // calçada: até onde dá para sair do asfalto
    bridgeMargin: 0.4,
    wallBounce: 0.2, // fração da velocidade que sobra numa batida de frente em prédio
    wallHitMinSpeed: 3,
    wallDeflect: 0.12, // rad por passo: quanto o guidão vira para longe da parede
    sidewalkSpeed: kmh(18), // na calçada a moto não passa disso
    sidewalkBrake: 14,
  },

  autopilot: {
    cruise: 0.9, // fração do limite da via
    lookAhead: 5, // m à frente que ele mira, parado
    lookAheadPerSpeed: 0.55, // + isso × velocidade
    steerGain: 2.4,
    cornerSlowdown: 0.8, // quanto ele reduz ao mirar muito de lado
    cornerAngle: 0.55, // rad de erro de direção em que a redução é total
    brake: 6, // m/s²: desaceleração com que ele planeja curvas e a chegada
    arrive: 2.5, // m: distância do destino em que ele se dá por chegado
    crawl: 2, // m/s: nunca planeja andar mais devagar que isso
    horizon: 140, // m de rota à frente que ele examina
    cornerWindow: 5, // m antes e depois de um ponto usados para medir a curva
    cornerGrip: 4, // m/s²: aceleração lateral que ele aceita numa curva
    turnAroundStart: 2.3, // rad: erro de direção a partir do qual ele faz o retorno
    turnAroundDone: 1.2,
    trackWindow: 4, // trechos da rota à frente considerados ao localizar a moto nela
    trackBias: 1.5, // m: vantagem do trecho mais adiantado nessa escolha
    aimStep: 0.5, // m: passo da busca do ponto de mira
    stallSpeed: 0.3, // m/s: abaixo disso, acelerando, ele se considera encalhado
    stallTime: 0.6, // s encalhado até reagir
    backUpTime: 0.9, // s de ré para desencalhar
    // Comportamento no trânsito (só vale quando o piloto recebe traffic/signals):
    obeyLights: 'sempre', // 'sempre' | 'radar' (fura onde não há radar) | 'nunca'
    stopOnYellow: true, // false = acelera no amarelo e só freia no vermelho
    carLook: 45, // m à frente em que ele procura veículos
    carClearance: 0.6, // m de folga lateral (o raio da moto e um pouco): abaixo disso o veículo está no caminho
    followGap: 3, // m que ele deixa atrás do veículo da frente, parado
    followTime: 1, // s de distância para o veículo da frente, em movimento
    commitDistance: 5, // m antes da linha em que, com o sinal aberto, ele se compromete a passar
    crossSpeed: kmh(30), // velocidade máxima para atravessar um cruzamento
    sampleStep: 1.5, // m entre os pontos da rota em que ele procura veículos
    laneSplit: true, // costura no corredor quando um carro lento bloqueia a faixa
    splitLook: 25, // m à frente em que um carro lento o faz ir para o corredor
    splitLine: 0.5, // m da faixa do meio onde ele passa no corredor
    splitHold: 2, // s que ele fica no corredor depois de passar o último carro
    shiftRate: 2, // m/s de deslocamento lateral ao entrar e sair do corredor
    splitSpeed: kmh(40), // velocidade máxima costurando no corredor
    lineTolerance: 0.3, // m: mais longe que isso da linha que está seguindo, ele ainda está no meio da manobra
    impatience: 6, // s parado atrás de um veículo parado até tentar contornar
    nudgeTime: 3, // s contornando devagar
    nudgeSpeed: kmh(8),
    yieldToTraffic: true, // dá a preferência a quem já está atravessando o cruzamento
    yieldLook: 25, // m antes da linha em que ele começa a olhar o cruzamento
    // Perfis de direção (sobrepõem os valores acima): usados pela simulação e pela flag `?bot=<perfil>`.
    profiles: {
      cauteloso: { laneSplit: false }, // respeita sinal e preferência, anda no limite da via, não costura
      // Jogando bem: rápido, costura no corredor, mas respeita sinal e cruza com cuidado. É a referência de "jogador bom".
      bom: { cruise: 0.9 * 1.15, crossSpeed: kmh(40), followTime: 0.6, cornerGrip: 6, brake: 7.5 },
      apressado: { cruise: 0.9 * 1.4, cornerGrip: 8, brake: 8.4, obeyLights: 'radar', stopOnYellow: false, followGap: 1.5, followTime: 0.4, crossSpeed: kmh(55), splitSpeed: kmh(55) }, // fura onde não há radar e acelera no amarelo
      kamikaze: { cruise: 0.9 * 1.4, cornerGrip: 8, brake: 8.4, obeyLights: 'nunca', yieldToTraffic: false, followGap: 1.5, followTime: 0.3, crossSpeed: Infinity, splitSpeed: kmh(70) },
    },
  },

  signals: {
    green: 9,
    yellow: 3, // o Manual Brasileiro de Sinalização Semafórica recomenda de 3 a 5 s
    allRed: 1,
    offsetStep: 0.618, // defasagem entre nós de ids consecutivos, em fração do ciclo (razão áurea espalha bem)
  },

  traffic: {
    poolSize: 110,
    spawnMin: 90,
    spawnMax: 240,
    spawnTries: 8, // sorteios de via por passo
    spawnClearance: 10, // m livres em volta do ponto de nascimento
    despawn: 320,
    speedVariance: 0.35, // ±35% do limite da via: uns voam, outros empacam
    runRedShare: 0.1, // fração que fura o amarelo
    followGap: 3, // m de folga para o veículo da frente
    lookAhead: 40,
    crawlSpeed: 3, // m/s: abaixo disso conta como parado na linha
    spawnSpan: 0.6, // nasce nos primeiros 60% da via
    junctionSpeed: kmh(30), // velocidade com que atravessam cruzamentos (e dobram esquinas)
    uTurnSpeed: kmh(12), // retorno no fim de um beco sem saída
    rerouteAfter: 3, // s esperando a saída liberar antes de escolher outra rua
    junctionHold: 6, // s em que uma faixa pode mandar carros seguidos num cruzamento
    accel: 5,
    brake: 6, // desaceleração com que planejam a parada
    hardBrake: 12,
    smoothing: 8, // quão rápido a posição desenhada segue a faixa (suaviza as curvas)
    stuckTime: 10,
    patience: 8, // s parado até o motorista deixar de esperar a moto do jogador
    stuckMinDistance: 250,
    playerMargin: 2, // m além do raio do cruzamento em que a moto do jogador conta como "lá dentro"
    playerNear: 10, // m: tão perto assim à frente, a moto do jogador é vista mesmo fora do corredor
    playerSide: 1.5, // m além da lateral do veículo em que a moto conta (não pega a outra mão)
    playerYieldTime: 2.5, // s: quem vai cruzar espera a moto que chega nesse tempo com o sinal aberto // só some longe, fora da vista (além de onde os carros nascem)
    // Outros entregadores: andam acima do limite, costuram no corredor e furam sinal.
    motoShare: 0.22, // fração do trânsito que é moto
    moto: { type: 'moto', model: 'moto', length: 2, width: 0.8, reckless: true },
    motoPace: [1.15, 1.55], // múltiplo do limite da via
    motoRunRed: 0.6, // fração das motos que fura o vermelho
    motoLine: 0.7, // m à direita da faixa pintada: é por ali que elas costuram
    corridorFit: 0.9, // fração da largura somada que conta como "no caminho" (deixa a moto passar raspando)
    fleet: [
      { type: 'carro', model: 'cars/sedan', length: 4.0, width: 1.9 },
      { type: 'carro', model: 'cars/sedan-sports', length: 4.0, width: 1.9 },
      { type: 'carro', model: 'cars/hatchback-sports', length: 3.9, width: 1.9 },
      { type: 'carro', model: 'cars/suv', length: 4.2, width: 2 },
      { type: 'carro', model: 'cars/suv-luxury', length: 4.3, width: 2 },
      { type: 'carro', model: 'cars/taxi', length: 4.2, width: 2 },
      { type: 'carro', model: 'cars/van', length: 4.5, width: 2 },
      { type: 'caminhao', model: 'cars/truck', length: 5.0, width: 2.2 },
      { type: 'caminhao', model: 'cars/delivery', length: 5.8, width: 2.2 },
    ],
  },

  rules: {
    crashSpeed: kmh(40), // impacto acima disso = acidente, fim de jogo
    crashSpeedWhenHit: kmh(60), // quando é o veículo que acerta a moto (ela não estava indo para cima dele)
    damageSpeed: kmh(20), // entre isso e o acidente: a moto quebra e o conserto sai do seu bolso
    repairCost: 30, // manete, retrovisor, pisca: o dano é do entregador mesmo com moto alugada (escala do jogo)
    crashScreenDelay: 2.4, // s de efeito do acidente antes da tela de fim
    repairCooldown: 2, // s: raspar na parede não cobra um conserto por passo
    cameraShare: 0.3, // fração dos cruzamentos com semáforo que têm radar
    cameraFreeNearHome: 150, // m: os primeiros semáforos saindo de casa nunca têm radar (não começar o dia parado por medo da multa)
    cameraWarnDistance: 180, // m: o GPS avisa do radar a partir daqui
    cameraWarnCone: 0.8, // cosseno do ângulo à frente em que o radar conta
    // Multas a 1/10 do valor real do CTB (2025), mantendo a proporção entre elas: gravíssima = R$ 293,47; calçada, ×3.
    // No valor real, uma multa apagaria dias de trabalho e o jogo acabaria na primeira; a 1/10, ela come o lucro do dia.
    fineRedLight: 29.35, // art. 208 (real: R$ 293,47)
    fineWrongWay: 29.35, // art. 186, II (real: R$ 293,47)
    fineMinSpeed: 2, // m/s: abaixo disso não conta como furar sinal nem contramão
    wrongWayGrace: 1.5,
    bumpKeep: 0.4, // fração da velocidade que sobra num toque leve em veículo
    fineSidewalk: 88.04, // art. 193 (real: R$ 880,41)
    sidewalkGrace: 3, // segundos na calçada antes da multa (contador na tela)
    sidewalkCooldown: 8, // intervalo mínimo entre multas de calçada
  },

  // Valores reais (2025): iFood paga no mínimo R$ 7,50 por rota de moto até 4 km e R$ 1,50 por km adicional.
  // A cidade do jogo é uma miniatura: 1 km do jogo vale `kmScale` km de verdade (uma entrega típica real tem ~3 km).
  jobs: {
    offerCount: 3,
    offerLifetime: 12,
    minPay: 7.5,
    payPerKm: 2.5, // o iFood paga R$ 1,50; usamos os R$ 2,50 reivindicados na greve de 2025, para a longa valer a pena
    freeKm: 4, // km reais cobertos pelo mínimo
    kmScale: 3,
    bands: [
      { name: 'curta', share: 0.45, min: 300, max: 900 },
      { name: 'media', share: 0.35, min: 900, max: 1800 },
      { name: 'longa', share: 0.2, min: 1800, max: 3600 },
    ],
    restaurantChoices: 3, // o app oferece restaurantes entre os mais próximos
    customerTries: 6,
    surgeChance: 0.2,
    surgeMax: 1.4,
    surgeBadge: 1.15,
    pickupStopTime: 1.5,
    stopSpeed: kmh(5),
    stopRadius: 9, // cobre o marcador do outro lado de uma avenida larga
    deadlineBuffer: 45,
    refSpeedShort: kmh(20), // corridas curtas: prazo folgado (velocidade média no trânsito, com sinais)
    refSpeedLong: kmh(28), // corridas longas: prazo apertado
    refDistanceShort: 600,
    refDistanceLong: 2600,
    maxTipShare: 0.3,
    cancelAfterLate: 60,
  },

  economy: {
    startMoney: 0,
    startRating: 4.8,
    maxRating: 5,
    minRating: 4.2,
    ratingOnTime: 0.03,
    ratingLateMin: 0.05, // a nota é uma média: uma entrega ruim pesa pouco, várias derrubam
    ratingLateMax: 0.2,
    ratingCancelled: 0.25,
    acceptanceFloor: 0.5, // abaixo disso o app esconde as ofertas boas
    acceptanceWindow: 10,
    fuelPerKm: 0.6, // por km do jogo: ~R$ 0,20 por km real (gasolina + manutenção) × jobs.kmScale
    bikeRentPerDay: 25, // aluguel de moto para entregador: a partir de R$ 175 por semana (Mottu) ÷ 7
    // R$/hora do extrato: um turno (shift.duration segundos de jogo) representa uma jornada de shiftHours horas
    // reais. Entregadores trabalham em média menos de 4 h por dia (Cebrap): 15 min de jogo = 3 h 45 min,
    // e 1 min de jogo ≈ 15 min reais. Assim o bruto por hora de quem joga bem (R$ 25–33/h) bate com o real (R$ 28–31/h).
    shiftHours: 3.75,
    get shiftDuration() {
      return config.shift.duration;
    },
    // atraso (s) em que a perda de nota chega a ratingLateMax; além disso o pedido é cancelado
    get ratingLateFullAt() {
      return config.jobs.cancelAfterLate;
    },
  },

  shift: {
    duration: 900,
    billsDay1: 46.8, // salário mínimo líquido de 2025 (R$ 1.518 − 7,5% de INSS = R$ 1.404,15) ÷ 30 dias
    billsGrowth: 0.03, // as contas apertam a cada dia
    missedDaysToLose: 2,
  },

  // Valores de fora do jogo, para o extrato e o fim de jogo compararem (fontes em docs/valores-e-fontes.md).
  reality: {
    fines: { sinal: 293.47, contramao: 293.47, calcada: 880.41 }, // valor real de cada multa do jogo (CTB)
    grossPerHour: 28, // R$/h bruto médio de um entregador (iFood, 2024): converte multa em horas de trabalho
    minimumWage: 1518, // salário mínimo de 2025, por mês
    monthlyHours: 220, // jornada de 44 h semanais
  },
};
