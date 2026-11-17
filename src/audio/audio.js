/**
 * Som sintetizado em WebAudio: nenhum arquivo de áudio. Motor com marchas, buzina, ruído da cidade
 * e efeitos curtos (celular, dinheiro, radar, batida). O navegador só libera o som depois de um clique
 * ou tecla: `unlock()` cria o contexto nessa hora.
 */
import { createBikeEngine } from './bikeEngine.js';
const MASTER_VOLUME = 0.04;
const STORAGE_KEY = 'guig.som.mudo';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let horn = null;
  let tire = null;
  let muted = load();

  function unlock() {
    if (ctx) return ctx.state === 'suspended' && ctx.resume();
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
    engine = createBikeEngine(ctx, master);
    horn = createHorn();
    tire = createTireSqueal();
    createCityHum();
  }

  /** Gera `seconds` de ruído branco num buffer reaproveitável. */
  const noiseBuffer = (() => {
    let buffer = null;
    return () => {
      if (buffer) return buffer;
      buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    };
  })();

  function createTireSqueal() {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer();
    noise.loop = true;
    const scrape = ctx.createBiquadFilter();
    scrape.type = 'bandpass';
    scrape.Q.value = 0.85;
    const squeak = ctx.createBiquadFilter();
    squeak.type = 'bandpass';
    squeak.Q.value = 3.2;
    const squeakLevel = ctx.createGain();
    const level = ctx.createGain();
    level.gain.value = 0;
    noise.connect(scrape).connect(level);
    noise.connect(squeak).connect(squeakLevel).connect(level);
    level.connect(master);
    noise.start();

    // A borracha alterna entre agarrar e deslizar em intervalos irregulares.
    let nextGrip = 0;
    let bite = 0;
    return function updateTire(slip, now) {
      if (slip > 0 && now >= nextGrip) {
        bite = Math.random();
        nextGrip = now + 0.024 + Math.random() * 0.065;
        squeak.frequency.setTargetAtTime(950 + 480 * slip + 550 * bite, now, 0.018);
        squeakLevel.gain.setTargetAtTime(0.18 + 0.64 * bite, now, 0.012);
      }
      scrape.frequency.setTargetAtTime(410 + 570 * slip, now, 0.045);
      level.gain.setTargetAtTime(slip * (0.4 + 0.12 * bite), now, 0.025);
    };
  }

  function createHorn() {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    for (const frequency of [415, 523]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = frequency;
      osc.connect(filter);
      osc.start();
    }
    filter.connect(gain).connect(master);
    return gain;
  }

  /** Ruído grave e constante de cidade ao fundo. */
  function createCityHum() {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer();
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  /** Nota curta: `type`, frequência inicial e final, duração, volume, atraso. */
  function tone(type, from, to, duration, volume = 0.15, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  /** Estouro de ruído filtrado (batidas, flash do radar). */
  function burst(duration, cutoff, volume) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(t);
    source.stop(t + duration);
  }

  const sounds = {
    notify: () => (tone('sine', 1320, 1320, 0.12, 0.12), tone('sine', 1760, 1760, 0.18, 0.1, 0.09)),
    offer: () => (tone('triangle', 660, 660, 0.1, 0.12), tone('triangle', 990, 990, 0.16, 0.12, 0.08)),
    money: () => (tone('square', 988, 988, 0.08, 0.06), tone('square', 1319, 1319, 0.3, 0.06, 0.08)),
    fine: () => (burst(0.08, 8000, 0.25), tone('sawtooth', 300, 110, 0.5, 0.12, 0.1)),
    bump: () => (burst(0.25, 1600, 0.5), tone('sine', 120, 50, 0.25, 0.3)),
    crash: () => (burst(1.2, 4000, 0.8), tone('sine', 90, 30, 0.8, 0.5)),
    beep: () => tone('square', 1046, 1046, 0.07, 0.06),
    cancel: () => (tone('triangle', 440, 220, 0.35, 0.12)),
  };

  return {
    unlock,
    play: (name) => sounds[name]?.(),
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem(STORAGE_KEY, muted ? '1' : '');
      } catch {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05);
      return muted;
    },
    /** A cada quadro: motor pela velocidade e acelerador; buzina pela tecla. `riding` = false silencia o motor. */
    update({ speed, throttle, horn: honking, riding, burnout, skid = 0 }) {
      if (!ctx) return;
      const now = ctx.currentTime;
      engine(speed, throttle, riding, burnout);
      tire(riding ? skid : 0, now);
      horn.gain.setTargetAtTime(riding && honking ? 0.08 : 0, now, 0.02);
    },
  };
}

function load() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
