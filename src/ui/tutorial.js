/** Instruções antes do primeiro turno. Quem marcar "não mostrar de novo" não vê mais (fica no navegador). */
const STORAGE_KEY = 'guig.tutorial.visto';

const RULES = [
  ['📱', 'Pegue corridas', 'Abra o celular com <b>Tab</b>, aceite uma oferta com <b>1</b>, <b>2</b> ou <b>3</b> e siga a coluna de luz verde: primeiro o restaurante, depois o cliente. Pare em cima do marcador para coletar e entregar.'],
  ['⏱️', 'O prazo manda', 'Chegou cedo, ganha gorjeta. Atrasou, sua nota cai. Nota baixa demais e o Rapidão desativa sua conta. Corrida longa paga mais, mas o prazo aperta.'],
  ['🚦', 'Sinal vermelho', 'Só multa onde tem <b>radar</b> (caixa laranja no poste); o GPS avisa quando há um à frente. Nos outros você pode furar. O risco é seu.'],
  ['💥', 'Batidas', 'Encostar devagar é só um tranco. Entre 20 e 40 km/h a moto quebra e o conserto sai do seu bolso. Acima de 40 km/h é acidente: fim de jogo. Vale para carros e paredes.'],
  ['🚷', 'Calçada e contramão', 'Subiu na calçada, a moto perde velocidade e um contador começa: zerou, multa. Contramão em rua de mão única também multa.'],
  ['💸', 'A conta é sua', 'Combustível, aluguel da moto, multas e consertos são descontados dos seus ganhos. No fim do dia você vê quanto sobrou.'],
];

export function createTutorial(root) {
  const el = document.createElement('div');
  el.className = 'ui tutorial';
  el.hidden = true;
  el.innerHTML = `
    <section class="tutorial__panel" role="dialog" aria-labelledby="tutorial-title">
      <p class="tutorial__eyebrow">Antes de sair</p>
      <h2 id="tutorial-title">Como funciona o seu dia</h2>
      <ul class="tutorial__rules">
        ${RULES.map(([icon, title, text]) => `<li><span class="tutorial__icon">${icon}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}
      </ul>
      <footer class="tutorial__footer">
        <label class="tutorial__skip"><input type="checkbox" /> Não mostrar de novo</label>
        <button class="btn btn--brand btn--lg" type="button">Entendi, começar <span class="kbd">Enter</span></button>
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
