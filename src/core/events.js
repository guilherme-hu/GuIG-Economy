/** Barramento de eventos: o único canal da simulação para UI, áudio e efeitos. */
export function createEvents() {
  const listeners = new Map();

  return {
    /** Assina um tipo de evento. Retorna a função que cancela a assinatura. */
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type).delete(fn);
    },
    emit(type, payload) {
      listeners.get(type)?.forEach((fn) => fn(payload));
      listeners.get('*')?.forEach((fn) => fn(type, payload));
    },
  };
}
