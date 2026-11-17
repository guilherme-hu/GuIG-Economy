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
| Salário mínimo (2025) | **R$ 1.518** por mês | Valor oficial de 2025 |

Valores que **não encontramos com fonte** e foram estimados:
- **Combustível e manutenção por km**: ~R$ 0,20 por km real. Base: moto de 110–160 cc faz ~35–40 km/l, com gasolina a ~R$ 6,30, o que dá ~R$ 0,16/km, mais manutenção.
- **Conserto depois de uma batida leve** (manete, retrovisor, pisca): R$ 80.
- **Contramão**: usamos o valor de gravíssima (R$ 293,47, art. 186, II do CTB), que não foi conferido numa fonte específica.

## 2. Como os valores viraram números do jogo

O jogo comprime a realidade: uma cidade de 1,6 km e um turno de 12 minutos. Duas regras de conversão fazem a ponte.

**Distância: 1 km do jogo = 2 km reais** (`jobs.kmScale`). Uma entrega típica real tem ~3 km (ANPET); no jogo, a maioria das rotas pagas tem 0,3–1,8 km.

**Tempo: 1 turno de 12 min = 3 h de jornada real** (`shift.duration`, `economy.shiftHours`). Escolhemos 3 h porque a jornada média é menor que 4 h (Cebrap) e porque, com esse valor, quem joga rápido fatura ~R$ 29 por hora no jogo, o mesmo bruto médio real (R$ 28–31/h). Assim, 1 min de jogo ≈ 15 min reais.

| No jogo | Valor | Como chegamos nele | No código |
|---|---|---|---|
| Pagamento mínimo por entrega | R$ 7,50 | Igual ao iFood (moto) | `jobs.minPay` |
| Pagamento por km adicional | R$ 1,50 por km real acima de 4 km | Igual ao iFood, com a distância do jogo convertida (×2) | `jobs.payPerKm`, `jobs.freeKm`, `jobs.kmScale` |
| Km até o restaurante | **Não pago** | Só o trecho restaurante → cliente é pago. O deslocamento até o restaurante ("km morto") sai do bolso do entregador | `src/sim/jobs.js` |
| Tarifa dinâmica | Em 20% das ofertas, +10% a +40% | Os apps pagam bônus em horários de pico; o valor é ilustrativo. Some se a taxa de aceitação cair abaixo de 50% | `jobs.surgeChance`, `jobs.surgeMax` |
| Tipos de oferta | Curta (0,3–0,9 km), média (0,9–1,8 km), longa (1,8–3,6 km) do jogo | Curta e média pagam o mínimo; só a longa passa dos 4 km reais e ganha por km. O prazo por km aperta nas longas | `jobs.bands` |
| Aluguel da moto | R$ 25 por dia | R$ 175 por semana (plano mais barato da Mottu) ÷ 7 | `economy.bikeRentPerDay` |
| Combustível | R$ 0,40 por km do jogo | ~R$ 0,20 por km real × 2 | `economy.fuelPerKm` |
| Multa de sinal vermelho | R$ 293,47 | Valor real, sem conversão. Só nos cruzamentos com radar (30% dos que têm semáforo) | `rules.fineRedLight` |
| Multa na calçada | R$ 880,41 | Valor real, sem conversão | `rules.fineSidewalk` |
| Multa por contramão | R$ 293,47 | Valor de gravíssima | `rules.fineWrongWay` |
| Conserto da moto | R$ 80 | Estimativa de peças pequenas | `rules.repairCost` |
| Contas do dia 1 | R$ 50,60 | Salário mínimo (R$ 1.518) ÷ 30 dias. É o que o entregador precisa tirar por dia só para viver com um mínimo | `shift.billsDay1` |
| Aumento das contas | +5% por dia | Recurso de jogo: a pressão cresce a cada dia | `shift.billsGrowth` |

**Por que as multas não foram convertidas.** Uma multa real de R$ 293,47 equivale a mais de 3 horas de faturamento bruto de um entregador (a R$ 28–31/h). No jogo, ela equivale a cerca de 4 dias do lucro de quem joga bem. Mantivemos o valor real de propósito: é o que mostra o tamanho do risco que o entregador assume sozinho.

## 3. Como sabemos que dá para lucrar, mas é difícil

Um robô joga dias inteiros com o piloto automático (`node scripts/balance.js 3`), sem trânsito, sem multas e sem batidas, ou seja, no melhor cenário possível. Variamos duas coisas:
- **Estratégia** de escolha: a primeira oferta, a mais curta, a que paga mais por km rodado, a que paga mais no total.
- **Ritmo**: 1,4 = apressado (acima do limite, curvas e freadas no limite); 1 = no limite da via; 0,65 = lento, como no trânsito.

Resultado (3 dias por combinação):

| Ritmo | Melhor estratégia | Entregas por dia | Líquido por dia | Pagou as contas? |
|---|---|---|---|---|
| 1,4 (apressado) | maior R$/km | 8–10 | R$ 45–61 | **2 de 3 dias** |
| 1,4 (apressado) | mais curtas | 9–10 | R$ 49–57 | 1 de 3 dias |
| 1 (no limite) | mais curtas / R$/km | 6–9 | R$ 20–51 | nunca; despejado no 3º dia |
| 0,65 (lento, trânsito) | qualquer | 4–8 | R$ 3–40 | nunca; despejado ou desativado (atrasos derrubam a nota) |

Leituras para a apresentação:
- **Só dá lucro correndo.** Quem respeita o limite nunca paga as contas, mesmo sem trânsito, sem multa e sem acidente. No jogo de verdade, correr significa furar sinal, costurar no trânsito e arriscar uma batida ou uma multa que apaga dias de trabalho.
- **Escolher as corridas importa**, mas não salva sozinho. Pegar a primeira oferta ou a que paga mais no total (as longas) rende menos do que escolher pelo valor por km rodado, por causa do km morto e do prazo apertado das longas.
- **Corrida longa paga mais, mas rende menos por hora**, como na vida real, onde a taxa mínima cobre os primeiros 4 km.
- **Atrasar custa caro**: no ritmo lento, os atrasos derrubam a nota e o app desativa a conta.

O piloto automático ainda não respeita sinal nem desvia de carros, por isso a simulação roda sem trânsito. Uma simulação com trânsito e jogadores-robô "cauteloso" e "apressado" é parte do marco M7.
