# GuIG Economy

Jogo 3D de navegador feito para o trabalho final de Novos Modelos de Negócio. O tema é a uberização do trabalho.

Você é motoboy do Rapidão, um app de entrega inventado, numa cidade onde todo mundo corre. O turno dura 15 minutos (equivalem a 3h45 de jornada). Você aceita corridas pelo celular, busca o pedido no restaurante, entrega no cliente antes do prazo e, no fim do dia, vê no extrato se deu para pagar as contas.

Jogue em https://guilherme-hu.github.io/GuIG-Economy/

## Como rodar

Precisa de Node 22 ou mais novo.

```bash
npm install
```

```bash
npm run dev
```

Abre em http://localhost:5173. Os outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | testes da simulação (`node --test`) |
| `npm run build` | gera o jogo estático em `dist/`, com caminhos relativos; abre de qualquer servidor estático |
| `npm run deploy` | testa, gera e publica `dist/` na branch `gh-pages` |
| `node scripts/balance.js 3 cauteloso+sinais,apressado+sinais 3` | um robô joga dias inteiros e imprime o extrato de cada um |

Para ver o robô jogando no navegador, abra com `?bot=cauteloso` (ou `apressado`, `kamikaze`); `&vel=3` acelera o tempo.

## Controles

| Tecla | Ação |
|---|---|
| W / S ou ↑ / ↓ | acelerar e frear |
| A / D ou ← / → | virar |
| Espaço | freio forte; em movimento trava a traseira e, na curva, a moto derrapa |
| Espaço + W, parado | corte de giro |
| arrastar o mouse | girar a câmera (com o celular guardado) |
| Tab ou E | abrir e guardar o celular |
| 1, 2, 3 | aceitar a oferta |
| Q | trocar de aba no celular |
| H | buzina |
| M | som liga e desliga |
| Esc | pausar |

O jogo não pausa com o celular aberto, e ele tapa parte da tela. Olhar o GPS pilotando é um risco de verdade.

## O que o jogo tem a ver com a disciplina

Nenhuma tela do jogo explica a uberização. Ela aparece nas regras. Você só ganha quando entrega: esperar oferta não paga nada, e o caminho até o restaurante também não. Combustível, aluguel da moto (R$ 25 por dia, o plano mais barato da Mottu dividido por 7), conserto e multa saem do seu bolso, e um acidente encerra o jogo com uma mensagem do app dizendo que você "não possui vínculo". Quem decide as ofertas é o algoritmo: a nota e a taxa de aceitação filtram o que aparece, e nota abaixo de 4,20 desativa a conta sem conversa. A tarifa dinâmica muda o valor por km sem dizer por quê. O prazo apertado e a gorjeta por rapidez empurram você a furar sinal.

O extrato do fim do dia mostra o resultado do "seja seu próprio chefe": bruto, gorjetas, custos, líquido e quanto isso deu por hora, comparado com uma conta diária de R$ 46,80 (o salário mínimo líquido de 2025 dividido por 30). Dois dias seguidos sem pagar e você é despejado.

Os valores vêm de dados reais (pagamento do iFood, reivindicações da greve de 2025, aluguel de moto, multas do CTB) e estão com as fontes em [docs/valores-e-fontes.md](docs/valores-e-fontes.md). Lá também está a simulação usada para calibrar a economia. Com sinais e radares, o robô que respeita todo sinal fecha o dia com R$ 26 a R$ 59 e paga as contas em 2 de 9 dias. O que fura o vermelho onde não tem radar ganha até R$ 78, paga as contas em 6 de 9 dias e leva multa em mais da metade deles. Com o trânsito ligado, ele bate nos primeiros minutos.

## Como o código está organizado

Vite e three.js, JavaScript puro. A simulação (`src/sim`) não conhece a renderização e roda em Node, então dá para testar e balancear sem navegador. Os módulos de `render/`, `ui/` e `audio/` só leem o estado da simulação e escutam os eventos dela. O design do jogo e os marcos estão no [PLANO.md](PLANO.md).

Os modelos 3D são da Kenney (CC0) e a fonte é a Manrope (OFL); licenças em [public/assets/LICENSES.md](public/assets/LICENSES.md). Os sons são sintetizados no navegador.
