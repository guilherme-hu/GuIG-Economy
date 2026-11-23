# GuIG Economy

Jogo 3D de navegador para o trabalho final de Novos Modelos de Negócio. Tema: uberização do trabalho.
Você é motoboy do app fictício **Rapidão** numa cidade caótica. Design de jogo e marcos: [PLANO.md](PLANO.md).
Publicado em https://guilherme-hu.github.io/GuIG-Economy/ pela Action `.github/workflows/deploy.yml` a cada merge na `main` (build na branch `gh-pages`); `npm run deploy` faz o mesmo à mão.

## Stack (não mude sem pedir)

- Vite + three.js, JavaScript puro (ES modules). Sem TypeScript, sem framework, sem engine de física.
- UI (celular, HUD, menus) em HTML/CSS sobre o canvas. Nada de UI desenhada em WebGL.
- Visual: paródia de app de entrega (preto, branco e verde #06C167, fonte Manrope em `public/assets/fonts/`). Na rua, cartões pretos; celular e telas cheias claros (classe `.light`, que inverte a escala de cinzas em `ui/tokens.css`). Textos sem emojis.
- Modelos 3D: só os CC0 em `public/assets/models/` (Kenney). Som: sintetizado em WebAudio.
- Testes: `node --test`. Dependências: só `three` e `vite`.
- Todo texto do jogo em pt-BR. Código e comentários em pt-BR quando fizer sentido; identificadores em inglês.

## Comandos

- `npm run dev` — http://localhost:5173 (suba com `preview_start` e `.claude/launch.json`, nunca por Bash)
- `npm test` — testes dos módulos de `src/sim` e `src/core`
- `npm run build` — build estático em `dist/`

## Arquitetura

**A simulação não conhece a renderização.** Dependências só apontam para baixo:

```
main.js        composição: único arquivo que conhece todos os módulos
  ui/  render/  audio/     leem o estado da sim e escutam eventos; nunca alteram a sim diretamente
  sim/                     PURO: sem three, sem DOM, sem Math.random. Testável em node.
  core/  config.js         loop, eventos, rng, input; todos os números de balanceamento
```

```
src/
  main.js  config.js
  core/    loop.js  events.js  rng.js  input.js
  sim/     city/generator.js  city/graph.js  (+ city/geometry.js  city/lots.js  city/pois.js, internos do gerador)
           bike.js  traffic.js  signals.js  rules.js  jobs.js  economy.js  shift.js  autopilot.js
  render/  scene.js (céu, luz do fim de tarde à noite, sombras)  assets.js
           cityView.js (+ terrain.js  roads.js  buildings.js  streetLights.js  batch.js, as partes dele)
           bikeView.js  crashView.js  trafficView.js  markersView.js (destino + rota no chão)  camera.js  effects.js
  ui/      base.css  tokens.css  phone/  hud.js  screens.js (menu, pausa, extrato, fim, configurações)  settings.js  tutorial.js
  audio/   audio.js
test/      um arquivo por módulo de sim/
```

Regras:
- Cada módulo exporta uma fábrica `createX(deps)` que devolve um objeto simples (estado + métodos). Dependências entram por parâmetro; nada de singleton nem import cruzado entre irmãos de `sim/`.
- A sim fala com o resto **só por eventos** (`core/events.js`). UI e áudio agem na sim **só por métodos públicos** chamados a partir de `main.js` ou de callbacks injetados.
- Todo número de balanceamento vive em `src/config.js`, na seção do seu sistema. Edite só a sua seção.
- Aleatoriedade: sempre `rng` injetado (`rng.fork('nome')` por sistema). Mesma seed ⇒ mesmo mundo.
- Desempenho: objetos repetidos em `InstancedMesh`; nada de alocação por frame nos `step`. Meta: 60 fps com 50 veículos.
- Funções curtas, nomes que dizem o que fazem, comentário só onde o porquê não é óbvio.

## Convenções de mundo

- Metros, segundos, m/s, radianos, reais.
- Chão no plano XZ, Y para cima. A sim trabalha em 2D com `{ x, z }`. O mundo vai de `-size/2` a `+size/2`.
- `heading` em radianos; direção = `(cos h, sin h)` em `(x, z)`. Em three, para um modelo com a frente em +X: `rotation.y = -heading`.
- Mão direita (Brasil): o lado direito de uma direção `d` é `(-d.z, d.x)`.

## Contrato entre módulos

Já existem: `createEvents()`, `createRng(seed)`, `createLoop({step, render})`, `createInput()` (ver `src/core`).
`input.state = { throttle: -1..1, steer: -1..1 (direita positivo), brake, horn }`.

```js
// sim/city/generator.js
generateCity(config.city, rng) → City
City = {
  size,
  nodes: [{ id, x, z, edges: [edgeId], district: 'centro'|'bairro'|'industrial', signal: boolean, radius }],
  edges: [{ id, a, b, length, dir: {x,z} /* unitário a→b */, kind: 'rua'|'avenida', lanes /* por sentido */,
            oneWay /* true = só a→b */, speedLimit, bridge, halfWidth /* do asfalto */ }],
  river: { points: [{x,z}], width },
  pois:  [{ id, type: 'restaurante'|'cliente'|'casa', name, edge, t /* 0..1 de a para b */, side /* 1 direita de a→b, -1 esquerda */, x, z }],
  homeId,
  lots:  [{ x, z, w, d, heading /* frente virada para a rua */, district, kind: 'predio'|'arranha-ceu'|'casa'|'galpao'|'praca', seed }],
}
// ids de nós e arestas são os índices nos arrays. `node.radius` = raio da área do cruzamento (linha de retenção fica aí).
// O rng da cidade é sempre `rng.fork('cidade')`. `poi.x/z` fica a 1 m do meio-fio, do lado `side` da via.
// `river.points` vai de oeste a leste: a margem norte (Centro) é a esquerda, a sul (Industrial e casa) é a direita.

// sim/city/graph.js
createGraph(city) → {
  nearestEdge(x, z, out?) → { edge /* id */, t, dist, side },   // spatial hash; dist ao eixo da via; `out` evita alocar por frame
  route(from: {edge,t}, to: {edge,t}) → { points: [{x,z}], steps: [{ edge, forward }], length } | null,  // A*, respeita mão única
  canTravel(edgeId, fromNodeId) → boolean,
  otherEnd(edgeId, nodeId) → nodeId,
  pointOnEdge(edgeId, t, lateral = 0, out?) → { x, z },         // lateral positivo = direita de a→b
  projectOnEdge(edgeId, x, z, out?) → { t, dist },              // ponto do eixo daquela via mais próximo de (x, z)
  nearbyEdges(edgeId) → [edgeId],                               // as outras vias que saem dos mesmos dois cruzamentos
}

// sim/bike.js
createBike(config.bike, graph, spawn: {x,z,heading}) → {
  x, z, heading, speed, lean, steer, radius, road /* último nearestEdge */, distance /* m rodados */,
  step(inputState, dt), reset(spawn),
}

// sim/autopilot.js   segue uma rota pela faixa da direita devolvendo o mesmo inputState do teclado
// com traffic/signals/cameras, freia para o veículo à frente, cede a quem está no cruzamento e para no sinal
// conforme config.obeyLights ('sempre' | 'radar' | 'nunca'); perfis prontos em config.autopilot.profiles
createAutopilot({ city, graph, bike, config: config.autopilot, traffic?, signals?, cameras? }) → {
  active, arrived, wanted /* m/s que ele tenta manter */, limitedBy /* 'via'|'veículo à frente'|'cruzamento' */, input,
  follow(route /* de graph.route */), goTo({ edge, t }) → boolean, stop(), step(dt) → inputState,
}

// sim/signals.js
createSignals(city, config.signals) → { step(dt), stateFor(nodeId, edgeId) → 'verde'|'amarelo'|'vermelho'|null }

// sim/traffic.js
createTraffic({ city, graph, signals, rng, config: config.traffic }) → {
  vehicles: [{ id, active, type: 'carro'|'moto'|'onibus'|'caminhao', model, x, z, heading, speed, length, width, reckless }],  // pool fixo; reckless = moto de outro entregador
  step(dt, focus /* a moto: {x,z,heading,speed} */),
}

// sim/economy.js
createEconomy(config.economy, events) → {
  money, rating, acceptance, day: { gross, tips, fuel, rent, fines, deliveries, late },
  payDelivery({pay, tip}), chargeFine(amount, kind), chargeFuel(meters), rate(delta), recordOffer(accepted),
  startDay(), statement() → { gross, tips, fuel, rent, fines, net, perHour, ... },
  snapshot() → estado, restore(estado),   // tudo o que um dia muda; usado para recomeçar o dia
}

// sim/jobs.js
createJobs({ city, graph, rng, events, economy, config: config.jobs }) → {
  offers: [{ id, restaurant /* poi */, customer /* poi */, distance, pay, deadline, surge, expiresIn }],
  active: null | { offer, phase: 'coleta'|'entrega', timeLeft, route, target /* poi */ },
  step(dt, bike), accept(offerId), decline(offerId),
}

// sim/rules.js      colisão moto×veículo, multa de sinal vermelho e contramão
createRules({ city, graph, signals, traffic, bike, economy, events, config: config.rules }) → { step(dt) }

// sim/shift.js      relógio do turno, contas do dia e fins de jogo; o turno só fecha sem entrega em andamento
createShift({ economy, jobs, events, config: config.shift }) → {
  day, timeLeft, bills, missedDays, running,
  start(), step(dt), nextDay() /* ou despejo */, gameOver(reason),   // emite shift:start, shift:end, game:over
  restartDay(),   // volta a economia a como estava antes do dia em andamento e chama start() de novo
}
```

### Eventos

| Evento | Payload |
|---|---|
| `offer:new` / `offer:expired` | `{ offer }` |
| `job:accepted` / `job:pickup` | `{ job }` |
| `job:delivered` | `{ job, pay, tip, lateBy }` |
| `job:cancelled` | `{ job, reason }` |
| `fine` | `{ kind: 'sinal'|'contramao', amount }` |
| `crash` | `{ vehicleId, relSpeed }` |
| `bump` | `{ kind: 'veiculo'|'parede', speed }` |
| `horn` | `{ x, z, from: 'jogador'|'transito' }` |
| `money:changed` | `{ money, delta, reason }` |
| `rating:changed` | `{ rating, delta }` |
| `shift:start` | `{ day, bills }` |
| `shift:end` | `{ day, statement, metBills }` |
| `game:over` | `{ reason: 'acidente'|'desativado'|'despejado', stats }` |

Precisa mudar o contrato? Mude aqui no mesmo commit e avise no relatório final.

## Como verificar sem um humano jogando

`window.__game` (sempre disponível) expõe `sim`, `config`, `events`, `loop`, `view` (`stage`, `cityView`, `aerial`), e:
`state()` (resumo JSON), `teleport(nodeId)`, `goTo(poiId)`, `autopilot(true|false)`, `setTimeScale(n)`, `acceptOffer(i)`, `audio`, `loop.advance(nPassos)`.
`loop.advance(n)` também desenha um quadro: com o painel do navegador escondido o `requestAnimationFrame` para, e é assim que a tela atualiza para o screenshot.
A hora do dia segue o turno (`1 − timeLeft / duração`); para ver a noite, `sim.shift.timeLeft = 100` e `loop.advance(1)`.

`?bot=cauteloso|apressado|kamikaze` (só para testes): o robô joga sozinho, dia após dia, com aquele perfil; `&vel=3` acelera o tempo.

A cidade sai sempre de `config.seed`; ofertas, trânsito e radares usam uma semente nova a cada carga da página. `?seed=N` repete uma sessão.

`node scripts/balance.js [dias] [perfis] [sementes]` simula dias inteiros com trânsito, radares, multas e batidas, para calibrar a economia.

`?debug=mapa` abre a vista aérea com arrastar e zoom; `&cam=x,z,distância,inclinação,giro` (graus) fixa a câmera para screenshots.
`state().view.buildingsLoaded` avisa quando os modelos terminaram de carregar.

Para cada marco: (1) `npm test` passa; (2) jogo abre e `read_console_messages` não tem erros;
(3) screenshot e inspeção visual de verdade; (4) critério de aceite do PLANO.md exercitado via `javascript_tool`.
Só então marque `[x]` no PLANO.md. O que não pôde ser verificado fica escrito na linha do marco.

## Fluxo de trabalho

- Uma issue do GitHub por marco, uma branch por marco e um PR que fecha a issue. Nada de push direto na `main`; o merge só quando pedirem.
- Quem commita é o orquestrador. **Subagentes não rodam git** e só tocam nos arquivos que receberam.
- Jogo original: não copie nome, arte, personagens ou mapa de nenhum jogo ou marca existente.
