// Ciclo monocilíndrico 4T de duas válvulas, adaptado de RevSynth (Sanket Pisat).
// https://github.com/sanketp60/revsynth — licença em public/RevSynth-LICENSE.txt.
const SHIFT_SPEEDS = [0, 22, 45, 72, 100, 140];

export function createBikeEngine(ctx, destination) {
  // Uma tabela representa apenas um ciclo de 720 graus. A fase continua entre quadros.
  const cycle = ctx.createBuffer(1, 8192, 44100);
  const samples = cycle.getChannelData(0);
  const pulseLength = Math.floor(samples.length * 0.18);
  for (let i = 0; i < pulseLength; i++) {
    const progress = i / pulseLength;
    const phase = 2 * Math.PI * 53.35 * i / cycle.sampleRate;
    const fundamental = 1.1 * Math.sin(phase / 2) + Math.sin(phase);
    const harmonics = 0.55 * Math.sin(2 * phase) + 0.2 * Math.sin(3.02 * phase + 0.4)
      + 0.08 * Math.sin(4.05 * phase) + 0.03 * Math.sin(5.1 * phase + 0.8)
      + 0.01 * Math.sin(6.15 * phase);
    const piston = 0.5 * Math.cos(4 * Math.PI * progress);
    samples[i] = (fundamental + harmonics + piston + 0.12 * (2 * Math.random() - 1)) * Math.exp(-6 * progress);
  }
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  for (let i = 0; i < pulseLength; i++) samples[i] *= 0.8 / peak;

  const exhaust = ctx.createBufferSource();
  exhaust.buffer = cycle;
  exhaust.loop = true;
  const saturation = ctx.createWaveShaper();
  saturation.curve = Float32Array.from({ length: 1025 }, (_, i) => Math.tanh(2 * (i / 512 - 1)));
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  const rumble = ctx.createBiquadFilter();
  rumble.type = 'highpass';
  rumble.frequency.value = 42;
  const level = ctx.createGain();
  level.gain.value = 0;
  exhaust.connect(saturation).connect(tone).connect(rumble).connect(level).connect(destination);
  exhaust.start();

  let gear = 0;
  let burnoutStart = null;
  return function update(speed, throttle, riding, burnout) {
    const kmh = Math.abs(speed) * 3.6;
    const load = Math.max(0, Math.min(1, throttle));
    while (gear < SHIFT_SPEEDS.length - 1 && kmh >= SHIFT_SPEEDS[gear + 1]) gear++;
    while (gear > 0 && kmh < SHIFT_SPEEDS[gear] - 3) gear--;
    const shiftAt = SHIFT_SPEEDS[gear + 1] ?? 180;
    let rpm = Math.min(8200, Math.max(1500, 7350 * kmh / shiftAt) + 600 * load);
    const now = ctx.currentTime;
    let firing = 1;
    if (burnout && riding) {
      burnoutStart ??= now;
      const elapsed = now - burnoutStart;
      const pulse = ((elapsed - 0.45) * 8) % 1;
      rpm = 2100 + 6100 * Math.min(elapsed / 0.45, 1);
      if (elapsed >= 0.45) {
        rpm -= 650 * pulse;
        firing = pulse < 0.38 ? 0.18 : 1;
      }
    } else {
      burnoutStart = null;
    }
    exhaust.playbackRate.setTargetAtTime(rpm / 120 * cycle.duration, now, 0.045);
    tone.frequency.setTargetAtTime(500 + rpm * 0.15 + load * 700, now, 0.04);
    level.gain.setTargetAtTime(riding ? (0.18 + load * 0.24) * firing : 0, now, burnout ? 0.012 : 0.035);
  };
}

