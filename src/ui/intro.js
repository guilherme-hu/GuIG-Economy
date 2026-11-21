import { wordmark } from './screens.js';

/**
 * Introdução antes do primeiro turno: quem é o entregador e o que a uberização cobra dele,
 * em balões que passam um por vez. Aparece só na primeira vez (fica no navegador) e dá para rever pelo menu.
 */
const STORAGE_KEY = 'guig.intro.vista';

/** `slides`: [{ title, text }], de copy.intro. */
export function createIntro(root, { slides, labels }) {
  const el = document.createElement('div');
  el.className = 'ui intro';
  el.hidden = true;
  el.innerHTML = `
    <section class="sheet light intro__card" role="dialog" aria-live="polite" aria-labelledby="intro-title">
      <header class="intro__head">${wordmark()}<span class="intro__count"></span>
        <button class="btn btn--ghost intro__skip" type="button">${labels.skip}<span class="kbd">Esc</span></button>
      </header>
      <h2 id="intro-title"></h2>
      <p class="intro__text"></p>
      <footer class="intro__foot">
        <div class="intro__dots">${slides.map(() => '<i></i>').join('')}</div>
        <button class="btn btn--dark btn--lg intro__next" type="button"></button>
      </footer>
    </section>`;
  root.append(el);
  const card = el.querySelector('.intro__card');
  const title = el.querySelector('h2');
  const text = el.querySelector('.intro__text');
  const count = el.querySelector('.intro__count');
  const next = el.querySelector('.intro__next');
  const dots = [...el.querySelectorAll('.intro__dots i')];
  let index = 0;
  let onDone = null;

  function render() {
    const slide = slides[index];
    const last = index === slides.length - 1;
    title.textContent = slide.title;
    text.textContent = slide.text;
    count.textContent = labels.count(index + 1, slides.length);
    next.innerHTML = `${last ? labels.done : labels.next}<span class="kbd">Enter</span>`;
    dots.forEach((dot, i) => dot.toggleAttribute('data-on', i <= index));
    card.classList.remove('intro__card--in');
    void card.offsetWidth; // reinicia a animação de entrada do balão
    card.classList.add('intro__card--in');
    next.focus({ preventScroll: true });
  }

  function advance() {
    if (index < slides.length - 1) {
      index++;
      return render();
    }
    finish();
  }

  function finish() {
    remember();
    el.hidden = true;
    removeEventListener('keydown', onKey, true);
    const done = onDone;
    onDone = null;
    done?.();
  }

  // Captura antes do jogo: Enter, Espaço e seta avançam; Esc pula. Nada disso chega ao resto do jogo.
  function onKey(e) {
    const keys = { Enter: advance, Space: advance, ArrowRight: advance, Escape: finish };
    const act = keys[e.code];
    if (!act) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) act();
  }

  next.addEventListener('click', advance);
  el.querySelector('.intro__skip').addEventListener('click', finish);
  card.addEventListener('click', (e) => {
    if (!e.target.closest('button')) advance(); // clicar no balão também avança
  });

  return {
    get seen() {
      return seen();
    },
    /** Mostra a introdução e chama `done` ao terminar ou pular. Sem `force`, quem já viu segue direto. */
    show(done, { force = false } = {}) {
      if (!force && seen()) return done();
      onDone = done;
      index = 0;
      el.hidden = false;
      addEventListener('keydown', onKey, true);
      render();
    },
  };
}

// O armazenamento pode estar bloqueado (janela anônima): aí a introdução aparece sempre.
function seen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
function remember() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* sem armazenamento, sem lembrança */
  }
}
