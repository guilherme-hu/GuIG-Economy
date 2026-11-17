# PLANO — GuIG Economy

## 1. Conceito

Você é entregador do app **Rapidão**. Cada turno dura alguns minutos reais. Você abre o celular, escolhe corridas,
busca a comida no restaurante e entrega no cliente antes do prazo, pilotando em 3ª pessoa por uma cidade onde todo mundo corre.

A mensagem do jogo (o que liga com a disciplina) aparece **pela mecânica, não por texto**:

| Conceito de aula | Como vira mecânica |
|---|---|
| Remuneração por tarefa, sem salário | Só ganha quando entrega. Parado = R$ 0 |
| Risco transferido ao trabalhador | Combustível, aluguel da moto e multas saem do seu bolso; acidente = fim, sem seguro |
| Gestão algorítmica | Nota e taxa de aceitação decidem quais ofertas você vê. Recusar demais = ofertas piores |
| Desligamento unilateral | Nota abaixo do mínimo = "conta desativada" (game over) |
| Tarifa dinâmica opaca | O valor por km muda sem explicação entre ofertas |
| Pressão por velocidade | Prazo apertado + gorjeta por rapidez empurram você a furar sinal e arriscar batida |
| "Seja seu próprio chefe" | Extrato do fim do dia: bruto → líquido → R$/hora, comparado com a meta de contas |

O dilema central a cada cruzamento: **furo o sinal e arrisco multa/batida, ou paro e perco a gorjeta e a nota?**

## 2. Loop de jogo

1. **Casa** — começa montado na moto em frente de casa. `Tab` (ou `E`) abre o celular.
2. **Ofertas** — 3 cartões: restaurante, destino, distância total, valor, prazo. Ofertas expiram em ~12 s e são substituídas. Aceitar uma.
3. **Coleta** — GPS traça rota até o restaurante. Parar no marcador (velocidade < 5 km/h por 1,5 s) pega o pedido. O cronômetro já está correndo.
4. **Entrega** — GPS traça rota até o cliente. Parar no marcador entrega.
5. **Resultado** — valor + gorjeta (se adiantado) ou perda de nota (se atrasado). Volta ao passo 2, de onde estiver.
6. **Fim do turno** — quando o relógio do turno zera e não há entrega ativa: tela de extrato. Próximo dia com contas maiores.

**Fins de jogo:** batida forte em veículo ("Acidente. O Rapidão lamenta e informa que você não possui vínculo."),
nota < mínimo ("Conta desativada"), ou 2 dias seguidos sem bater a meta de contas ("Despejado").
Tela final mostra dias sobrevividos, total entregue e R$/hora médio.

## 3. Sistemas

### 3.1 Mapa (`src/map.js`, lógica pura)

Cidade ~1600 × 1600 m, gerada por seed fixa. **Não pode parecer uma malha.** Grafo de nós (cruzamentos) e arestas retas (ruas).

Geração:
1. Grade de nós com espaçamento ~90 m e *jitter* de ±30% na posição.
2. Três distritos com caráter próprio: **Centro** (denso, grade rotacionada ~15°), **Bairro** (quarteirões irregulares, muitas ruas sem saída), **Industrial** (quarteirões grandes, poucas ruas).
3. **Rio** cortando o mapa na diagonal: remove toda aresta que o cruza, exceto **3 pontes**. As pontes são os gargalos que fazem o GPS importar.
4. Remove ~25% das arestas restantes ao acaso, **sem desconectar o grafo** (checar conectividade a cada remoção).
5. **Avenidas**: 2 diagonais + 1 marginal ao longo do rio, ligando nós próximos de uma linha. Avenida = 2 faixas por sentido, limite maior, mais trânsito, semáforo em todo cruzamento.
6. Ruas comuns = 1 faixa por sentido. ~15% das ruas do Centro são de **mão única**.
7. Semáforo em todo cruzamento avenida×qualquer e em ~40% dos cruzamentos rua×rua com grau ≥ 3.
8. POIs: ~14 restaurantes (concentrados no Centro) e ~40 endereços de cliente (espalhados), cada um preso a um ponto de uma aresta. Casa do jogador no Bairro.

Também neste módulo: `route(a, b)` = A* por distância respeitando mão única; spatial hash de arestas para "em que rua estou?".

Testes (`test/map.test.js`): grafo conexo; exatamente 3 pontes; grau médio entre 2,4 e 3,4; ≥ 8 becos sem saída; mesma seed ⇒ mesmo mapa; `route` existe entre todo par de POIs; rota nunca usa mão única ao contrário.

### 3.2 Mundo visual (`src/world.js`)

Direção de arte: low-poly estilizado e coeso, do **fim de tarde dourado até a noite de neon** ao longo do turno. Nada de caixas cruas.

- **Modelos CC0 da Kenney** em `public/assets/models/` (carros, prédios comerciais/suburbanos/industriais, árvores, postes, semáforos, placas, personagens), instanciados.
- **Ruas, calçadas, rio e pontes por código** (o mapa não é grade), com texturas geradas em canvas: asfalto com ruído, faixas, faixa de pedestre, linha de retenção, meio-fio.
- Prédios nos lotes que o gerador devolve (`city.lots`), modelo escolhido por distrito e tipo.
- Semáforos com luz emissiva por aproximação; postes de luz; árvores no Bairro.
- Marcadores de coleta/entrega: coluna de luz visível de longe + anel no chão.
- Luz e pós: tone mapping ACES, sombras suaves, céu em gradiente que muda com a hora, neblina, bloom em semáforos, faróis, postes e letreiros; janelas acendem à noite.

### 3.3 Moto (`src/bike.js`)

- Controles: `W/S` ou `↑/↓` acelera/freia, `A/D` ou `←/→` vira, `Espaço` freio forte, `Tab`/`E` celular, `H` buzina, `Esc` pausa.
- Física arcade: velocidade escalar + ângulo; esterço diminui com a velocidade; a moto inclina visualmente na curva. Máx. ~95 km/h, 0–60 em ~3 s.
- Câmera 3ª pessoa atrás e acima, com mola; FOV abre com a velocidade; leve tremor acima de 80 km/h.
- **Limite do mundo sem malha de colisão**: a moto só anda a até (meia largura da rua + calçada) de alguma aresta. Passou disso = bateu no prédio: velocidade ×0,2 e empurrão de volta. Sem game over.
- Colisão com veículo (círculo × caixa orientada): velocidade relativa > 20 km/h = **game over**; abaixo disso, tranco e perda de velocidade.
- Piloto e moto: primitivas, com baú de entrega nas costas na cor do Rapidão.

### 3.4 Trânsito e semáforos (`src/traffic.js`)

- Carros, ônibus (lentos, largos) e outros motoboys (rápidos, costuram). Pool de ~50, instanciados.
- Cada veículo anda numa faixa de uma aresta (mão direita); no nó escolhe a próxima aresta ao acaso (sem retorno) e cruza por uma curva simples.
- Segue o veículo da frente (freia por distância), para no vermelho. **Caos**: velocidades bem variadas, ~10% furam o amarelo/vermelho recente, alguns mudam de faixa na avenida sem aviso.
- Reagem ao jogador: freiam se a moto está logo à frente na faixa, e buzinam.
- Spawn fora da vista a 120–260 m do jogador; despawn além de 320 m. Densidade maior em avenida e no Centro.
- Semáforo: ciclo verde/amarelo/vermelho por nó, alternando grupos de aproximações opostas; fases defasadas entre nós.
- **Multa**: jogador entra no nó vindo de uma aproximação em vermelho ⇒ flash branco de radar, som, desconto imediato e aviso no celular. Contramão em mão única: multa menor, uma vez por rua.

### 3.5 Entregas e economia (`src/jobs.js`, lógica pura)

Valores iniciais (todos em `config.js`, ajustar no balanceamento):

- Oferta: distância = rota(jogador→restaurante) + rota(restaurante→cliente).
- Valor = R$ 4,50 + R$ 1,60/km × multiplicador dinâmico (0,8–1,6, sorteado; exibido só como "🔥 alta demanda" quando > 1,3).
- Prazo = distância ÷ velocidade de referência + 20 s. A velocidade de referência **sobe com a distância** (35 km/h nas curtas → 55 km/h nas longas): corrida longa paga mais e aperta mais.
- Gorjeta: até 30% do valor, proporcional ao tempo que sobrou. Atraso: sem gorjeta, nota −0,1 a −0,5 conforme o atraso; atraso > 60 s = pedido cancelado, sem pagamento.
- Nota: começa em 4,80, +0,03 por entrega no prazo, teto 5,00. Abaixo de 4,20 ⇒ conta desativada.
- Taxa de aceitação: cada oferta que expira ou é recusada conta contra. Abaixo de 50% o app só mostra ofertas de multiplicador baixo por um tempo.
- Custos: combustível R$ 0,35/km rodado; aluguel da moto R$ 40/dia; multa sinal vermelho R$ 60; contramão R$ 30.
- Turno: 6 min reais. Meta de contas: R$ 90 no dia 1, +15% por dia.
- Extrato do dia: bruto, gorjetas, − combustível, − aluguel, − multas = líquido; R$/hora de jogo; meta batida ou não.

Testes (`test/jobs.test.js`): valor cresce com distância; prazo por km diminui com distância; gorjeta nunca negativa nem > 30%; nota nunca passa de 5; extrato fecha (bruto − custos = líquido).

### 3.6 Celular e HUD (`src/phone.js`, HTML/CSS)

- Celular sobe do canto inferior direito, ocupa ~30% da tela e **tapa parte da visão** — olhar o GPS pilotando é um risco de verdade. O jogo não pausa.
- Telas: **Ofertas** (3 cartões com barra de expiração), **Corrida** (minimapa GPS em `<canvas>` 2D: ruas, rota, você, destino; prazo; valor), **Carteira** (ganhos e descontos do dia), notificações (multa, gorjeta, aviso de nota).
- Com o celular guardado o HUD é mínimo: velocímetro, cronômetro da entrega, seta de direção para a **próxima curva** e distância. Rota completa só no celular.
- Menu inicial, pausa, tutorial de 4 passos na primeira corrida, tela de extrato, telas de fim de jogo.
- Identidade do Rapidão: uma cor forte de marca + tom corporativo falsamente animado nas mensagens ("Você é seu próprio chefe! 🚀", "Sua nota caiu. Continue se esforçando!").

### 3.7 Som (`src/audio.js`, WebAudio sintetizado)

Motor (oscilador com pitch pela velocidade), buzinas, freada, batida, notificação do app, caixa registradora na entrega, flash do radar. Botão de mudo.

### 3.8 Estrutura de arquivos

A estrutura de pastas e o contrato entre módulos estão no [CLAUDE.md](CLAUDE.md) (os nomes de arquivo citados acima,
como `src/map.js`, são os do rascunho; valem os do CLAUDE.md: `sim/` puro, `render/`, `ui/`, `audio/`).

## 4. Marcos

Cada marco é uma issue no GitHub e termina com o jogo rodando, verificado conforme o CLAUDE.md, marcado aqui, commitado e publicado.

- [x] **M0 — Esqueleto.** (#1) Vite + three, `.claude/launch.json`, `.gitignore`, loop de passo fixo, um chão e um cubo, `window.__game.state()`.
  *Aceite:* página abre sem erro no console; `npm test` roda (mesmo com 1 teste trivial de `rng`).
- [ ] **M1 — Mapa.** (#2) `map.js` completo com testes; `world.js` desenha ruas, rio, pontes, prédios. Câmera aérea de debug (`?debug=mapa`).
  *Aceite:* testes do mapa passam; screenshot aéreo mostra claramente os 3 distritos, o rio, as 3 pontes e as diagonais — **não é uma grade**.
  *Andamento (branch `m1-mapa`):* gerador, grafo e testes prontos (`src/sim/city/`, `test/generator.test.js`, `test/graph.test.js`). Falta a parte visual: `render/` e a câmera `?debug=mapa`.
- [ ] **M2 — Moto.** (#3) Controles, câmera 3ª pessoa, limite de rua/prédio, inclinação, `teleport`.
  *Aceite:* dá para atravessar a cidade de uma ponta à outra sem atravessar prédio; screenshot em 3ª pessoa legível.
- [ ] **M3 — Celular, ofertas e GPS.** (#4) `jobs.js` com testes, celular com 3 telas, A*, marcadores, coleta/entrega, cronômetro, seta de próxima curva, `autopilot` e `acceptOffer`.
  *Aceite:* via `__game`: aceitar oferta, ligar autopilot, e o dinheiro em `state()` aumenta sozinho após a entrega.
- [ ] **M4 — Trânsito e semáforos.** (#5) Veículos, semáforos, colisão ⇒ game over, multa por vermelho e contramão.
  *Aceite:* screenshot com trânsito parado num vermelho; teleporte para dentro de um carro em movimento dá game over; atravessar vermelho desconta dinheiro; fps ≥ 50 com o pool cheio.
- [ ] **M5 — Dia completo.** (#6) Turno, nota, aceitação, custos, extrato, progressão de dias, os 3 fins de jogo, menu, pausa, tutorial.
  *Aceite:* com `setTimeScale` alto + autopilot, um turno inteiro roda até o extrato e o extrato fecha; cada fim de jogo é alcançável e reiniciável.
- [ ] **M6 — Sensação.** (#7) Som, entardecer→noite, faróis, FOV/tremor, flash de radar, partículas de freada, polimento visual do celular e das telas.
  *Aceite:* screenshots de dia e de noite bonitos; nenhum texto estourando no celular em 1366×768.
- [ ] **M7 — Balanceamento e entrega.** (#8) Jogar 3 turnos via autopilot com perfis "cauteloso" (para em todo sinal) e "apressado" (fura tudo) e ajustar `config.js` até: o cauteloso mal bate a meta, o apressado ganha mais mas toma multas e bate com frequência. `npm run build` funcionando com caminhos relativos (`base: './'`). README com como rodar, controles e um parágrafo ligando as mecânicas aos conceitos da disciplina (tabela da seção 1).
  *Aceite:* `dist/` abre e joga a partir de um servidor estático; README pronto.

Fora do escopo (só se sobrar tempo, depois do M7): chuva com bônus e pista lisa, pedestres, gamepad, ranking local.

## 5. Prompts

**Retomada** (se a sessão parar no meio; funciona também com `/loop` na frente para ela se auto-reagendar):

> Leia CLAUDE.md e PLANO.md e rode `git log --oneline` e `gh issue list`. Continue do primeiro marco não marcado, primeiro conferindo que o jogo abre sem erros no estado atual. Para cada marco: implemente (pode usar subagentes em paralelo em arquivos disjuntos, seguindo o contrato do CLAUDE.md), verifique no navegador embutido, marque `[x]`, commite fechando a issue e dê push. Não pare até o M7 nem me pergunte decisões de implementação.

**Depois de jogar** (para rodadas de ajuste):

> Joguei e anotei: [lista]. Para cada item, reproduza no navegador embutido, corrija, verifique e faça um commit por item. Números de balanceamento só em `src/config.js`.
