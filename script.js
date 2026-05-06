/*************************************************
 * CONFIGURAÇÃO
 *************************************************/
const CSV_FILE = "cards.csv";
let TAMANHO_BLOCO = 30;

/*************************************************
 * ESTADO GLOBAL
 *************************************************/
let todosCards = [];
let poolIndices = [];
let ordemBloco = [];
let filaErros = [];
let pos = 0;
let mostrandoFrente = true;
let respondidos = new Set();

let acertos = 0;
let erros = 0;

let totalAcertos = Number(localStorage.getItem("anki-total-acertos") || 0);
let totalErros = Number(localStorage.getItem("anki-total-erros") || 0);


// 🔑 CONTROLE DE AUTOPLAY
let audioLiberado = false;

/*************************************************
 * ELEMENTOS DA TELA
 *************************************************/
const elCategoriaAtual = document.getElementById("categoriaAtual");
const elConteudo = document.getElementById("conteudo");
const elCard = document.getElementById("card");
const elAudio = document.getElementById("audio");

const elAcertos = document.getElementById("acertos");
const elErros = document.getElementById("erros");
const elRespondidos = document.getElementById("respondidos");
const elTotalBloco = document.getElementById("totalBloco");

const elFiltroCategoria = document.getElementById("filtroCategoria");
const elTamanhoBloco = document.getElementById("tamanhoBloco");

/*************************************************
 * DESBLOQUEIO DE ÁUDIO (OBRIGATÓRIO PARA AUTOPLAY)
 *************************************************/
// 🔒 Browsers só liberam áudio automático depois de interação
function desbloquearAudio() {
  if (audioLiberado) return;

  audioLiberado = true;

  // "warm-up" do áudio (truque aceito pelos browsers)
  try {
    elAudio.muted = true;
    elAudio.play()
      .then(() => {
        elAudio.pause();
        elAudio.currentTime = 0;
        elAudio.muted = false;
      })
      .catch(() => {});
  } catch {}
}

// ✅ Qualquer clique OU tecla desbloqueia
document.addEventListener("click", desbloquearAudio, { once: true });
document.addEventListener("keydown", desbloquearAudio, { once: true });

/*************************************************
 * LISTENERS DE BOTÕES
 *************************************************/
document.getElementById("btnVirar").onclick = virarCard;
document.getElementById("btnAudio").onclick = tocarAudio;
document.getElementById("btnAcerto").onclick = () => marcarResposta(true);
document.getElementById("btnErro").onclick = () => marcarResposta(false);
document.getElementById("btnEmbaralhar").onclick = () => iniciarBloco(true);
document.getElementById("btnNovoBloco").onclick = () => iniciarBloco(false);
elCard.onclick = virarCard;

elTamanhoBloco.onchange = () => {
  TAMANHO_BLOCO = parseInt(elTamanhoBloco.value, 10);
  iniciarBloco(false);
};

elFiltroCategoria.onchange = () => {
  montarPoolPorCategoria();
  iniciarBloco(false);
};

// Atalhos
document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault();
    virarCard();
  }
  if (e.key.toLowerCase() === "a") marcarResposta(true);
  if (e.key.toLowerCase() === "e") marcarResposta(false);
});

/*************************************************
 * CARREGAR CSV
 *************************************************/
Papa.parse(CSV_FILE, {
  download: true,
  delimiter: ";",
  skipEmptyLines: true,
  complete: (results) => {
    todosCards = results.data
      .map(l => ({
        categoria: (l[0] || "").trim(),
        alemao: (l[1] || "").trim(),
        portugues: (l[2] || "").trim(),
        audio: (l[3] || "").trim()
      }))
      .filter(c => c.categoria && c.alemao && c.portugues);

    montarDropdownCategorias();
    montarPoolPorCategoria();
    iniciarBloco(true);
  }
});

/*************************************************
 * FUNÇÕES PRINCIPAIS
 *************************************************/
function montarDropdownCategorias() {
  const cats = [...new Set(todosCards.map(c => c.categoria))].sort();

  elFiltroCategoria.innerHTML = "";
  elFiltroCategoria.add(new Option("Todas", "__todas__"));

  cats.forEach(c => elFiltroCategoria.add(new Option(c, c)));
}

function montarPoolPorCategoria() {
  const cat = elFiltroCategoria.value;
  poolIndices = [];

  todosCards.forEach((c, i) => {
    if (cat === "__todas__" || c.categoria === cat) {
      poolIndices.push(i);
    }
  });
}

function embaralharArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function iniciarBloco(embaralhar = false) {
  acertos = 0;
  erros = 0;
  respondidos.clear();
  filaErros = [];
  pos = 0;

  let base = [...poolIndices];
  if (embaralhar) embaralharArray(base);

  ordemBloco = base.slice(0, Math.min(TAMANHO_BLOCO, base.length));
  elTotalBloco.innerText = ordemBloco.length;
  atualizarContadores();

  if (ordemBloco.length === 0) {
    elCategoriaAtual.innerText = "Sem cards";
    elConteudo.innerText = "";
    return;
  }
  mostrarCard();
}

function mostrarCard() {
  mostrandoFrente = true;
  const card = todosCards[ordemBloco[pos]];

  elCategoriaAtual.innerText = card.categoria;
  elConteudo.innerText = card.alemao;

  if (card.audio) {
    elAudio.src = card.audio;
    elAudio.style.display = "block";

    // ✅ AUTOPLAY REAL (só após desbloqueio)
    if (audioLiberado) {
      elAudio.currentTime = 0;
      elAudio.play().catch(() => {});
    }
  } else {
    elAudio.style.display = "none";
  }
}

function virarCard() {
  const card = todosCards[ordemBloco[pos]];
  mostrandoFrente = !mostrandoFrente;
  elConteudo.innerText = mostrandoFrente ? card.alemao : card.portugues;
}

function tocarAudio() {
  if (!elAudio.src) return;
  elAudio.currentTime = 0;
  elAudio.play();
}

function marcarResposta(correto) {
  const idx = ordemBloco[pos];
  if (respondidos.has(idx)) return;

  respondidos.add(idx);

  if (correto) {
    acertos++;
    totalAcertos++;
    localStorage.setItem("anki-total-acertos", totalAcertos);
  } else {
    erros++;
    totalErros++;
    filaErros.push(idx);
    localStorage.setItem("anki-total-erros", totalErros);
  }

  atualizarContadores();
  avancar();
}

function avancar() {
  pos++;

  if (pos >= ordemBloco.length) {
    if (filaErros.length > 0) {
      ordemBloco = ordemBloco.concat(filaErros);
      filaErros = [];
      elTotalBloco.innerText = ordemBloco.length;
    } else {
      alert("🎉 Bloco concluído!");
      iniciarBloco(false);
      return;
    }
  }
  mostrarCard();
}


function atualizarContadores() {
  elAcertos.innerText = acertos;
  elErros.innerText = erros;
  elRespondidos.innerText = acertos + erros;

  // totais acumulados
  document.getElementById("totalGlobal").innerText =
    totalAcertos + totalErros;
}


/*************************************************
 * TEMA ESCURO (persistente)
 *************************************************/
const btnTema = document.getElementById("btnTema");

function aplicarTema() {
  const tema = localStorage.getItem("anki-tema") || "claro";
  document.body.classList.toggle("dark", tema === "escuro");
  btnTema.innerText = tema === "escuro" ? "☀ Tema claro" : "🌙 Tema escuro";
}

btnTema.onclick = () => {
  const novo = document.body.classList.contains("dark") ? "claro" : "escuro";
  localStorage.setItem("anki-tema", novo);
  aplicarTema();
};

aplicarTema();

/*************************************************
 * SWIPE MOBILE
 *************************************************/
let xStart = null;
let yStart = null;

elCard.addEventListener("touchstart", e => {
  const t = e.touches[0];
  xStart = t.clientX;
  yStart = t.clientY;
});

elCard.addEventListener("touchend", e => {
  if (xStart === null || yStart === null) return;

  const t = e.changedTouches[0];
  const dx = t.clientX - xStart;
  const dy = t.clientY - yStart;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 50) marcarResposta(true);   // 👉 direita = acerto
    if (dx < -50) marcarResposta(false); // 👈 esquerda = erro
  } else {
    if (dy < -50) virarCard(); // 👆 cima = virar
  }

  xStart = yStart = null;
});
