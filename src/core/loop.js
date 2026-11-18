const STEP = 1 / 60;
const MAX_FRAME = 0.25; // aba em segundo plano não gera uma avalanche de passos

/**
 * Loop de jogo com simulação em passo fixo (60 Hz) e render livre.
 * `step(dt)` avança a simulação; `render(alpha, frameDt)` desenha.
 * `maxFps` (0 = sem limite) pula quadros da tela: num monitor de 144 Hz, 60 fps poupa a placa de vídeo.
 */
export function createLoop({ step, render }) {
  let last = 0;
  let acc = 0;
  let running = false;
  let slot = 0; // início do último intervalo de quadro com `maxFps`

  const loop = {
    timeScale: 1,
    maxFps: 0,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
    },
    /** Avança n passos na hora e desenha um quadro, sem esperar o relógio (usado em verificação). */
    advance(steps = 0) {
      for (let i = 0; i < steps; i++) step(STEP);
      render(0, STEP);
    },
  };

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (loop.maxFps > 0) {
      const interval = 1000 / loop.maxFps;
      const elapsed = now - slot;
      if (elapsed < interval - 0.5) return;
      slot += Math.floor((elapsed + 0.5) / interval) * interval; // sem deriva: 60 fps num monitor de 144 Hz dá 60, não 48
    }
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    acc += frameDt * loop.timeScale;
    let guard = 0;
    while (acc >= STEP && guard++ < 600) {
      step(STEP);
      acc -= STEP;
    }
    render(acc / STEP, frameDt);
  }

  return loop;
}
