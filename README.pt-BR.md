<div align="center">

# canvas/arcade

**Snake, Breakout e Tetris, reconstruídos do zero com TypeScript e a Canvas API.**

Sem engine de jogo, sem framework de UI, sem dependências em runtime: loop de passo fixo,
lógica de jogo pura coberta por 80 testes unitários, controles de teclado e toque, e um modo
demo em que cada jogo joga sozinho.

[![CI](https://github.com/FabianoArthur/canvas-arcade/actions/workflows/ci.yml/badge.svg)](https://github.com/FabianoArthur/canvas-arcade/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)

**[▶ Jogar no navegador](https://fabianoarthur.github.io/canvas-arcade/)** · [English](README.md)

<img src="docs/assets/demo.gif" width="480" alt="Demo animada: o piloto automático jogando Snake, depois Breakout, depois Tetris, no tema escuro.">

</div>

## O que tem aqui

|     | Jogo         | O que faz dele mais que um brinquedo                                                                                                                                                                       |
| --- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟩  | **Snake**    | Fila de viradas (dois toques rápidos no mesmo tick valem os dois), sem meia-volta suicida, comida nunca nasce no corpo, acelera conforme come, controle por swipe no celular.                              |
| 🟧  | **Breakout** | Colisão círculo × retângulo resolvida pelo eixo de menor penetração, movimento em sub-passos para a bola rápida não atravessar tijolo, ângulo de saída definido pelo ponto em que a bola bate no paddle.   |
| 🟦  | **Tetris**   | No estilo do guideline: rotação SRS com as tabelas reais de wall kick, sorteio 7-bag, peça fantasma, lock delay com reset por movimento, auto-repeat DAS/ARR, pontuação e curva de gravidade do guideline. |

E mais: top-5 local de recordes, efeitos sonoros sintetizados opcionais (WebAudio, mudo por
padrão, sem arquivo de áudio), pausa ao perder o foco, temas claro e escuro que seguem o sistema, suporte a
`prefers-reduced-motion` e layout de celular com controles na tela.

<p align="center"><img src="docs/assets/mobile-tetris.png" width="220" alt="Tetris no celular, tema claro, com os botões na tela para mover, girar, descer e derrubar embaixo do tabuleiro."><br><sub>No celular: controles na tela, tema claro.</sub></p>

<table>
  <tr>
    <td><img src="docs/assets/snake.png" alt="Snake no meio do jogo, tema escuro: uma cobra verde de tamanho 9 indo atrás de um ponto vermelho num tabuleiro xadrez." width="260"></td>
    <td><img src="docs/assets/breakout.png" alt="Breakout no meio do jogo: fileiras de tijolos vermelhos, laranja, amarelos, verdes e azuis, alguns já quebrados, e a bola no ar acima do paddle." width="260"></td>
    <td><img src="docs/assets/tetris.png" alt="Tetris no meio do jogo: uma pilha de tetraminós coloridos, o contorno fantasma onde a peça vai cair e um painel lateral com as três próximas peças, nível e linhas." width="260"></td>
  </tr>
</table>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/menu-dark.png">
  <img src="docs/assets/menu-light.png" alt="O menu do arcade: o título canvas/arcade e três cartões, um por jogo, cada um com uma miniatura desenhada pelo próprio renderizador do jogo, o melhor placar e os controles." width="880">
</picture>

## Como rodar

```bash
git clone https://github.com/FabianoArthur/canvas-arcade.git canvas-arcade
cd canvas-arcade
npm ci
npm run dev          # http://localhost:5173
```

| Comando                              | O que faz                                                     |
| ------------------------------------ | ------------------------------------------------------------- |
| `npm run dev`                        | Servidor do Vite com hot reload                               |
| `npm test`                           | Vitest, 80 testes da lógica dos jogos e da engine             |
| `npm run lint` / `npm run typecheck` | ESLint (typescript-eslint strict, com tipos) / `tsc --noEmit` |
| `npm run build`                      | Checa tipos e gera o site estático em `dist/`                 |

As rotas usam hash para funcionar no GitHub Pages: `#/snake`, `#/breakout`, `#/tetris`, e
`#/<jogo>/demo` para o modo demo.

### Controles

|          | Teclado                                      | Toque                                   |
| -------- | -------------------------------------------- | --------------------------------------- |
| Snake    | Setas / WASD                                 | Swipe no tabuleiro, ou o direcional     |
| Breakout | ← → / A D, Espaço lança · ou só mexa o mouse | Arraste no tabuleiro, toque para lançar |
| Tetris   | ← → move · ↑ gira · ↓ desce · Espaço derruba | Botões embaixo do tabuleiro             |
| Todos    | P / Esc pausa                                | Botão de pausa                          |

## Como funciona

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/architecture.pt-BR-dark.svg">
  <img src="docs/assets/architecture.pt-BR-light.svg" width="880" alt="Diagrama da arquitetura. Teclado, toque e mouse do jogador, ou o piloto automático no modo demo, alimentam um InputBuffer que entrega cada toque exatamente uma vez por passo. Dentro do loop do jogo, o requestAnimationFrame move um FixedStepper que roda update(state, input) a 60 Hz fixos; o update é lógica pura coberta por testes unitários. Depois, render(ctx, state) desenha o estado num canvas HiDPI. Eventos e o placar final saem do update para os efeitos sonoros (WebAudio, mudo por padrão) e para o placar local (localStorage, protegido por try/catch).">
</picture>

- **Passo fixo.** O [`FixedStepper`](src/engine/loop.ts) acumula o tempo real decorrido e
  roda a lógica em passos exatos de 1/60 s: um monitor de 144 Hz não deixa a cobra mais
  rápida e uma aba em segundo plano não avança o jogo de uma vez (o tempo por quadro tem
  teto).
- **Entrada consumida por passo, não por quadro.** O [`InputBuffer`](src/engine/input.ts)
  guarda os toques entre um passo e outro e entrega cada um exatamente uma vez: um toque solto
  antes do passo ainda conta, o auto-repeat do sistema é ignorado e a ordem é mantida.
- **Lógica pura e determinística.** Cada jogo é `create(rng)` + `update(state, input, rng)` +
  `render(ctx, state)`. A lógica nunca toca no DOM nem no relógio, e a aleatoriedade vem de um
  PRNG com semente, então os testes reproduzem situações exatas (wall kick na parede direita,
  um tetris, bola na velocidade máxima contra um tijolo de 4 px).
- **O modo demo usa o mesmo caminho.** Os [pilotos automáticos](src/games/tetris/autopilot.ts)
  geram o mesmo `InputFrame` que um jogador geraria. O Snake usa BFS com checagem de espaço
  livre (flood fill), o Breakout prevê onde a bola vai cair e o Tetris avalia cada encaixe por
  altura, buracos e irregularidade. Os prints e o GIF deste README saem dele, via
  [`scripts/capture.mjs`](scripts/capture.mjs).
- **Armazenamento que não derruba o jogo.** O [`ScoreStore`](src/engine/storage.ts) envolve
  todo acesso ao `localStorage` em `try/catch`, valida o que lê e cai para memória (aba
  anônima, armazenamento bloqueado, JSON corrompido).

```
src/
  engine/      loop, entrada, rng, armazenamento, áudio (sem saber de jogo nenhum)
  games/       snake | breakout | tetris: logic.ts (pura), render.ts, autopilot.ts
  ui/          menu, tela de jogo, overlays, paleta
tests/         specs do Vitest para a engine e a lógica + piloto de cada jogo
scripts/       capture.mjs (prints/GIF), diagram.py (o SVG animado acima)
```

## Testes

```
tests/engine/input.test.ts      10    tests/games/snake.test.ts      12
tests/engine/loop.test.ts        6    tests/games/breakout.test.ts   15
tests/engine/rng.test.ts         5    tests/games/tetris.test.ts     18
tests/engine/storage.test.ts    11    tests/games/autopilot.test.ts   3
```

O CI roda formatação, lint, checagem de tipos, testes e build a cada push e pull request, além
de uma varredura do histórico inteiro com o [gitleaks](https://github.com/gitleaks/gitleaks).
As actions são fixadas por SHA de commit com permissão só de leitura; só o job de deploy do
Pages escreve.

## Histórico

Este repositório começou como uma lista de enunciados de exercícios para iniciantes
(condicionais em JavaScript) de um curso de programação. Eles nunca foram resolvidos aqui e
não eram trabalho original, então deram lugar a este projeto; continuam no histórico do git.

## Licença

[MIT](LICENSE) © 2026 Fabiano Arthur
