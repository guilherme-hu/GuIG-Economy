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
    street: { lanes: 1, laneWidth: 3.4, speedLimit: kmh(70) },
    avenue: { lanes: 2, laneWidth: 3.3, speedLimit: kmh(100) },
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
    drag: 0.35,
    steerRate: 2.4, // rad/s em baixa velocidade
    steerFullSpeed: 2, // abaixo disso a moto gira menos (parada não gira)
    steerResponse: 7, // quão rápido o guidão segue a tecla
    maxLateralAccel: 16, // limita a curva em alta velocidade (m/s²)
    maxLean: 0.6,
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
  },

  signals: {
    green: 9,
    yellow: 2.2,
    allRed: 1,
    offsetStep: 0.618, // defasagem entre nós de ids consecutivos, em fração do ciclo (razão áurea espalha bem)
  },

  traffic: {
    poolSize: 50,
    spawnMin: 120,
    spawnMax: 260,
    spawnTries: 3, // sorteios de via por passo
    spawnClearance: 15, // m livres em volta do ponto de nascimento
    despawn: 320,
    speedVariance: 0.35, // ±35% do limite da via: uns voam, outros empacam
    runRedShare: 0.1, // fração que fura o amarelo
    followGap: 3, // m de folga para o veículo da frente
    lookAhead: 40,
    crawlSpeed: 3, // m/s: abaixo disso conta como parado na linha
    spawnSpan: 0.6, // nasce nos primeiros 60% da via
    junctionSpeed: kmh(45), // velocidade com que atravessam cruzamentos
    accel: 5,
    brake: 6, // desaceleração com que planejam a parada
    hardBrake: 12,
    smoothing: 8, // quão rápido a posição desenhada segue a faixa (suaviza as curvas)
    stuckTime: 10,
    stuckMinDistance: 40,
    fleet: [
      { type: 'carro', model: 'cars/sedan', length: 4.0, width: 2.2 },
      { type: 'carro', model: 'cars/sedan-sports', length: 4.0, width: 2.2 },
      { type: 'carro', model: 'cars/hatchback-sports', length: 3.9, width: 2.2 },
      { type: 'carro', model: 'cars/suv', length: 4.2, width: 2.3 },
      { type: 'carro', model: 'cars/suv-luxury', length: 4.3, width: 2.3 },
      { type: 'carro', model: 'cars/taxi', length: 4.2, width: 2.3 },
      { type: 'carro', model: 'cars/van', length: 4.5, width: 2.4 },
      { type: 'caminhao', model: 'cars/truck', length: 5.0, width: 2.4 },
      { type: 'caminhao', model: 'cars/delivery', length: 5.8, width: 2.5 },
    ],
  },

  rules: {
    crashSpeed: kmh(40), // impacto acima disso = acidente, fim de jogo
    damageSpeed: kmh(20), // entre isso e o acidente: a moto quebra e o conserto sai do seu bolso
    repairCost: 35,
    crashScreenDelay: 2.4, // s de efeito do acidente antes da tela de fim
    repairCooldown: 2, // s: raspar na parede não cobra um conserto por passo
    cameraShare: 0.3, // fração dos cruzamentos com semáforo que têm radar
    cameraWarnDistance: 180, // m: o GPS avisa do radar a partir daqui
    cameraWarnCone: 0.8, // cosseno do ângulo à frente em que o radar conta
    fineRedLight: 60,
    fineWrongWay: 30,
    fineMinSpeed: 2, // m/s: abaixo disso não conta como furar sinal nem contramão
    wrongWayGrace: 1.5,
    bumpKeep: 0.4, // fração da velocidade que sobra num toque leve em veículo
    fineSidewalk: 45,
    sidewalkGrace: 3, // segundos na calçada antes da multa (contador na tela)
    sidewalkCooldown: 8, // intervalo mínimo entre multas de calçada
  },

  jobs: {
    offerCount: 3,
    offerLifetime: 12,
    basePay: 4.5,
    payPerKm: 1.6,
    surgeMin: 0.8,
    surgeMax: 1.6,
    surgeBadge: 1.3,
    pickupStopTime: 1.5,
    stopSpeed: kmh(5),
    stopRadius: 7,
    deadlineBuffer: 20,
    refSpeedShort: kmh(35), // corridas curtas: prazo folgado
    refSpeedLong: kmh(55), // corridas longas: prazo apertado
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
    ratingLateMin: 0.1,
    ratingLateMax: 0.5,
    ratingCancelled: 0.5,
    acceptanceFloor: 0.5, // abaixo disso o app esconde as ofertas boas
    acceptanceWindow: 10,
    fuelPerKm: 0.35,
    bikeRentPerDay: 40,
    // R$/hora do extrato: um turno (shift.duration segundos de jogo) representa uma jornada de
    // shiftHours horas reais, para o número ser comparável com a vida real.
    shiftHours: 10,
    get shiftDuration() {
      return config.shift.duration;
    },
    // atraso (s) em que a perda de nota chega a ratingLateMax; além disso o pedido é cancelado
    get ratingLateFullAt() {
      return config.jobs.cancelAfterLate;
    },
  },

  shift: {
    duration: 360,
    billsDay1: 90,
    billsGrowth: 0.15,
    missedDaysToLose: 2,
  },
};
