/**
 * Ajudantes mínimos de DOM compartilhados por celular, HUD e telas.
 * Os setters guardam o último valor no próprio nó: chamar a cada frame com o mesmo valor não toca no DOM.
 */

/** Monta `html` (um único elemento raiz) dentro de `root` e devolve o elemento. */
export function mount(root, html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const node = template.content.firstElementChild;
  root.appendChild(node);
  return node;
}

/** Mapa { nome: elemento } de todos os `[data-ref]` dentro de `node`. */
export function refs(node) {
  const map = {};
  for (const el of node.querySelectorAll('[data-ref]')) map[el.dataset.ref] = el;
  return map;
}

export function setText(node, value) {
  if (node.__text !== value) {
    node.__text = value;
    node.__key = undefined;
    node.textContent = value;
  }
}

/** Como setText, mas só chama `format(key)` quando `key` muda (evita montar string por frame). */
export function setKeyed(node, key, format) {
  if (node.__key !== key) {
    node.__key = key;
    node.__text = undefined;
    node.textContent = format(key);
  }
}

/** `value` nulo/false remove o atributo. */
export function setAttr(node, name, value) {
  const cache = (node.__attrs ??= {});
  if (cache[name] === value) return;
  cache[name] = value;
  if (value == null || value === false) node.removeAttribute(name);
  else node.setAttribute(name, value === true ? '' : value);
}

export function setStyle(node, prop, value) {
  const cache = (node.__styles ??= {});
  if (cache[prop] === value) return;
  cache[prop] = value;
  node.style.setProperty(prop, value);
}

/** Reinicia uma animação CSS ligada a uma classe. */
export function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}
