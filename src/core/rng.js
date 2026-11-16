/** PRNG determinístico (mulberry32). Toda aleatoriedade do mundo passa por aqui. */
export function createRng(seed) {
  let s = seed >>> 0;

  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** Float em [0, 1). */
    next,
    /** Float em [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Inteiro em [min, max], inclusivo. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (array) => array[Math.floor(next() * array.length)],
    chance: (p) => next() < p,
    /** Gerador independente derivado deste: sistemas diferentes não se afetam. */
    fork: (label) => createRng(hash(`${seed}:${label}`)),
  };
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
