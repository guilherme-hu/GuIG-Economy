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
    street: { lanes: 1, laneWidth: 3.4, speedLimit: kmh(50) },
    avenue: { lanes: 2, laneWidth: 3.3, speedLimit: kmh(70) },
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
    maxSpeed: kmh(95),
    reverseSpeed: kmh(8),
    accel: 7.5, // ~0–60 km/h em 3 s
    brake: 11,
    hardBrake: 19,
    drag: 0.35,
    steerRate: 2.4, // rad/s em baixa velocidade
    steerFullSpeed: 2, // abaixo disso a moto gira menos (parada não gira)
    steerResponse: 7, // quão rápido o guidão segue a tecla
    maxLateralAccel: 13, // limita a curva em alta velocidade (m/s²)
    maxLean: 0.6,
    leanResponse: 3.5,
    radius: 0.55,
    offRoadMargin: 3.2, // calçada: até onde dá para sair do asfalto
    bridgeMargin: 0.4,
    wallBounce: 0.2, // fração da velocidade que sobra numa batida de frente em prédio
    wallHitMinSpeed: 3,
    wallDeflect: 0.12, // rad: desvio do guidão ao raspar na parede
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
    despawn: 320,
    speedVariance: 0.3, // ±30% do limite da via
    runRedShare: 0.1,
    laneChangeShare: 0.15,
    followGap: 5,
    mix: { carro: 0.62, moto: 0.2, onibus: 0.08, caminhao: 0.1 },
  },

  rules: {
    crashSpeed: kmh(20), // velocidade relativa acima disso = fim de jogo
    fineRedLight: 60,
    fineWrongWay: 30,
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
