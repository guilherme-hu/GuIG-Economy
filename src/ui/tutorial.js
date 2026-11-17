import { wordmark } from './screens.js';

/** Instruções antes do primeiro turno. Quem marcar "não mostrar de novo" não vê mais (fica no navegador). */
const STORAGE_KEY = 'guig.tutorial.visto';

const STEPS = [
  ['1', 'Escolha a corrida', 'Abra o celular com <b>Tab</b> e aceite com <b>1</b>, <b>2</b> ou <b>3</b>. Longe paga mais, mas o prazo aperta. O trajeto até o restaurante não é pago.'],
  ['2', 'Siga as setas', 'As setas no asfalto e a placa no alto da tela levam ao restaurante e depois ao cliente. Pare no marcador para coletar e entregar.'],
  ['3', 'Pague as contas', 'O dia custa R$ 46,80. Combustível, aluguel da moto, multas e consertos saem do que você ganha.'],
];
const RISKS = [
  ['Radar e calçada', 'Sinal vermelho só dá multa onde há radar (caixa laranja no poste); o GPS avisa antes. Calçada e contramão também multam.'],
  ['Batida', 'Até 20 km/h é só um tranco. Até 40 km/h a moto quebra e o conserto é seu. Acima disso é acidente: fim de jogo.'],
  ['Nota e despejo', 'Atrasos derrubam a nota; abaixo de 4,20 a conta é desativada. Dois dias sem pagar as contas, despejo.'],
];

export function createTutorial(root) {
  const el = document.createElement('div');
  el.className = 'ui tutorial';
  el.hidden = true;
  el.innerHTML = `
    <section class="sheet light tutorial__panel" role="dialog" aria-labelledby="tutorial-title">
      <header class="sheet__head">${wordmark()}<span class="chip chip--green">Novo parceiro</span></header>
      <h2 id="tutorial-title">Como funciona o seu turno</h2>
      <p class="tutorial__lead">São 3h45 de rua, das 17h até quase 21h: uns 15 minutos de jogo.</p>
      <ul class="tutorial__steps">
        ${STEPS.map(([n, title, text]) => `<li><span class="tutorial__n">${n}</span><h3>${title}</h3><p>${text}</p></li>`).join('')}
        ${RISKS.map(([title, text]) => `<li data-risk><span class="tutorial__n">!</span><h3>${title}</h3><p>${text}</p></li>`).join('')}
      </ul>
      <footer class="tutorial__footer">
        <label class="tutorial__skip"><input type="checkbox" /> Não mostrar de novo</label>
        <button class="btn btn--brand btn--lg" type="button">Ficar online <span class="kbd">Enter</span></button>
      </footer>
    </section>`;
  root.append(el);
  const button = el.querySelector('button');
  const skip = el.querySelector('input');
  let onDone = null;

  button.addEventListener('click', () => {
    if (skip.checked) remember();
    el.hidden = true;
    onDone?.();
  });

  return {
    /** Mostra as instruções e chama `done` ao fechar; se o jogador já dispensou, chama `done` na hora. */
    show(done) {
      if (dismissed()) return done();
      onDone = done;
      el.hidden = false;
      button.focus();
    },
  };
}

// O armazenamento pode estar bloqueado (janela anônima): aí o tutorial só aparece sempre.
function dismissed() {
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
