/**
 * Todos os números de balanceamento do jogo. Nenhum outro arquivo guarda número mágico.
 * Unidades: metros, segundos, m/s, radianos, reais.
 */
const kmh = (v) => v / 3.6;

export const config = {
  seed: 20261116,

  city: {
    size: 1600,
    margin: 45, // nenhum nó fica mais perto que isso da borda do mapa
    nodeSpacing: 92,
    jitter: 0.3, // fração do espaçamento; cada distrito aplica o seu multiplicador
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
    maxAttempts: 12, // tentativas de geração antes de desistir (cada uma com sub-seed própria)

    // Posições em fração de `size` (o mundo vai de -0.5 a +0.5).
    river: { from: { x: -0.5, z: 0.4 }, to: { x: 0.5, z: -0.1 }, amplitude: 34, waves: 1.4, waveVariance: 0.2, samples: 48, overshoot: 2 },
    riverBank: 14, // distância mínima do eixo de uma rua comum até a água
    bankClearance: 45, // nós de rua ficam a pelo menos isso da água
    marginalSetback: 30, // eixo da marginal até a água; as pontes pousam à mesma distância na outra margem
    bridgeEdgeMargin: 60, // ponte de rua não nasce mais perto que isso da borda do mapa
    centro: { center: { x: -0.045, z: -0.005 }, radius: 0.22, wobble: 0.12, lobes: 3 },
    avenues: [
      { from: { x: 0.03, z: -0.5 }, to: { x: -0.17, z: 0.5 } },
      { from: { x: -0.5, z: -0.195 }, to: { x: 0.5, z: 0.165 } },
    ],
    avenueJitter: 0.02, // fração de `size` nas pontas das diagonais
    avenueBend: 30, // flecha máxima da curva das diagonais
    avenueSamples: 64,
    avenueWobble: 2.5, // desalinho lateral dos nós de avenida
    avenueClearance: 0.5, // × espaçamento do distrito: nós de rua ficam a pelo menos isso de uma avenida
    minSection: 60, // ponta de avenida mais curta que isso é aparada
    districts: {
      // spacing × nodeSpacing; jitter × jitter global; warp = ondulação da grade (amplitude e comprimento em espaçamentos)
      centro: { spacing: 0.75, jitter: 0.3, rotation: -0.26, warp: 0, warpLength: 1, removal: 0.3, deadEnds: false, maxEdge: 1.9 },
      bairro: { spacing: 1.04, jitter: 1, rotation: 0.05, warp: 0.4, warpLength: 6, removal: 1, deadEnds: true, maxEdge: 1.8 },
      industrial: { spacing: 1.8, jitter: 0.5, rotation: -0.46, warp: 0, warpLength: 1, removal: 0.8, deadEnds: true, maxEdge: 1.7 },
    },
    minNodeGap: 0.55, // × espaçamento do distrito
    diagonalRatio: 1.15, // maior lado de um triângulo acima disso × o segundo maior = diagonal de quarteirão, some
    minEdge: 40,
    minAngle: 0.52, // ~30°: abaixo disso uma das duas ruas é removida
    nodeClearance: 16, // rua não passa mais perto que isso de um cruzamento que não é dela
    riverSampleStep: 8,
    minDeadEnds: 10,
    maxDeadEnds: 16, // a remoção ao acaso para de criar becos depois disso
    viaMaxTurn: 0.6, // trechos que viram menos que isso no nó são a mesma rua
    alamedaShare: 0.15, // das vias do Bairro
    nodeMargin: 1.5, // folga do raio do cruzamento
    deadEndRadius: 7, // balão de retorno

    poiNodeClearance: 15,
    poiRadiusMargin: 2,
    poiGap: 28,
    poiTries: 200,
    restaurantShare: { centro: 0.7, bairro: 0.2, industrial: 0.1 },
    customerShare: { centro: 0.3, bairro: 0.45, industrial: 0.25 },

    lots: {
      setback: 0.4, // depois da calçada
      rowGap: 2,
      step: 4, // avanço ao longo da rua quando o lote não cabe
      riverBank: 4,
      mapBorder: 4,
      minGap: 0.6, // entre lotes de ruas diferentes
      cellSize: 64,
      // w = frente (ao longo da rua), d = profundidade; `core` = mais provável perto do miolo do Centro
      districts: {
        centro: {
          rows: 3, gap: 1.2, rowDepth: 22,
          kinds: [
            { kind: 'predio', share: 0.8, w: [14, 22], d: [14, 22] },
            { kind: 'arranha-ceu', share: 0.2, w: [22, 28], d: [22, 28], core: true },
          ],
        },
        bairro: {
          rows: 3, gap: 3, rowDepth: 14,
          kinds: [
            { kind: 'casa', share: 0.95, w: [10, 14], d: [10, 14] },
            { kind: 'praca', share: 0.05, w: [22, 34], d: [18, 28], frontOnly: true },
          ],
        },
        industrial: {
          rows: 2, gap: 6, rowDepth: 40,
          kinds: [{ kind: 'galpao', share: 1, w: [24, 40], d: [24, 40] }],
        },
      },
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

  // Tudo que é visual: paletas das três horas do turno, luz, sombra, neblina, bloom.
  render: {
    pixelRatioMax: 2,
    msaa: 4, // amostras do alvo de render do composer (o antialias do canvas não vale com pós)
    camera: { fov: 60, near: 0.5, far: 1400 },
    fog: { near: 130, far: 560 }, // far = limite de desenho do mundo
    shadow: { mapSize: 2048, extent: 85, distance: 320, bias: -0.0005, normalBias: 0.06 },
    bloom: { radius: 0.55, threshold: 1.1, scale: 0.5 }, // scale: fração da resolução da tela
    sky: { radius: 1200 },

    // setTimeOfDay(t) interpola entre estes quadros. Ângulos em graus; `night` é o nightFactor.
    times: [
      {
        at: 0, // fim de tarde dourado
        night: 0,
        sunElevation: 19,
        sunAzimuth: 205,
        sunColor: '#ffb469',
        sunIntensity: 2.5,
        shadow: 1,
        hemiSky: '#bcd0ff',
        hemiGround: '#a07a66',
        hemiIntensity: 1.7,
        zenith: '#3d6cb4',
        mid: '#e9b48f',
        horizon: '#ffc57a',
        sunGlow: 1,
        stars: 0,
        exposure: 1.15,
        bloom: 0.35,
      },
      {
        at: 0.5, // crepúsculo magenta
        night: 0.5,
        sunElevation: 3,
        sunAzimuth: 222,
        sunColor: '#ff7a5c',
        sunIntensity: 1.3,
        shadow: 0.55,
        hemiSky: '#9a7fd6',
        hemiGround: '#5a3a5e',
        hemiIntensity: 1.45,
        zenith: '#241f5c',
        mid: '#a8457f',
        horizon: '#ff8a5e',
        sunGlow: 0.7,
        stars: 0.1,
        exposure: 1.15,
        bloom: 0.55,
      },
      {
        at: 1, // noite de neon
        night: 1,
        sunElevation: 48, // a direcional vira luar frio
        sunAzimuth: 250,
        sunColor: '#7f9cff',
        sunIntensity: 0.7,
        shadow: 0,
        hemiSky: '#4a63c8',
        hemiGround: '#2c2150',
        hemiIntensity: 1.5,
        zenith: '#040616',
        mid: '#0d1638',
        horizon: '#33286e',
        sunGlow: 0,
        stars: 1,
        exposure: 1.2,
        bloom: 0.75,
      },
    ],

    // Escala para levar as unidades nativas de cada kit a metros (ver cabeçalho de render/assets.js).
    modelScale: { cars: 1.65, commercial: 7.5, suburban: 7.5, industrial: 8, street: 10.4, characters: 2.4 },

    // Retângulos [x, y, w, h] do colormap (512 px) que acendem à noite, por kit.
    // `windows.cell` (unidades do modelo) sorteia janela a janela quais acendem; sem isso o retângulo inteiro brilha.
    kits: {
      commercial: { intensity: 2.4, windows: { cell: 0.2 }, glow: [{ rect: [352, 128, 32, 128], color: '#ffffff' }] },
      suburban: { intensity: 2.4, windows: { cell: 0.2 }, glow: [{ rect: [352, 128, 32, 128], color: '#ffffff' }] },
      industrial: { intensity: 2.2, windows: { cell: 0.2 }, glow: [{ rect: [288, 384, 32, 128], color: '#ffffff' }] },
      street: { intensity: 6, glow: [{ rect: [256, 256, 32, 128], color: '#ffd9a0' }] },
      cars: {
        intensity: 3.5,
        glow: [
          { rect: [96, 384, 32, 128], color: '#fff1c4' }, // faróis
          { rect: [160, 384, 32, 128], color: '#ff2a1a' }, // lanternas
        ],
      },
    },
    windowColors: { warm: '#ffc27a', cool: '#bfe4ff', coolShare: 0.22, litShare: 0.7 },
  },
};
