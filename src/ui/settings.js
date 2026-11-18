/** Preferências gráficas do jogador, guardadas no navegador. O som fica com o módulo de áudio. */
const STORAGE_KEY = 'guig.config';
const DEFAULTS = { shadows: 'on', resolution: 'alta', fps: '60' };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}
