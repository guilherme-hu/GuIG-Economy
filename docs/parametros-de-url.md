# Parâmetros de URL para testar o jogo

Os parâmetros vão no fim do endereço, depois de `?`, e se juntam com `&`. Funcionam tanto no servidor local quanto no site publicado:

- Local (`npm run dev`): http://localhost:5173/
- Publicado: https://guilherme-hu.github.io/GuIG-Economy/

Sem parâmetro nenhum, o jogo abre no menu, como para qualquer jogador.

## Resumo

| Parâmetro | Valores | O que faz |
|---|---|---|
| `bot` | `cauteloso`, `bom`, `apressado`, `kamikaze` | Um robô joga sozinho, dia após dia, com aquele perfil |
| `vel` | número (ex.: `3`) | Acelera o tempo do jogo. Só vale junto com `bot` |
| `debug` | `mapa` | Abre a vista aérea do mapa inteiro, com arrastar, girar e zoom |
| `cam` | `x,z,distância,inclinação,giro` | Fixa a câmera da vista aérea. Só vale junto com `debug=mapa` |

## `bot`: o robô joga sozinho

```
?bot=apressado
```

O turno começa direto, sem menu nem tutorial. O robô aceita as corridas, pilota até o restaurante e o cliente, passa o extrato depois de 4 s e recomeça o jogo 6 s depois do fim. No canto aparece a etiqueta "Robô · perfil".

| Perfil | Como pilota |
|---|---|
| `cauteloso` | Respeita sinal e preferência, anda no limite da via e não costura entre os carros |
| `bom` | Rápido e costura no corredor, mas respeita o sinal e cruza com cuidado. É a referência de "jogador bom" |
| `apressado` | Mais rápido ainda; fura o sinal onde não há radar |
| `kamikaze` | Não para em sinal e não cede a ninguém |

Um nome que não está na lista é ignorado, e o jogo abre no menu normal.

Com o console aberto (F12), o robô escreve um diário que ajuda a caçar problemas: acidentes (com a posição, a velocidade e o veículo atingido), multas, consertos e entregas no prazo ou atrasadas.

Os perfis ficam em `config.autopilot.profiles`, em [`src/config.js`](../src/config.js).

## `vel`: acelerar o tempo

```
?bot=bom&vel=3
```

Multiplica a velocidade do jogo (`3` = três vezes mais rápido). Só tem efeito com `bot`; sem ele, o valor é ignorado.

## `debug=mapa`: vista aérea do mapa

```
?debug=mapa
```

Mostra a cidade inteira de cima, sem neblina e sem menu. Para mexer na câmera:

- arrastar com o botão esquerdo: anda pelo mapa;
- arrastar com o botão direito: gira e inclina;
- roda do mouse: zoom, na direção do cursor.

## `cam`: câmera fixa para screenshots

```
?debug=mapa&cam=295,165,70,35,200
```

Fixa a câmera da vista aérea num ponto, para tirar screenshots que dão sempre o mesmo enquadramento. São cinco números separados por vírgula:

| Posição | Significado | Unidade |
|---|---|---|
| 1 | `x` do ponto para onde a câmera olha | metros |
| 2 | `z` desse ponto | metros |
| 3 | distância da câmera até o ponto | metros |
| 4 | inclinação: `0` olha reto para baixo, perto de `90` fica na horizontal | graus |
| 5 | giro em volta do ponto | graus |

Os dois últimos podem ficar de fora (`cam=0,0,400` olha reto para baixo). O mundo vai de `-size/2` a `+size/2` nos dois eixos, com o centro em `0,0`.

Para achar as coordenadas de um lugar, abra o jogo e rode no console, por exemplo, `__game.sim.city.nodes[10]` (um cruzamento) ou `__game.state().bike` (onde a moto está).

## Combinações úteis

| Endereço | Para quê |
|---|---|
| `?bot=bom&vel=3` | Ver um dia inteiro sendo jogado em poucos minutos |
| `?bot=kamikaze` | Testar batidas, multas e a tela de fim de jogo |
| `?bot=cauteloso&vel=4` | Ver se dá para pagar as contas jogando com cuidado |
| `?debug=mapa` | Conferir o traçado das ruas, o rio e as pontes |
| `?debug=mapa&cam=x,z,80,40,0` | Olhar de perto um cruzamento ou uma ponte |

## Além da URL

O objeto `window.__game`, disponível no console, faz o resto: teleportar a moto, ligar o piloto automático, aceitar ofertas e avançar o tempo. A lista completa está em [`CLAUDE.md`](../CLAUDE.md), na seção "Como verificar sem um humano jogando".
