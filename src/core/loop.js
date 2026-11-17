const STEP = 1 / 60;
const MAX_FRAME = 0.25; // aba em segundo plano não gera uma avalanche de passos

/**
 * Loop de jogo com simulação em passo fixo (60 Hz) e render livre.
 * `step(dt)` avança a simulação; `render(alpha, frameDt)` desenha.
 */
export function createLoop({ step, render }) {
  let last = 0;
  let acc = 0;
  let running = false;

  const loop = {
    timeScale: 1,
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
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    acc += frameDt * loop.timeScale;
    let guard = 0;
    while (acc >= STEP && guard++ < 600) {
      step(STEP);
      acc -= STEP;
    }
    render(acc / STEP, frameDt);
    requestAnimationFrame(frame);
  }

  return loop;
}
