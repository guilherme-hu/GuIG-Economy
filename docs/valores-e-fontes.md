# Valores do jogo: de onde vêm e como foram convertidos

Este documento reúne os números reais que embasam a economia do **GuIG Economy**, as fontes de cada um e como eles viraram números no jogo. Serve de apoio para a apresentação do trabalho.

Todos os valores do jogo ficam em [`src/config.js`](../src/config.js), e a coluna "No código" aponta a chave correspondente.

Pesquisa feita em novembro de 2026. Os valores reais são de 2025, os mais recentes encontrados com fonte.

## 1. Dados reais usados

| Tema | Valor real | Fonte |
|---|---|---|
| Pagamento por entrega (iFood, moto) | Mínimo de **R$ 7,50 por rota de até 4 km**; **R$ 1,50 por km adicional**. Bicicleta: R$ 7,00. Vigente desde junho de 2025 (antes: R$ 6,50) | [TecMundo](https://www.tecmundo.com.br/mercado/404252-ifood-reajusta-taxa-minima-paga-aos-entregadores-saiba-qual-sera-o-valor.htm), [Times Brasil (CNBC)](https://timesbrasil.com.br/brasil/ifood-anuncia-reajuste-na-taxa-minima-de-entrega-acima-da-inflacao/), [IstoÉ Dinheiro](https://istoedinheiro.com.br/ifood-aumenta-valor-minimo-pago-entregadores) |
| Reivindicação dos entregadores | Taxa mínima de **R$ 10** por entrega e **R$ 2,50 por km** (pauta do "breque" de 2025) | [Mercado & Consumo](https://mercadoeconsumo.com.br/01/04/2025/foodservice/greve-de-entregadores-de-aplicativos-continua-liderancas-sao-recebidas-no-ifood/amp/), [Correio Braziliense](https://www.correiobraziliense.com.br/cbradar/ifood-aumenta-taxas-de-entrega-e-trabalhadores-reagem/) |
| Ganho bruto por hora | iFood: **R$ 28/h** em média (2024). Cebrap: **R$ 31,33/h** (mai/2023–abr/2024) | [SBT News](https://sbtnews.sbt.com.br/noticia/economia/i-food-vai-permitir-remuneracao-diaria-a-entregadores-e-lancar-bonus-para-quem-faz-mais-pedidos), [Canaltech](https://canaltech.com.br/mercado/quanto-ganha-um-entregador-do-ifood-em-2025/) |
| Jornada diária | Entregadores trabalham em média **menos de 4 horas por dia**, 5 dias por semana (Cebrap) | [A Tarde](https://atarde.com.br/brasil/entregadores-podem-aumentar-renda-fora-do-horario-de-pico-saiba-como-1403158) |
| Trabalhadores de aplicativo em geral (IBGE) | Rendimento médio de R$ 16,2 por hora; jornadas mais longas que a média | [Guardar Dinheiro](https://www.guardardinheiro.com.br/blog/renda-extra-no-app-contas-antes-de-comecar), [Tecnoblog](https://tecnoblog.net/comunidade/t/trabalhadores-de-apps-tem-jornadas-mais-longas-e-recebem-menos-aponta-ibge/156425) |
| Distância e ritmo | Para chegar ao salário mínimo, o entregador precisa de **pelo menos 1 entrega por hora, com ~3 km**, por mais de 44 h semanais (estudo ANPET) | [ANPET](https://transportes.anpet.org.br/anpet/article/view/2641) |
| Aluguel de moto para entregador (Mottu) | **R$ 175 a R$ 259 por semana**, conforme o plano; parceria com o iFood a partir de **R$ 19 por dia** (ago/2025) | [Garagem360](https://garagem360.com.br/?p=197914), [Mercado & Consumo](https://mercadoeconsumo.com.br/21/08/2025/noticias/ifood-firma-parceria-com-mottu-para-aluguel-de-motos-a-partir-de-r-19-para-seus-entregadores/), [Autopapo](https://autopapo.com.br/motos/ifood-fecha-parceria-com-mottu/) |
| Peso dos custos | Exemplo de um guia financeiro: de cada R$ 100 faturados, **~R$ 35** vão para custos (combustível, manutenção, dados, seguro). É uma ilustração, não um dado medido | [Guardar Dinheiro](https://www.guardardinheiro.com.br/blog/renda-extra-no-app-contas-antes-de-comecar) |
| Multa por avançar o sinal vermelho | **R$ 293,47**, gravíssima, 7 pontos (art. 208 do CTB) | [Autopapo](https://autopapo.com.br/noticia/multa-sinal-vermelho-valor-pontos-cnh/), [Doutor Multas](https://doutormultas.com.br/avancar-sinal-vermelho-perde-habilitacao/) |
| Multa por transitar na calçada | **R$ 880,41** (gravíssima ×3, art. 193 do CTB) | [Autopapo](https://autopapo.com.br/noticia/moto-em-passarelas-passeios-multa/), [Doutor Multas](https://doutormultas.com.br/multa-por-transitar-na-calcada/) |
| Salário mínimo (2025) | **R$ 1.518** por mês; líquido, depois de 7,5% de INSS: **R$ 1.404,15** | Valor oficial de 2025; o desconto do INSS é cálculo nosso, pela alíquota da primeira faixa |

Valores que **não encontramos com fonte** e foram estimados:
- **Combustível e manutenção por km**: ~R$ 0,20 por km real. Base: moto de 110–160 cc faz ~35–40 km/l, com gasolina a ~R$ 6,30, o que dá ~R$ 0,16/km, mais manutenção.
- **Conserto depois de uma batida leve** (manete, retrovisor, pisca): R$ 80.
- **Contramão**: usamos o valor de gravíssima (R$ 293,47, art. 186, II do CTB), que não foi conferido numa fonte específica.

## 2. Como os valores viraram números do jogo

O jogo comprime a realidade: uma cidade de 1,6 km e um turno de 15 minutos. Duas regras de conversão fazem a ponte.

**Distância: 1 km do jogo = 3 km reais** (`jobs.kmScale`). Uma entrega típica real tem ~3 km (ANPET); no jogo, a maioria das rotas pagas tem 0,3–1,8 km, ou seja, 1–5,4 km reais.

**Tempo: 1 turno de 15 min = 3 h 45 min de jornada real** (`shift.duration`, `economy.shiftHours`). A jornada média é menor que 4 h (Cebrap), e com essa conversão quem joga bem fatura R$ 25–33 por hora no jogo, na faixa do bruto médio real (R$ 28–31/h). Assim, 1 min de jogo ≈ 15 min reais.

| No jogo | Valor | Como chegamos nele | No código |
|---|---|---|---|
| Pagamento mínimo por entrega | R$ 7,50 até 4 km reais | Igual ao iFood (moto) | `jobs.minPay`, `jobs.freeKm` |
| Pagamento por km adicional | **R$ 2,50** por km real acima de 4 km | O iFood paga R$ 1,50. Usamos os **R$ 2,50 reivindicados pelos entregadores na greve de 2025**: com R$ 1,50, a corrida longa nunca compensava o tempo gasto (ver seção 3) | `jobs.payPerKm`, `jobs.kmScale` |
| Km até o restaurante | **Não pago** | Só o trecho restaurante → cliente é pago. O deslocamento até o restaurante ("km morto") sai do bolso do entregador | `src/sim/jobs.js` |
| Tarifa dinâmica | Em 20% das ofertas, +10% a +40% | Os apps pagam bônus em horários de pico; o valor é ilustrativo. Some se a taxa de aceitação cair abaixo de 50% | `jobs.surgeChance`, `jobs.surgeMax` |
| Tipos de oferta | Curta (0,3–0,9 km), média (0,9–1,8 km), longa (1,8–3,6 km) do jogo | Curta e média ficam perto do mínimo; a longa ganha por km. O app oferece restaurantes entre os 3 mais próximos | `jobs.bands`, `jobs.restaurantChoices` |
| Prazo | distância ÷ velocidade de referência + 30 s | 28 km/h nas curtas e 40 km/h nas longas: a longa paga mais, mas o prazo por km aperta | `jobs.refSpeedShort`, `jobs.refSpeedLong`, `jobs.deadlineBuffer` |
| Aluguel da moto | R$ 25 por dia | R$ 175 por semana (plano mais barato da Mottu) ÷ 7 | `economy.bikeRentPerDay` |
| Combustível | R$ 0,60 por km do jogo | ~R$ 0,20 por km real × 3 | `economy.fuelPerKm` |
| Multa de sinal vermelho | R$ 29,35 | 1/10 do valor real (R$ 293,47). Só nos cruzamentos com radar (30% dos que têm semáforo) | `rules.fineRedLight` |
| Multa na calçada | R$ 88,04 | 1/10 do valor real (R$ 880,41) | `rules.fineSidewalk` |
| Multa por contramão | R$ 29,35 | 1/10 do valor de gravíssima | `rules.fineWrongWay` |
| Conserto da moto | R$ 30 | Peças pequenas (manete, retrovisor, pisca), na escala do jogo | `rules.repairCost` |
| Contas do dia 1 | **R$ 46,80** | Salário mínimo líquido (R$ 1.404,15) ÷ 30 dias: o que o entregador precisa tirar por dia só para viver com um mínimo | `shift.billsDay1` |
| Aumento das contas | +3% por dia | Recurso de jogo: a pressão cresce a cada dia | `shift.billsGrowth` |
| Despejo | 2 dias seguidos sem pagar as contas | Recurso de jogo | `shift.missedDaysToLose` |

**Por que as multas são 1/10 do valor real.** Uma multa real de R$ 293,47 equivale a **cerca de 10 horas de faturamento bruto** de um entregador (a R$ 28–31/h), ou quase três turnos do jogo. Com o valor real, a primeira multa já levaria ao despejo e o jogo viraria punição pura. A 1/10, uma multa de sinal (R$ 29,35) consome mais ou menos o lucro de um bom dia, e a da calçada (R$ 88,04) passa disso; a proporção entre as infrações é a mesma do CTB. **Na apresentação vale citar o valor real**: no jogo a multa dói; na vida real, ela é dez vezes maior.

## 3. Como sabemos que dá para lucrar, mas é difícil

Um robô joga dias inteiros com o piloto automático (`node scripts/balance.js 3`). Ele roda **sem trânsito, sem multas e sem batidas**, porque o piloto ainda não desvia de carros nem respeita sinal. Para compensar, variamos o **ritmo**:
- **1,4 = apressado**: bem acima do limite, curvas e freadas no limite;
- **1 = no limite da via**, sem trânsito;
- **0,8 = bom jogador no trânsito** (nossa referência para uma pessoa jogando bem);
- **0,65 = lento**, travado no trânsito.

E a **estratégia** de escolha: a primeira oferta, a mais curta, a que paga mais por km rodado, a que paga mais no total (as longas).

Resultado (3 dias por combinação; contas de R$ 46,80, R$ 48,20 e R$ 49,65):

| Ritmo | Melhor estratégia | Entregas por dia | Líquido por dia | Pagou as contas? |
|---|---|---|---|---|
| 1,4 (apressado) | maior R$/km | 10–15 | R$ 71–106 | **3 de 3**, com qualquer estratégia |
| 1 (no limite) | maior R$/km | 10–11 | R$ 60–71 | **3 de 3**; pegar a primeira oferta ou só longas: despejado |
| 0,8 (bom jogador no trânsito) | maior R$/km ou mais curtas | 7–10 | R$ 33–55 | **1 de 3**; errou o 2º dia por R$ 0,03 e foi despejado no 3º |
| 0,65 (lento) | qualquer | 5–9 | R$ 12–45 | **nunca**; despejado no 3º dia |

Como chegamos aqui: na primeira calibração (turno de 12 min, R$ 1,50/km, contas de R$ 50,60), nem o robô no limite pagava as contas, e no ritmo lento os atrasos derrubavam a nota até a conta ser desativada. Atendendo ao pedido do grupo, alongamos o turno, pagamos mais pelas longas (R$ 2,50/km, a reivindicação dos entregadores), afrouxamos os prazos e baixamos as contas para o salário mínimo líquido.

Leituras para a apresentação:
- **Dá lucro, mas só correndo.** Quem joga bem dentro do trânsito quase paga as contas e fica a centavos delas; quem corre acima do limite paga com folga. No jogo de verdade, correr significa furar sinal, costurar no trânsito e arriscar uma batida (fim de jogo) ou uma multa que come o lucro do dia.
- **Escolher as corridas importa.** Pegar sempre a primeira oferta rende bem menos do que escolher pelo valor por km rodado, por causa do km morto e dos prazos.
- **A corrida longa só compensa para quem corre.** Mesmo com R$ 2,50/km, quem anda no limite perde dinheiro escolhendo só as longas, porque o prazo aperta e o tempo gasto não volta.
- **Com o valor real do iFood (R$ 1,50/km), a corrida longa não compensava para ninguém.**

Uma simulação com trânsito e jogadores-robô "cauteloso" e "apressado" é parte do marco M7.
