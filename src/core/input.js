const ACTIONS = {
  Tab: 'phone',
  KeyE: 'phone',
  Escape: 'pause',
  KeyM: 'mute',
  Digit1: 'offer1',
  Digit2: 'offer2',
  Digit3: 'offer3',
  Enter: 'confirm',
};

/**
 * Teclado → intenção do jogador. A simulação lê `state`; ações pontuais
 * (abrir celular, pausar) chegam por `onAction`.
 */
export function createInput(target = window) {
  const down = new Set();
  const handlers = new Set();
  const state = { throttle: 0, steer: 0, brake: false, horn: false };

  const refresh = () => {
    const up = down.has('KeyW') || down.has('ArrowUp');
    const back = down.has('KeyS') || down.has('ArrowDown');
    const left = down.has('KeyA') || down.has('ArrowLeft');
    const right = down.has('KeyD') || down.has('ArrowRight');
    state.throttle = (up ? 1 : 0) - (back ? 1 : 0);
    state.steer = (right ? 1 : 0) - (left ? 1 : 0);
    state.brake = down.has('Space');
    state.horn = down.has('KeyH');
  };

  const onDown = (e) => {
    if (e.code in ACTIONS || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;
    down.add(e.code);
    refresh();
    const action = ACTIONS[e.code];
    if (action) handlers.forEach((fn) => fn(action));
  };
  const onUp = (e) => {
    down.delete(e.code);
    refresh();
  };
  const onBlur = () => {
    down.clear();
    refresh();
  };

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  return {
    state,
    /** Assina ações pontuais. Retorna a função que cancela. */
    onAction(fn) {
      handlers.add(fn);
      return () => handlers.delete(fn);
    },
    dispose() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
