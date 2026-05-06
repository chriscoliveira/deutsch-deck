// ===== Config =====
const CSV_FILE = "cards.csv"; // precisa estar na raiz do repo
let TAMANHO_BLOCO = 30;

// ===== Estado =====
let todosCards = [];       // todos do CSV (filtrados/limpos)
let poolIndices = [];      // índices disponíveis após filtro de categoria
let ordemBloco = [];       // ordem de índices no bloco atual
let filaErros = [];        // erros voltam ao final
let pos = 0;               // posição no bloco
let mostrandoFrente = true;
let respondidosSet = new Set();

let acertos = 0;
let erros = 0;

// ===== Elementos =====
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

document.getElementById("btnVirar").addEventListener("click", virarCard);
document.getElementById("btnAudio").addEventListener("click", tocarAudio);
document.getElementById("btnAcerto").addEventListener("click", () => marcarResposta(true));
document.getElementById("btnErro").addEventListener("click", () => marcarResposta(false));
document.getElementById("btnEmbaralhar").addEventListener("click", () => iniciarBloco(true));
document.getElementById("btnNovoBloco").addEventListener("click", () => iniciarBloco(false));
elCard.addEventListener("click", virarCard);

elTamanhoBloco.addEventListener("change", () => {
  TAMANHO_BLOCO = parseInt(elTamanhoBloco.value, 10);
  iniciarBloco(false);
});

elFiltroCategoria.addEventListener("change", () => {
  montarPoolPorCategoria();
  iniciarBloco(false);
});

// Atalhos de teclado
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); virarCard(); }
  if (e.key.toLowerCase() === "a") marcarResposta(true);
  if (e.key.toLowerCase() === "e") marcarResposta(false);
});

// ===== Carregar CSV =====
// PapaParse é próprio para parsear CSV no browser e suporta download remoto/local 【2-90d122】
Papa.parse(CSV_FILE, {
  download: true,
  delimiter: ";",
  skipEmptyLines: true,
  complete: (results) => {
    // results.data -> array de linhas (cada linha = array de colunas)
    // formato: [categoria, alemao, portugues, audio]
    todosCards = (results.data || [])
      .map((l) => ({
        categoria: (l[0] ?? "").trim(),
        alemao: (l[1] ?? "").trim(),
        portugues: (l[2] ?? "").trim(),
        audio: (l[3] ?? "").trim(),
      }))
      .filter(c => c.categoria && c.alemao && c.portugues); // limpa linhas quebradas

    montarDropdownCategorias();
    montarPoolPorCategoria();
    iniciarBloco(true);
  }
});

// ===== Funções =====
function montarDropdownCategorias() {
  const categorias = Array.from(new Set(todosCards.map(c => c.categoria))).sort();

  elFiltroCategoria.innerHTML = "";
  const optTodas = document.createElement("option");
  optTodas.value = "__todas__";
  optTodas.textContent = "Todas";
  elFiltroCategoria.appendChild(optTodas);

  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    elFiltroCategoria.appendChild(opt);
  });
}

function montarPoolPorCategoria() {
  const selecionada = elFiltroCategoria.value || "__todas__";
  poolIndices = [];

  for (let i = 0; i < todosCards.length; i++) {
    if (selecionada === "__todas__" || todosCards[i].categoria === selecionada) {
      poolIndices.push(i);
    }
  }
}

// Fisher-Yates (Durstenfeld) shuffle, padrão para embaralhar arrays 【3-8127b6】
function embaralharArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function iniciarBloco(embaralharPool) {
  // reset stats do bloco
  acertos = 0;
  erros = 0;
  respondidosSet = new Set();
  filaErros = [];
  pos = 0;

  // cria ordem do bloco
  const base = [...poolIndices];
  if (embaralharPool) embaralharArray(base);

  ordemBloco = base.slice(0, Math.min(TAMANHO_BLOCO, base.length));

  elTotalBloco.textContent = String(ordemBloco.length);
  atualizarContadores();

  if (ordemBloco.length === 0) {
    elCategoriaAtual.textContent = "Sem cards nessa categoria.";
    elConteudo.textContent = "Verifique o filtro.";
    elAudio.style.display = "none";
    return;
  }
  mostrarCard();
}

function obterIndiceAtual() {
  return ordemBloco[pos];
}

function mostrarCard() {
  mostrandoFrente = true;

  const idx = obterIndiceAtual();
  const card = todosCards[idx];

  elCategoriaAtual.textContent = card.categoria;
  elConteudo.textContent = card.alemao;

  if (card.audio) {
    elAudio.src = card.audio;
    elAudio.style.display = "block";
  } else {
    elAudio.style.display = "none";
    elAudio.removeAttribute("src");
  }
}

function virarCard() {
  if (ordemBloco.length === 0) return;

  const idx = obterIndiceAtual();
  const card = todosCards[idx];

  mostrandoFrente = !mostrandoFrente;
  elConteudo.textContent = mostrandoFrente ? card.alemao : card.portugues;
}

function tocarAudio() {
  if (elAudio.style.display === "none") return;
  elAudio.play();
}

function marcarResposta(correto) {
  if (ordemBloco.length === 0) return;

  const idx = obterIndiceAtual();
  if (respondidosSet.has(idx)) return; // evita marcar duas vezes o mesmo card

  respondidosSet.add(idx);
  if (correto) acertos++;
  else {
    erros++;
    filaErros.push(idx); // errou -> volta depois (reaparece)
  }

  atualizarContadores();
  avancar();
}

function avancar() {
  // pula para o próximo card dentro do bloco
  pos++;

  // terminou o bloco? então anexa os erros (se tiver) e continua
  if (pos >= ordemBloco.length) {
    if (filaErros.length > 0) {
      // adiciona erros ao final e zera filaErros
      ordemBloco = ordemBloco.concat(filaErros);
      filaErros = [];
      elTotalBloco.textContent = String(ordemBloco.length);
    } else {
      alert("🎉 Bloco concluído!");
      iniciarBloco(false);
      return;
    }
  }

  mostrarCard();
}

function atualizarContadores() {
  elAcertos.textContent = String(acertos);
  elErros.textContent = String(erros);
  elRespondidos.textContent = String(acertos + erros);
}
