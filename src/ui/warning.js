/** Faixa de aviso no alto da tela: infração em andamento (com contador) ou radar à frente. */
export function createWarning(root) {
  const el = document.createElement('div');
  el.className = 'ui warning';
  el.hidden = true;
  root.append(el);
  let shown = '';

  return {
    /** `kind`: 'perigo' (vermelho) ou 'radar' (âmbar). Texto vazio esconde. */
    show(text, kind = 'perigo') {
      const key = text ? `${kind}|${text}` : '';
      if (key === shown) return;
      shown = key;
      el.hidden = !text;
      el.textContent = text;
      el.dataset.kind = kind;
    },
  };
}
