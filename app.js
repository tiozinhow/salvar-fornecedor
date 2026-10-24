'use strict';

const CHAVE = 'meu-fornecedor-v1';
const CHAVE_RESERVA = CHAVE + '-reserva';
const CHAVE_CURTOS = CHAVE + '-curtos';
const VERSAO = 1;
const CORES = ['#E8508D', '#0E8A4E', '#F08A24', '#7C5CFF', '#2B6CB0', '#0E7490'];

const moeda = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const normalizar = texto => String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const porId = (lista, id) => lista.find(x => x.id === id) || null;

function criar(tag, attrs = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(attrs)) {
    if (chave === 'classe') no.className = valor;
    else if (chave === 'texto') no.textContent = valor;
    else if (chave === 'html') no.innerHTML = valor;
    else if (chave.startsWith('on')) no.addEventListener(chave.slice(2), valor);
    else if (valor === true) no.setAttribute(chave, '');
    else if (valor !== false && valor != null) no.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho) no.append(filho);
  }
  return no;
}

function icone(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + id);
  svg.setAttribute('aria-hidden', 'true');
  svg.append(use);
  return svg;
}

function paraPreco(texto) {
  if (texto == null) return null;
  let bruto = String(texto).replace(/[^\d.,]/g, '').trim();
  if (!bruto) return null;
  if (bruto.includes(',')) {
    bruto = bruto.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) {
    bruto = bruto.replace(/\./g, '');
  }
  const numero = Number.parseFloat(bruto);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null;
}

function limparUrl(bruto) {
  if (!bruto) return '';
  let texto = String(bruto).trim();
  const achado = texto.match(/https?:\/\/[^\s"'<>]+/);
  if (achado) texto = achado[0];
  try {
    const alvo = new URL(texto);
    if (/shopee\.com(\.br)?$/i.test(alvo.hostname) || /(^|\.)shopee\.com\.br$/i.test(alvo.hostname)) {
      const produto = alvo.pathname.match(/\/product\/(\d+)\/(\d+)/);
      if (produto) return `https://${alvo.hostname}/product/${produto[1]}/${produto[2]}`;
      alvo.search = '';
      alvo.hash = '';
      return alvo.toString();
    }
    alvo.hash = '';
    return alvo.toString();
  } catch {
    return texto;
  }
}

function idsShopee(url) {
  const bruto = String(url || '');
  const achado = bruto.match(/\/product\/(\d+)\/(\d+)/) || bruto.match(/i\.(\d+)\.(\d+)/);
  if (achado) return { loja: achado[1], produto: achado[2] };
  const item = bruto.match(/[?&]itemid=(\d+)/i);
  const loja = bruto.match(/[?&]shopid=(\d+)/i);
  return item && loja ? { loja: loja[1], produto: item[1] } : null;
}

function abrirNaShopee(url) {
  if (!url) return;
  const ids = idsShopee(url);
  if (ids && /Android/i.test(navigator.userAgent)) {
    const direto = `https://shopee.com.br/product/${ids.loja}/${ids.produto}`;
    const web = encodeURIComponent(direto);
    window.location.href = `intent://shopee.com.br/product/${ids.loja}/${ids.produto}#Intent;scheme=https;package=com.shopee.br;S.browser_fallback_url=${web};end`;
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function calcularMargem(item) {
  if (item.custo == null || item.venda == null || item.custo <= 0) return null;
  const lucro = Math.round((item.venda - item.custo) * 100) / 100;
  const markup = Math.round((lucro / item.custo) * 100);
  let nivel = 'bom';
  if (lucro < 0 || markup < 20) nivel = 'ruim';
  else if (markup < 50) nivel = 'medio';
  return { lucro, markup, nivel };
}

let estado = carregar();

function carregar() {
  const padrao = () => ({ versao: VERSAO, listas: [], itens: [], ajustes: { ordem: 'recentes', filtro: 'todas', ultimoBackup: null, salvoEm: 0 } });
  const ler = chave => {
    try {
      const bruto = localStorage.getItem(chave);
      if (!bruto) return null;
      const dados = JSON.parse(bruto);
      if (!dados || !Array.isArray(dados.itens) || !Array.isArray(dados.listas)) return null;
      return {
        versao: VERSAO,
        listas: dados.listas,
        itens: dados.itens,
        ajustes: Object.assign({ ordem: 'recentes', filtro: 'todas', ultimoBackup: null, salvoEm: 0 }, dados.ajustes)
      };
    } catch {
      return null;
    }
  };
  const principal = ler(CHAVE);
  const reserva = ler(CHAVE_RESERVA);
  if (principal && reserva) {
    const salvoEmPrincipal = Number(principal.ajustes.salvoEm) || 0;
    const salvoEmReserva = Number(reserva.ajustes.salvoEm) || 0;
    const maisRecente = salvoEmReserva > salvoEmPrincipal ? reserva : principal;
    if (maisRecente === reserva) {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(reserva));
      } catch {}
    }
    return maisRecente;
  }
  if (principal) return principal;
  if (reserva) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(reserva));
    } catch {}
    return reserva;
  }
  return padrao();
}

function salvar() {
  try {
    const salvoEmAnterior = Number(estado.ajustes.salvoEm);
    estado.ajustes.salvoEm = Math.max(Date.now(), (Number.isFinite(salvoEmAnterior) ? salvoEmAnterior : 0) + 1);
    const json = JSON.stringify(estado);
    let salvo = false;
    let salvouPrincipal = false;
    let salvouReserva = false;
    try {
      localStorage.setItem(CHAVE, json);
      salvo = true;
      salvouPrincipal = true;
    } catch {}
    try {
      localStorage.setItem(CHAVE_RESERVA, json);
      salvo = true;
      salvouReserva = true;
    } catch {}
    if (salvo) {
      if (!salvouPrincipal || !salvouReserva) {
        avisoSalvamentoProtegido = true;
        const mensagem = !salvouPrincipal
          ? 'Os dados foram guardados na cópia de recuperação. Baixe também um backup para garantir.'
          : 'O catálogo foi salvo, mas a cópia de recuperação não foi atualizada. Baixe um backup para garantir.';
        avisar(mensagem, { prioritario: true, tempo: 10000 });
      } else {
        avisoSalvamentoProtegido = false;
      }
      return true;
    }
  } catch {
  }
  avisoSalvamentoProtegido = true;
  avisar('Não consegui salvar neste aparelho. Baixe um backup pra não perder nada.', { prioritario: true, tempo: 10000 });
  return false;
}

function pedirArmazenamentoPersistente() {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') return;
  navigator.storage.persisted()
    .then(persistido => (persistido ? null : navigator.storage.persist()))
    .catch(() => {});
}

const campoBusca = document.getElementById('campoBusca');
const btnLimparBusca = document.getElementById('btnLimparBusca');
const chipsLista = document.getElementById('chipsLista');
const campoOrdem = document.getElementById('campoOrdem');
const controles = document.getElementById('controles');
const catalogo = document.getElementById('painelCatalogo');
const catalogoVazio = document.getElementById('catalogoVazio');
const semResultado = document.getElementById('semResultado');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const resumoQtd = document.getElementById('resumoQtd');
const resumoCusto = document.getElementById('resumoCusto');

const campoLink = document.getElementById('campoLink');
const btnColarArea = document.getElementById('btnColarArea');
const dica = document.getElementById('dica');
const btnBuscar = document.getElementById('btnBuscar');
const btnBuscarTexto = document.getElementById('btnBuscarTexto');
const previa = document.getElementById('previa');
const previaFicha = document.getElementById('previaFicha');
const previaImagem = document.getElementById('previaImagem');
const previaSemFoto = document.getElementById('previaSemFoto');
const previaNome = document.getElementById('previaNome');
const previaFornecedor = document.getElementById('previaFornecedor');
const previaCusto = document.getElementById('previaCusto');
const previaVenda = document.getElementById('previaVenda');
const previaSelo = document.getElementById('previaSelo');
const previaMargem = document.getElementById('previaMargem');
const previaLucro = document.getElementById('previaLucro');
const previaMarkup = document.getElementById('previaMarkup');
const formulario = document.getElementById('formulario');
const campoNome = document.getElementById('campoNome');
const campoCusto = document.getElementById('campoCusto');
const campoVenda = document.getElementById('campoVenda');
const campoFornecedor = document.getElementById('campoFornecedor');
const campoImagem = document.getElementById('campoImagem');
const chipsForm = document.getElementById('chipsForm');
const campoNota = document.getElementById('campoNota');
const linhaSalvar = document.getElementById('linhaSalvar');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
const tituloAdicionar = document.getElementById('tituloAdicionar');
const subtituloAdicionar = document.getElementById('subtituloAdicionar');

const listas = document.getElementById('painelListas');
const btnNovaLista = document.getElementById('btnNovaLista');
const btnAjudaListas = document.getElementById('btnAjudaListas');
const btnAjudaListasConfiguracao = document.getElementById('btnAjudaListasConfiguracao');
const btnCriarListaCatalogo = document.getElementById('btnCriarListaCatalogo');
const btnBackup = document.getElementById('btnBackup');
const btnCompartilharBackup = document.getElementById('btnCompartilharBackup');
const btnRestaurar = document.getElementById('btnRestaurar');
const arquivoBackup = document.getElementById('arquivoBackup');
const ultimoBackup = document.getElementById('ultimoBackup');
const textoInstalar = document.getElementById('textoInstalar');
const btnInstalar = document.getElementById('btnInstalar');
const topoInstalar = document.getElementById('topoInstalar');
const btnApagarTudo = document.getElementById('btnApagarTudo');

const folha = document.getElementById('folha');
const folhaConteudo = document.getElementById('folhaConteudo');
const dialogo = document.getElementById('dialogo');
const dialogoForm = document.getElementById('dialogoForm');
const dialogoTitulo = document.getElementById('dialogoTitulo');
const dialogoTexto = document.getElementById('dialogoTexto');
const dialogoCorpo = document.getElementById('dialogoCorpo');
const dialogoCancelar = document.getElementById('dialogoCancelar');
const dialogoConfirmar = document.getElementById('dialogoConfirmar');

const aviso = document.getElementById('aviso');
const avisoTexto = document.getElementById('avisoTexto');
const avisoAcao = document.getElementById('avisoAcao');
const tplProduto = document.getElementById('tplProduto');

const vistas = {
  catalogo: document.getElementById('vista-catalogo'),
  adicionar: document.getElementById('vista-adicionar'),
  listas: document.getElementById('vista-listas')
};

let editandoId = null;
let listaSelecionada = null;
let ultimaAcao = null;
let avisoTimer = null;
let avisoSalvamentoProtegido = false;
let promptInstalar = null;
let buscaTimer = null;
let buscando = false;
let buscaToken = 0;

function instantaneo() {
  ultimaAcao = {
    itens: JSON.parse(JSON.stringify(estado.itens)),
    listas: JSON.parse(JSON.stringify(estado.listas))
  };
}

function avisar(texto, opcoes = {}) {
  if (avisoSalvamentoProtegido && !opcoes.prioritario) return;
  avisoTexto.textContent = texto;
  if (opcoes.acao) {
    avisoAcao.hidden = false;
    avisoAcao.textContent = opcoes.acao;
    avisoAcao.onclick = () => {
      esconderAviso();
      opcoes.aoAcao();
    };
  } else {
    avisoAcao.hidden = true;
    avisoAcao.onclick = null;
  }
  aviso.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(esconderAviso, opcoes.tempo || 6500);
}

function esconderAviso() {
  aviso.hidden = true;
  clearTimeout(avisoTimer);
  avisoSalvamentoProtegido = false;
}

function desfazerAcao() {
  if (!ultimaAcao) return;
  estado.itens = ultimaAcao.itens;
  estado.listas = ultimaAcao.listas;
  ultimaAcao = null;
  salvar();
  mostrar();
  avisar('Desfeito');
}

function mostrarAvisoDica(texto, avisoTom) {
  dica.hidden = false;
  dica.textContent = texto;
  dica.classList.toggle('dica--aviso', !!avisoTom);
}

function esconderDica() {
  dica.hidden = true;
  dica.classList.remove('dica--aviso');
}

function irPara(nome, opcoes = {}) {
  if (!vistas[nome]) nome = 'catalogo';
  Object.entries(vistas).forEach(([chave, no]) => {
    no.hidden = chave !== nome;
  });
  document.querySelectorAll('.navegacao__item').forEach(botao => {
    if (botao.dataset.ir === nome) botao.setAttribute('aria-current', 'page');
    else botao.removeAttribute('aria-current');
  });
  if (window.location.hash !== '#' + nome) {
    history.replaceState(null, '', '#' + nome);
  }
  window.scrollTo({ top: 0 });
  if (nome === 'adicionar' && opcoes.novo) {
    resetarFormulario();
    if (opcoes.foco) campoLink.focus({ preventScroll: true });
  }
  if (nome === 'adicionar' && opcoes.foco === undefined && !editandoId && !campoLink.value) {
    campoLink.focus({ preventScroll: true });
  }
  if (nome === 'catalogo') renderCatalogo();
  if (nome === 'listas') renderListas();
  if (nome === 'adicionar') renderChipsForm();
}

function ordenarItens(lista, modo) {
  const col = new Intl.Collator('pt-BR', { sensitivity: 'base' });
  const copia = lista.slice();
  switch (modo) {
    case 'antigas':
      copia.sort((a, b) => a.criado - b.criado);
      break;
    case 'nome':
      copia.sort((a, b) => col.compare(a.titulo || '', b.titulo || ''));
      break;
    case 'custo-maior':
      copia.sort((a, b) => (b.custo ?? -1) - (a.custo ?? -1));
      break;
    case 'custo-menor':
      copia.sort((a, b) => (a.custo ?? Number.MAX_SAFE_INTEGER) - (b.custo ?? Number.MAX_SAFE_INTEGER));
      break;
    case 'markup-maior':
      copia.sort((a, b) => {
        const ma = calcularMargem(a);
        const mb = calcularMargem(b);
        return (mb ? mb.markup : -Infinity) - (ma ? ma.markup : -Infinity);
      });
      break;
    default:
      copia.sort((a, b) => b.criado - a.criado);
  }
  return copia;
}

function filtrarItens() {
  const termo = normalizar(campoBusca.value).trim();
  const modo = estado.ajustes.filtro || 'todas';
  return estado.itens.filter(item => {
    if (modo === 'fixados' && !item.fixado) return false;
    if (modo === 'sem' && item.listaId) return false;
    if (modo !== 'todas' && modo !== 'fixados' && modo !== 'sem' && item.listaId !== modo) return false;
    if (termo) {
      const alvo = normalizar(`${item.titulo} ${item.fornecedor || ''} ${item.nota || ''}`);
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
}

function renderResumo() {
  const total = estado.itens.length;
  resumoQtd.textContent = plural(total, 'produto', 'produtos');
  const soma = estado.itens.reduce((acc, item) => acc + (item.custo || 0), 0);
  const temCusto = estado.itens.some(item => item.custo != null);
  resumoCusto.hidden = !temCusto;
  resumoCusto.textContent = 'Custo ' + moeda(soma);
}

function criarChip({ rotulo, cor, contagem, ativo, aoClicar, classe, iconeId }) {
  const conteudo = [];
  if (cor) conteudo.push(criar('span', { classe: 'chip__ponto', style: `--cor:${cor}` }));
  if (iconeId) conteudo.push(icone(iconeId));
  conteudo.push(document.createTextNode(rotulo));
  if (contagem != null) conteudo.push(criar('span', { classe: 'chip__contagem', texto: contagem }));
  const chip = criar('button', {
    type: 'button',
    classe: 'chip' + (classe ? ' ' + classe : ''),
    'aria-pressed': ativo ? 'true' : 'false',
    onclick: aoClicar
  }, ...conteudo);
  return chip;
}

function renderChips() {
  const modo = estado.ajustes.filtro || 'todas';
  chipsLista.innerHTML = '';
  chipsLista.append(criarChip({
    rotulo: 'Todas',
    contagem: estado.itens.length,
    ativo: modo === 'todas',
    aoClicar: () => definirFiltro('todas')
  }));
  chipsLista.append(criarChip({
    rotulo: 'Fixados',
    iconeId: 'i-fixar',
    contagem: estado.itens.filter(i => i.fixado).length,
    ativo: modo === 'fixados',
    aoClicar: () => definirFiltro('fixados')
  }));
  estado.listas.forEach(lista => {
    chipsLista.append(criarChip({
      rotulo: lista.nome,
      cor: lista.cor,
      contagem: estado.itens.filter(i => i.listaId === lista.id).length,
      ativo: modo === lista.id,
      aoClicar: () => definirFiltro(lista.id)
    }));
  });
  if (estado.itens.some(i => !i.listaId)) {
    chipsLista.append(criarChip({
      rotulo: 'Meus fornecedores',
      contagem: estado.itens.filter(i => !i.listaId).length,
      ativo: modo === 'sem',
      aoClicar: () => definirFiltro('sem')
    }));
  }
  chipsLista.append(criarChip({
    rotulo: 'Nova lista',
    iconeId: 'i-somar',
    classe: 'chip--nova',
    aoClicar: () => abrirEditorLista(null).then(lista => {
      if (lista) {
        definirFiltro(lista.id);
        avisar('Lista criada');
      }
    })
  }));
}

function definirFiltro(valor) {
  estado.ajustes.filtro = valor;
  salvar();
  renderCatalogo();
}

function criarSecao(lista, itens, animarId) {
  const secao = criar('section', { classe: 'secao' });
  const resumo = criar('span', { classe: 'secao__resumo' });
  resumo.append(criar('span', { texto: plural(itens.length, 'produto', 'produtos') }));
  const soma = itens.reduce((acc, item) => acc + (item.custo || 0), 0);
  if (itens.some(item => item.custo != null)) resumo.append(criar('span', { texto: moeda(soma) }));
  const cabecalho = criar('header', { classe: 'secao__cabecalho' },
    criar('span', { classe: 'secao__cor', style: lista ? `--cor:${lista.cor}` : '' }),
    criar('h2', { classe: 'secao__nome', texto: lista ? lista.nome : 'Meus fornecedores' }),
    resumo
  );
  const linhas = criar('div', { classe: 'secao__linhas' });
  itens.forEach((item, indice) => linhas.append(criarProduto(item, indice, animarId)));
  secao.append(cabecalho, linhas);
  return secao;
}

function criarProduto(item, indice, animarId) {
  const no = tplProduto.content.firstElementChild.cloneNode(true);
  no.dataset.id = item.id;
  const img = no.querySelector('img');
  const semFoto = no.querySelector('.produto__semfoto');
  if (item.imagem) {
    img.src = item.imagem;
    img.alt = item.titulo;
    img.addEventListener('error', () => {
      img.hidden = true;
      semFoto.hidden = false;
    }, { once: true });
  } else {
    img.hidden = true;
    semFoto.hidden = false;
  }
  no.querySelector('.produto__fixado').hidden = !item.fixado;
  no.querySelector('.produto__nome').textContent = item.titulo;
  const fornecedor = no.querySelector('.produto__fornecedor');
  if (item.fornecedor) {
    fornecedor.hidden = false;
    fornecedor.textContent = item.fornecedor;
  }
  const custo = no.querySelector('[data-custo]');
  if (item.custo != null) {
    custo.hidden = false;
    custo.textContent = moeda(item.custo);
  }
  const venda = no.querySelector('.produto__venda');
  if (item.venda != null) {
    venda.hidden = false;
    venda.textContent = 'Venda ' + moeda(item.venda);
  }
  const selo = no.querySelector('[data-selo]');
  const margem = calcularMargem(item);
  const lucro = no.querySelector('.produto__lucro');
  if (margem) {
    selo.hidden = false;
    selo.textContent = (margem.markup > 0 ? '+' : '') + margem.markup + '%';
    selo.className = 'selo selo--' + margem.nivel;
    lucro.hidden = false;
    lucro.textContent = 'Lucro est.: ' + moeda(margem.lucro);
    lucro.classList.toggle('produto__lucro--prejuizo', margem.lucro < 0);
  }
  no.querySelector('.produto__abrir').href = item.url;
  if (animarId && item.id === animarId) {
    no.classList.add('produto--novo');
    setTimeout(() => no.classList.remove('produto--novo'), 900);
  }
  return no;
}

function renderCatalogo(animarId) {
  const temItens = estado.itens.length > 0;
  catalogoVazio.hidden = temItens;
  controles.hidden = !temItens;
  if (!temItens) {
    catalogo.innerHTML = '';
    semResultado.hidden = true;
    renderResumo();
    return;
  }
  const modo = estado.ajustes.filtro || 'todas';
  if (modo !== 'todas' && modo !== 'fixados' && modo !== 'sem' && !porId(estado.listas, modo)) {
    estado.ajustes.filtro = 'todas';
  }
  const itens = ordenarItens(filtrarItens(), estado.ajustes.ordem);
  semResultado.hidden = itens.length > 0;
  catalogo.innerHTML = '';
  if (itens.length) {
    const grupos = estado.listas.map(lista => ({
      lista,
      itens: itens.filter(item => item.listaId === lista.id)
    }));
    const semLista = { lista: null, itens: itens.filter(item => !item.listaId) };
    const visiveis = grupos.filter(g => g.itens.length);
    if (semLista.itens.length) visiveis.push(semLista);
    visiveis.forEach(grupo => {
      grupo.itens.sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0));
      catalogo.append(criarSecao(grupo.lista, grupo.itens, animarId));
    });
    if (animarId) {
      const novo = catalogo.querySelector(`[data-id="${animarId}"]`);
      if (novo) {
        const suave = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        setTimeout(() => novo.scrollIntoView({ block: 'center', behavior: suave }), 60);
      }
    }
  }
  renderChips();
  renderResumo();
  campoOrdem.value = estado.ajustes.ordem;
}

function renderListas() {
  listas.innerHTML = '';
  const semLista = estado.itens.filter(item => !item.listaId).length;
  if (!estado.listas.length) {
    listas.append(criar('p', { classe: 'vista__sub', texto: 'Você ainda não criou listas. Crie uma pra separar seus produtos.' }));
  }
  estado.listas.forEach(lista => {
    const itens = estado.itens.filter(item => item.listaId === lista.id);
    const soma = itens.reduce((acc, item) => acc + (item.custo || 0), 0);
    const info = criar('span', { classe: 'lista__info' });
    info.append(criar('span', { texto: plural(itens.length, 'produto', 'produtos') }));
    if (itens.some(item => item.custo != null)) info.append(criar('span', { texto: moeda(soma) }));
    const abrir = criar('button', { type: 'button', classe: 'lista__abrir', onclick: () => {
      definirFiltro(lista.id);
      irPara('catalogo');
    } },
      criar('span', { classe: 'lista__cor', style: `--cor:${lista.cor}` }),
      criar('span', {}, criar('span', { classe: 'lista__nome', texto: lista.nome }), info)
    );
    const editar = criar('button', { type: 'button', classe: 'lista__editar', 'aria-label': `Editar lista ${lista.nome}`, onclick: () => abrirEditorLista(lista) }, icone('i-lapis'));
    listas.append(criar('div', { classe: 'lista' }, abrir, editar));
  });
  if (semLista) {
    const info = criar('span', { classe: 'lista__info' }, criar('span', { texto: plural(semLista, 'produto', 'produtos') }));
    const abrir = criar('button', { type: 'button', classe: 'lista__abrir', onclick: () => {
      definirFiltro('sem');
      irPara('catalogo');
    } }, criar('span', { classe: 'lista__cor' }), criar('span', {}, criar('span', { classe: 'lista__nome', texto: 'Meus fornecedores' }), info));
    listas.append(criar('div', { classe: 'lista lista--sem' }, abrir));
  }
}

function renderChipsForm() {
  chipsForm.innerHTML = '';
  chipsForm.append(criarChip({
    rotulo: 'Meus fornecedores',
    ativo: !listaSelecionada,
    aoClicar: () => {
      listaSelecionada = null;
      renderChipsForm();
      atualizarPrevia();
    }
  }));
  estado.listas.forEach(lista => {
    chipsForm.append(criarChip({
      rotulo: lista.nome,
      cor: lista.cor,
      ativo: listaSelecionada === lista.id,
      aoClicar: () => {
        listaSelecionada = lista.id;
        renderChipsForm();
        atualizarPrevia();
      }
    }));
  });
  chipsForm.append(criarChip({
    rotulo: 'Nova',
    iconeId: 'i-somar',
    classe: 'chip--nova',
    aoClicar: () => abrirEditorLista(null).then(lista => {
      if (lista) {
        listaSelecionada = lista.id;
        renderChipsForm();
        atualizarPrevia();
      }
    })
  }));
}

function atualizarPrevia() {
  const nome = campoNome.value.trim();
  const imagem = campoImagem.value.trim();
  const fornecedor = campoFornecedor.value.trim();
  previaNome.textContent = nome || 'Nome do produto';
  previaFornecedor.hidden = !fornecedor;
  previaFornecedor.textContent = fornecedor;
  const custo = paraPreco(campoCusto.value);
  previaCusto.hidden = custo == null;
  if (custo != null) previaCusto.textContent = moeda(custo);
  const venda = paraPreco(campoVenda.value);
  previaVenda.hidden = venda == null;
  if (venda != null) previaVenda.textContent = 'Venda ' + moeda(venda);
  const margem = calcularMargem({ custo, venda });
  previaSelo.hidden = !margem;
  if (margem) {
    previaSelo.textContent = (margem.markup > 0 ? '+' : '') + margem.markup + '%';
    previaSelo.className = 'selo selo--' + margem.nivel;
  }
  previaMargem.hidden = !margem;
  if (margem) {
    previaLucro.textContent = 'Lucro líquido estimado: ' + moeda(margem.lucro);
    previaMarkup.textContent = 'markup de ' + margem.markup + '%';
    previaMargem.classList.toggle('margem--prejuizo', margem.lucro < 0);
  }
  if (imagem) {
    previaImagem.src = imagem;
    previaImagem.hidden = false;
    previaSemFoto.hidden = true;
  } else {
    previaImagem.hidden = true;
    previaImagem.removeAttribute('src');
    previaSemFoto.hidden = false;
  }
  const lista = porId(estado.listas, listaSelecionada);
  previaFicha.style.setProperty('--cor', lista ? lista.cor : '');
  previa.hidden = !(nome || imagem || custo != null);
}

previaImagem.addEventListener('error', () => {
  previaImagem.hidden = true;
  previaSemFoto.hidden = false;
});

function resetarFormulario() {
  editandoId = null;
  listaSelecionada = null;
  campoLink.value = '';
  campoNome.value = '';
  campoCusto.value = '';
  campoVenda.value = '';
  campoFornecedor.value = '';
  campoImagem.value = '';
  campoNota.value = '';
  tituloAdicionar.textContent = 'Adicionar produto';
  subtituloAdicionar.textContent = 'Cole o link para tentar buscar nome, preço e foto. Confira os dados e complete o fornecedor e o custo.';
  btnSalvar.textContent = 'Salvar produto';
  btnCancelarEdicao.hidden = true;
  formulario.hidden = true;
  linhaSalvar.hidden = true;
  previa.hidden = true;
  esconderDica();
  atualizarPrevia();
  renderChipsForm();
}

function abrirEdicao(id) {
  const item = porId(estado.itens, id);
  if (!item) return;
  editandoId = id;
  listaSelecionada = item.listaId;
  campoLink.value = item.url;
  campoNome.value = item.titulo;
  campoCusto.value = item.custo != null ? String(item.custo).replace('.', ',') : '';
  campoVenda.value = item.venda != null ? String(item.venda).replace('.', ',') : '';
  campoFornecedor.value = item.fornecedor || '';
  campoImagem.value = item.imagem || '';
  campoNota.value = item.nota || '';
  tituloAdicionar.textContent = 'Editar produto';
  subtituloAdicionar.textContent = 'Ajuste o que precisar. O produto continua na lista em que está.';
  btnSalvar.textContent = 'Salvar alterações';
  btnCancelarEdicao.hidden = false;
  formulario.hidden = false;
  linhaSalvar.hidden = false;
  atualizarPrevia();
  renderChipsForm();
  irPara('adicionar');
}

async function salvarProduto() {
  const url = limparUrl(campoLink.value.trim());
  const titulo = campoNome.value.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    mostrarAvisoDica('Cole o link completo do produto, começando com https://', true);
    campoLink.focus();
    return;
  }
  if (!titulo) {
    mostrarAvisoDica('Dê um nome pro produto. A Shopee nem sempre manda o nome pronto.', true);
    campoNome.focus();
    return;
  }
  const dados = montarDadosDoFormulario(url);
  const duplicado = estado.itens.find(item => item.id !== editandoId && item.url === url);
  if (duplicado && !editandoId) {
    const escolha = await abrirDialogo({
      titulo: 'Esse link já está no catálogo',
      texto: `"${duplicado.titulo}" já usa esse link. O que você quer fazer?`,
      confirmar: 'Substituir o antigo',
      cancelar: 'Cancelar',
      extra: [{
        rotulo: 'Manter os dois',
        aoClicar: 'manter'
      }]
    });
    if (escolha === 'manter') {
      salvarNovo(dados);
      return;
    }
    if (escolha === 'confirmar') {
      instantaneo();
      Object.assign(duplicado, dados, { alterado: Date.now() });
      salvar();
      irPara('catalogo');
      renderCatalogo(duplicado.id);
      avisar('Produto atualizado no lugar do antigo', { acao: 'Desfazer', aoAcao: desfazerAcao });
      resetarFormulario();
      return;
    }
    return;
  }
  if (editandoId) {
    const item = porId(estado.itens, editandoId);
    if (!item) return;
    instantaneo();
    Object.assign(item, dados, { alterado: Date.now() });
    salvar();
    irPara('catalogo');
    renderCatalogo(item.id);
    avisar('Alterações salvas', { acao: 'Desfazer', aoAcao: desfazerAcao });
    resetarFormulario();
    return;
  }
  salvarNovo(dados);
}

function salvarNovo(dados, silencioso) {
  instantaneo();
  const filtroAtual = estado.ajustes.filtro;
  if (!dados.listaId && filtroAtual && ['todas', 'fixados', 'sem'].indexOf(filtroAtual) === -1 && porId(estado.listas, filtroAtual)) {
    dados.listaId = filtroAtual;
  }
  const item = Object.assign({
    id: uid(),
    fixado: false,
    criado: Date.now(),
    alterado: Date.now()
  }, dados);
  estado.itens.push(item);
  salvar();
  resetarFormulario();
  if (silencioso) {
    avisar(`"${item.titulo}" entrou no catálogo`, { acao: 'Desfazer', aoAcao: desfazerAcao });
    renderCatalogo();
    renderResumo();
  } else {
    irPara('catalogo');
    renderCatalogo(item.id);
    avisar('Produto salvo no catálogo', { acao: 'Desfazer', aoAcao: desfazerAcao });
  }
}

const PROXIES_HTML = [
  { tipo: 'html', montar: url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { tipo: 'jina', montar: url => `https://r.jina.ai/${url}` },
  { tipo: 'html', montar: url => `https://corsproxy.io/?url=${encodeURIComponent(url)}` },
  { tipo: 'html', montar: url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` }
];

const APIS_METADADOS = [
  url => `https://api.dub.co/metatags?url=${encodeURIComponent(url)}`,
  url => `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`
];

function infoItemShopee(url) {
  try {
    const alvo = new URL(url);
    if (!/(^|\.)shopee\.com(\.br)?$/i.test(alvo.hostname)) return null;
    const achado = alvo.pathname.match(/\/product\/(\d+)\/(\d+)/) || alvo.pathname.match(/-i\.(\d+)\.(\d+)/);
    if (!achado) return null;
    return { loja: achado[1], item: achado[2] };
  } catch {
    return null;
  }
}

function ehLinkCurtoShopee(url) {
  try {
    const alvo = new URL(url);
    if (/(^|\.)shp\.ee$/i.test(alvo.hostname) || /(^|\.)shope\.ee$/i.test(alvo.hostname)) return true;
    return /(^|\.)shopee\.com(\.br)?$/i.test(alvo.hostname) && !infoItemShopee(url);
  } catch {
    return false;
  }
}

function enderecoComIds(texto) {
  const bruto = String(texto || '');
  const achado = bruto.match(/\/product\/(\d+)\/(\d+)/) || bruto.match(/-i\.(\d+)\.(\d+)/);
  return achado ? `https://shopee.com.br/product/${achado[1]}/${achado[2]}` : '';
}

function enderecoCanonicoDoHtml(html) {
  const bruto = String(html || '');
  const pistas = [
    bruto.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i),
    bruto.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i),
    bruto.match(/["']url["']\s*:\s*["'](https?:\\?\/\\?\/shopee\.com\.br\\?\/product\\?\/\d+\\?\/\d+)/i)
  ];
  for (const pista of pistas) {
    if (!pista) continue;
    const endereco = enderecoComIds(pista[1].replace(/\\\//g, '/'));
    if (endereco) return endereco;
  }
  return '';
}

function cacheLinkCurto(url) {
  try {
    const bruto = localStorage.getItem(CHAVE_CURTOS);
    if (!bruto) return '';
    const mapa = JSON.parse(bruto);
    return (mapa && mapa[url]) || '';
  } catch {
    return '';
  }
}

function guardarLinkCurto(url, canonico) {
  try {
    const bruto = localStorage.getItem(CHAVE_CURTOS);
    const mapa = bruto ? JSON.parse(bruto) : {};
    mapa[url] = canonico;
    localStorage.setItem(CHAVE_CURTOS, JSON.stringify(mapa));
  } catch {}
}

function resolverLinkCurtoShopee(url) {
  const guardado = cacheLinkCurto(url);
  if (guardado) return Promise.resolve(guardado);
  const codificado = encodeURIComponent(url);
  let espelho = '';
  try {
    espelho = urlTraduzida(url);
  } catch {}
  const consultas = [
    espelho
      ? fetch(`https://r.jina.ai/${espelho}`, { headers: { 'x-respond-with': 'html' } })
          .then(resposta => (resposta.ok ? resposta.text() : ''))
          .then(texto => enderecoCanonicoDoHtml(texto))
      : Promise.resolve(''),
    fetch(`https://api.microlink.io/?url=${codificado}&meta=true`)
      .then(resposta => (resposta.ok ? resposta.json() : null))
      .then(dados => enderecoComIds(dados && dados.data && dados.data.url)),
    fetch(`https://api.allorigins.win/get?url=${codificado}`)
      .then(resposta => (resposta.ok ? resposta.json() : null))
      .then(dados => enderecoComIds(dados && dados.status && dados.status.url)),
    fetch(`https://corsproxy.io/?url=${codificado}`)
      .then(resposta => (resposta.ok ? resposta.text() : ''))
      .then(texto => enderecoCanonicoDoHtml(texto)),
    fetch(`https://api.codetabs.com/v1/proxy?quest=${codificado}`)
      .then(resposta => (resposta.ok ? resposta.text() : ''))
      .then(texto => enderecoCanonicoDoHtml(texto))
  ].map(consulta => comTempo(consulta, 8000).catch(() => ''));
  return new Promise(resolve => {
    let restantes = consultas.length;
    let terminou = false;
    const concluir = valor => {
      if (terminou) return;
      if (valor) {
        terminou = true;
        guardarLinkCurto(url, valor);
        resolve(valor);
        return;
      }
      if (--restantes <= 0) {
        terminou = true;
        resolve('');
      }
    };
    consultas.forEach(consulta => consulta.then(concluir).catch(() => concluir('')));
    setTimeout(() => {
      if (terminou) return;
      terminou = true;
      resolve('');
    }, 9000);
  });
}

function urlTraduzida(url) {
  const alvo = new URL(url);
  const espelho = alvo.hostname.replace(/\./g, '-') + '.translate.goog';
  const copia = new URL(`https://${espelho}${alvo.pathname}`);
  copia.searchParams.set('_x_tr_sl', 'pt');
  copia.searchParams.set('_x_tr_tl', 'en');
  copia.searchParams.set('_x_tr_hl', 'pt-BR');
  return copia.toString();
}

function estrategiasShopee(url) {
  if (!infoItemShopee(url)) return [];
  let traduzida;
  try {
    traduzida = urlTraduzida(url);
  } catch {
    return [];
  }
  return [
    {
      tipo: 'html',
      tempo: 15000,
      headers: { 'x-respond-with': 'html' },
      montar: () => `https://r.jina.ai/${traduzida}`
    },
    {
      tipo: 'api',
      tempo: 15000,
      montar: () => `https://api.microlink.io/?url=${encodeURIComponent(traduzida)}&meta=true`
    }
  ];
}

function limparTitulo(titulo, url) {
  const limpo = String(titulo || '').replace(/\s+/g, ' ').trim().replace(/\s*[|\-–]\s*Shopee.*$/i, '').trim();
  const chave = normalizar(limpo);
  if (!chave || chave === 'shopee' || chave === 'shopee brasil') return '';
  if (/ofertas incriveis|melhores precos do mercado|precisa de ajuda|login necessario|faca login|parece que voce ainda nao/.test(chave)) return '';
  if (/^\d+$/.test(chave)) return '';
  if (/-i\.\d+\.\d+/i.test(limpo) || /%[0-9A-F]{2}/i.test(limpo)) return '';
  if (!/\s/.test(limpo) && /[-_]/.test(limpo)) return '';
  if (url) {
    try {
      const partes = new URL(url).pathname.split('/').filter(Boolean);
      let ultimo = partes[partes.length - 1] || '';
      try {
        ultimo = decodeURIComponent(ultimo);
      } catch {}
      if (ultimo && chave === normalizar(ultimo)) return '';
    } catch {}
  }
  return limpo;
}

function limparImagem(endereco) {
  const limpo = String(endereco || '').trim();
  if (!/^https?:\/\//i.test(limpo)) return '';
  if (/shopeemobile\.com|vlibras|gstatic\.com/i.test(limpo)) return '';
  return limpo;
}

function comTempo(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('tempo')), ms))
  ]);
}

function tituloDaUrl(url) {
  if (ehLinkCurtoShopee(url)) return '';
  try {
    const alvo = new URL(url);
    const partes = alvo.pathname.split('/').filter(Boolean);
    let ultimo = partes[partes.length - 1] || '';
    try {
      ultimo = decodeURIComponent(ultimo);
    } catch {}
    const limpo = ultimo
      .replace(/-i\.\d+\.\d+$/i, '')
      .replace(/[-_+]+/g, ' ')
      .replace(/\s*[.,;]+\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (limpo.length > 3 && !/^\d+$/.test(limpo)) {
      return limpo
        .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (achado, separador, letra) => separador + letra.toUpperCase())
        .slice(0, 120);
    }
  } catch {}
  return '';
}

function extrairDadosJina(texto) {
  const titulo = (texto.match(/^Title:\s*(.+)$/m) || [])[1] || '';
  const imagens = [...texto.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map(achado => achado[1]);
  const daShopee = imagens.filter(endereco => /susercontent\.com/i.test(endereco));
  const imagem = (daShopee.find(endereco => !/_tn(\?|$)/i.test(endereco)) || daShopee[0] || '').replace(/_tn(\?.*)?$/i, '');
  const preco = (texto.match(/R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/) || [])[0] || '';
  return { titulo: titulo.trim(), imagem, preco };
}

function extrairDadosApi(json) {
  const dados = json && json.data ? json.data : json;
  if (!dados || typeof dados !== 'object') return { titulo: '', imagem: '', preco: '' };
  let imagem = dados.image || dados.ogImage || dados.images || '';
  if (Array.isArray(imagem)) imagem = imagem[0] || '';
  if (imagem && typeof imagem === 'object') imagem = imagem.url || '';
  const titulo = dados.title || dados.name || dados.ogTitle || '';
  const preco = dados.price || dados.amount || '';
  return {
    titulo: String(titulo || '').trim(),
    imagem: String(imagem || '').trim(),
    preco: String(preco || '').trim()
  };
}

async function tentarEstrategia(estrategia, url, ms) {
  const resposta = await comTempo(fetch(estrategia.montar(url), estrategia.headers ? { headers: estrategia.headers } : undefined), ms);
  if (!resposta.ok) throw new Error('status');
  let dados;
  if (estrategia.tipo === 'html') {
    dados = extrairDados(await comTempo(resposta.text(), ms));
  } else if (estrategia.tipo === 'jina') {
    dados = extrairDadosJina(await comTempo(resposta.text(), ms));
  } else {
    dados = extrairDadosApi(await comTempo(resposta.json(), ms));
  }
  dados.titulo = limparTitulo(dados.titulo, url);
  dados.imagem = limparImagem(dados.imagem);
  if (!dados.titulo && !dados.imagem) throw new Error('vazio');
  return dados;
}

function coletarMelhores(promessas, ms) {
  return new Promise(resolve => {
    let melhor = null;
    let terminou = false;
    let restantes = promessas.length;
    const concluir = dados => {
      if (dados) {
        melhor = melhor ? {
          titulo: melhor.titulo || dados.titulo,
          imagem: melhor.imagem || dados.imagem,
          preco: melhor.preco || dados.preco
        } : dados;
      }
      if (terminou) return;
      if (melhor && melhor.titulo && melhor.imagem) {
        terminou = true;
        resolve(melhor);
        return;
      }
      if (--restantes <= 0) {
        terminou = true;
        resolve(melhor);
      }
    };
    setTimeout(() => {
      if (terminou) return;
      terminou = true;
      resolve(melhor);
    }, ms);
    promessas.forEach(promessa => {
      Promise.resolve(promessa).then(concluir).catch(() => concluir(null));
    });
  });
}

function montarDadosDoFormulario(url) {
  return {
    url,
    titulo: campoNome.value.trim(),
    custo: paraPreco(campoCusto.value),
    venda: paraPreco(campoVenda.value),
    fornecedor: campoFornecedor.value.trim(),
    imagem: campoImagem.value.trim(),
    nota: campoNota.value.trim(),
    listaId: listaSelecionada
  };
}

function extrairDados(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = nome => {
    const no = doc.querySelector(`meta[property="${nome}"], meta[name="${nome}"]`);
    return no ? (no.getAttribute('content') || '').trim() : '';
  };
  let titulo = meta('og:title') || meta('twitter:title') || (doc.title || '').trim();
  let imagem = meta('og:image') || meta('twitter:image') || '';
  let preco = meta('product:price:amount') || meta('og:price:amount') || '';
  if (!preco || !imagem) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const dados = JSON.parse(script.textContent);
        const produtos = Array.isArray(dados) ? dados : [dados];
        for (const produto of produtos) {
          if (!produto) continue;
          if (!titulo && produto.name) titulo = String(produto.name);
          if (!imagem && produto.image) {
            imagem = Array.isArray(produto.image) ? produto.image[0] : String(produto.image);
          }
          const oferta = produto.offers && (Array.isArray(produto.offers) ? produto.offers[0] : produto.offers);
          if (!preco && oferta && (oferta.price || oferta.lowPrice)) preco = String(oferta.price || oferta.lowPrice);
        }
      } catch {}
    }
  }
  return { titulo, imagem, preco };
}

async function buscarDados(origem = 'manual') {
  let url = limparUrl(campoLink.value.trim());
  if (!/^https?:\/\//i.test(url)) {
    mostrarAvisoDica('Cole o link completo do produto, começando com https://', true);
    campoLink.focus();
    return;
  }
  const token = ++buscaToken;
  campoLink.value = url;
  buscando = true;
  formulario.hidden = false;
  linhaSalvar.hidden = false;
  btnBuscar.disabled = true;
  btnBuscar.classList.add('botao--carregando');
  btnBuscar.querySelector('use').setAttribute('href', '#i-girar');
  btnBuscarTexto.textContent = 'Buscando…';
  mostrarAvisoDica('Procurando nome, foto e preço na página do produto…');
  let sucesso = null;
  let curtoSemDestino = false;
  try {
    if (ehLinkCurtoShopee(url)) {
      mostrarAvisoDica('Abrindo o link curto da Shopee…');
      const canonico = await resolverLinkCurtoShopee(url);
      if (token !== buscaToken) return;
      if (canonico) {
        url = canonico;
        campoLink.value = canonico;
        mostrarAvisoDica('Procurando nome, foto e preço na página do produto…');
      } else {
        curtoSemDestino = true;
      }
    }
    const estrategias = estrategiasShopee(url)
      .concat(PROXIES_HTML)
      .concat(APIS_METADADOS.map(montar => ({ tipo: 'api', tempo: 8000, montar })));
    sucesso = await coletarMelhores(
      estrategias.map(estrategia => tentarEstrategia(estrategia, url, estrategia.tempo || 9000)),
      12000
    );
  } finally {
    if (token === buscaToken) {
      buscando = false;
      btnBuscar.disabled = false;
      btnBuscar.classList.remove('botao--carregando');
      btnBuscar.querySelector('use').setAttribute('href', '#i-busca');
      btnBuscarTexto.textContent = 'Buscar dados do produto';
    }
  }
  if (token !== buscaToken) return;
  if (sucesso) {
    let achou = 0;
    if (sucesso.titulo && !campoNome.value.trim()) {
      campoNome.value = sucesso.titulo;
      achou++;
    }
    if (sucesso.imagem && !campoImagem.value.trim()) {
      campoImagem.value = sucesso.imagem;
      achou++;
    }
    const preco = paraPreco(sucesso.preco);
    if (preco != null && !campoCusto.value.trim()) {
      campoCusto.value = String(preco).replace('.', ',');
      achou++;
    }
    atualizarPrevia();
    const existente = estado.itens.find(item => item.url === url);
    if (origem === 'auto' && !editandoId && sucesso.titulo && limparUrl(campoLink.value.trim()) === url) {
      if (existente) {
        mostrarAvisoDica(`Esse link já está no catálogo: "${existente.titulo}". Salve se quiser atualizar os dados dele.`, true);
      } else {
        salvarNovo(montarDadosDoFormulario(url), true);
        return;
      }
    } else if (achou) {
      const semCusto = !campoCusto.value.trim();
      mostrarAvisoDica(`Busquei ${plural(achou, 'informação', 'informações')}. ` + (semCusto
        ? 'O preço a Shopee não libera — confira na Shopee e digite o custo.'
        : 'Confira e ajuste o que precisar.'));
    } else {
      mostrarAvisoDica('A página respondeu, mas os campos já estavam preenchidos. Confira os dados.');
    }
  } else {
    const palpite = tituloDaUrl(url);
    if (palpite && !campoNome.value.trim()) {
      campoNome.value = palpite;
    }
    if (curtoSemDestino) {
      mostrarAvisoDica('Não consegui abrir esse link curto agora. Tenta de novo em alguns segundos ou cole o link completo do produto.', true);
    } else {
      mostrarAvisoDica('A Shopee não liberou os dados desta vez. ' + (palpite
        ? 'Deixei um nome provisório — confira na Shopee e complete foto e custo.'
        : 'Confira na Shopee e preencha nome, foto e custo.'), true);
    }
    atualizarPrevia();
  }
}

function botaoFolha(idIcone, texto, aoClicar, classeExtra) {
  const botao = criar('button', { type: 'button', classe: 'folha__acao' + (classeExtra ? ' ' + classeExtra : '') },
    icone(idIcone), criar('span', { texto })
  );
  botao.addEventListener('click', aoClicar);
  return botao;
}

function abrirFolha(id) {
  const item = porId(estado.itens, id);
  if (!item) return;
  folhaConteudo.innerHTML = '';
  const lista = porId(estado.listas, item.listaId);
  const cabecalho = criar('div', { classe: 'folha__cabecalho' });
  if (item.imagem) {
    const img = criar('img', { classe: 'folha__miniatura', src: item.imagem, alt: '' });
    img.addEventListener('error', () => img.replaceWith(criar('div', { classe: 'folha__miniatura' })), { once: true });
    cabecalho.append(img);
  } else {
    cabecalho.append(criar('div', { classe: 'folha__miniatura' }));
  }
  const info = criar('div', { style: 'min-width:0' });
  info.append(criar('h2', { classe: 'folha__nome', texto: item.titulo }));
  const meta = criar('p', { classe: 'folha__meta' });
  if (item.custo != null) meta.append(criar('span', { texto: 'Custo ' + moeda(item.custo) }));
  if (item.venda != null) meta.append(criar('span', { texto: 'Venda ' + moeda(item.venda) }));
  const margem = calcularMargem(item);
  if (margem) {
    meta.append(criar('span', { texto: 'Lucro líquido estimado ' + moeda(margem.lucro) }));
    meta.append(criar('span', { texto: (margem.markup > 0 ? '+' : '') + margem.markup + '%' }));
  }
  if (lista) {
    const comCor = criar('span', { classe: 'folha__pasta', style: `--cor:${lista.cor}` }, criar('i'), criar('span', { texto: lista.nome }));
    meta.append(comCor);
  }
  info.append(meta);
  if (margem) {
    info.append(criar('p', { classe: 'folha__aviso-lucro', texto: 'Não inclui taxas ou impostos da Amazon.' }));
  }
  cabecalho.append(info);

  const acoes = criar('div');
  const abrirApp = criar('a', { classe: 'folha__acao', href: item.url, target: '_blank', rel: 'noopener' },
    icone('i-abrir'), criar('span', { texto: 'Ir ao fornecedor' })
  );
  abrirApp.addEventListener('click', evento => {
    evento.preventDefault();
    fecharFolha();
    abrirNaShopee(item.url);
  });
  acoes.append(abrirApp);
  acoes.append(botaoFolha('i-lapis', 'Editar produto', () => {
    fecharFolha();
    abrirEdicao(item.id);
  }));
  acoes.append(botaoFolha('i-fixar', item.fixado ? 'Tirar do topo' : 'Fixar no topo', () => {
    item.fixado = !item.fixado;
    item.alterado = Date.now();
    salvar();
    fecharFolha();
    renderCatalogo();
    avisar(item.fixado ? 'Fixado no topo' : 'Não está mais fixado');
  }));
  acoes.append(criar('hr', { classe: 'folha__separador' }));
  acoes.append(botaoFolha('i-copiar', 'Copiar link', () => copiarTexto(item.url, 'Link copiado')));
  acoes.append(botaoFolha('i-copiar', 'Copiar nome e link', () => copiarTexto(item.titulo + '\n' + item.url, 'Nome e link copiados')));
  acoes.append(botaoFolha('i-mover', 'Mover para lista…', () => {
    grupoMover.hidden = false;
  }));
  const grupoMover = criar('div', { hidden: true });
  grupoMover.append(criar('p', { classe: 'folha__grupo-titulo', texto: 'Escolha a lista' }));
  const chipsMover = criar('div', { classe: 'chips' });
  const moverPara = (listaId, nome) => {
    item.listaId = listaId;
    item.alterado = Date.now();
    salvar();
    fecharFolha();
    renderCatalogo();
    avisar(nome ? `Movido para ${nome}` : 'Movido para "Meus fornecedores"');
  };
  chipsMover.append(criarChip({ rotulo: 'Meus fornecedores', ativo: !item.listaId, aoClicar: () => moverPara(null, null) }));
  estado.listas.forEach(alvo => chipsMover.append(criarChip({
    rotulo: alvo.nome,
    cor: alvo.cor,
    ativo: item.listaId === alvo.id,
    aoClicar: () => moverPara(alvo.id, alvo.nome)
  })));
  grupoMover.append(chipsMover);
  acoes.append(grupoMover);
  acoes.append(criar('hr', { classe: 'folha__separador' }));
  acoes.append(botaoFolha('i-lixeira', 'Excluir produto', async () => {
    const resposta = await abrirDialogo({
      titulo: 'Excluir produto',
      texto: `"${item.titulo}" sai do catálogo. Dá pra desfazer logo depois.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (resposta !== 'confirmar') return;
    instantaneo();
    estado.itens = estado.itens.filter(x => x.id !== item.id);
    salvar();
    fecharFolha();
    renderCatalogo();
    avisar('Produto excluído', { acao: 'Desfazer', aoAcao: desfazerAcao });
  }, 'folha__acao--perigo'));

  folhaConteudo.append(cabecalho, acoes);
  if (typeof folha.showModal === 'function') folha.showModal();
  else folha.setAttribute('open', '');
}

function fecharFolha() {
  if (folha.open) folha.close();
}

async function copiarTexto(texto, mensagem) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar(mensagem);
  } catch {
    const area = criar('textarea', { style: 'position:fixed;opacity:0' });
    area.value = texto;
    document.body.append(area);
    area.select();
    try {
      document.execCommand('copy');
      avisar(mensagem);
    } catch {
      avisar('Não consegui copiar. Segure o link e copie na mão.');
    }
    area.remove();
  }
  fecharFolha();
}

let resolverDialogo = null;

function abrirDialogo(opcoes) {
  return new Promise(resolve => {
    dialogoTitulo.textContent = opcoes.titulo || '';
    dialogoTitulo.hidden = !opcoes.titulo;
    dialogoTexto.textContent = opcoes.texto || '';
    dialogoTexto.hidden = !opcoes.texto;
    dialogoCorpo.innerHTML = '';
    if (opcoes.conteudo) dialogoCorpo.append(opcoes.conteudo);
    dialogoConfirmar.textContent = opcoes.confirmar || 'Confirmar';
    dialogoConfirmar.className = 'botao ' + (opcoes.perigo ? 'botao--perigo' : 'botao--principal');
    dialogoCancelar.textContent = opcoes.cancelar || 'Cancelar';
    dialogoCancelar.hidden = opcoes.cancelar === false;
    (opcoes.extra || []).forEach(extra => {
      const botao = criar('button', { type: 'button', classe: 'botao botao--contorno', style: 'margin-top:12px;width:100%', texto: extra.rotulo });
      botao.addEventListener('click', () => fecharDialogo(extra.aoClicar));
      dialogoCorpo.append(botao);
    });
    resolverDialogo = resolve;
    dialogo.showModal();
  });
}

function fecharDialogo(valor) {
  if (resolverDialogo) {
    const resolver = resolverDialogo;
    resolverDialogo = null;
    resolver(valor);
  }
  if (dialogo.open) dialogo.close();
}

dialogoForm.addEventListener('submit', evento => {
  evento.preventDefault();
  fecharDialogo('confirmar');
});
dialogoCancelar.addEventListener('click', () => fecharDialogo(null));
dialogo.addEventListener('cancel', evento => {
  evento.preventDefault();
  fecharDialogo(null);
});
dialogo.addEventListener('click', evento => {
  if (evento.target === dialogo) fecharDialogo(null);
});
folha.addEventListener('click', evento => {
  if (evento.target === folha) fecharFolha();
});

let arrastoFolha = null;

folha.addEventListener('touchstart', evento => {
  if (evento.touches.length !== 1 || folha.scrollTop > 0) {
    arrastoFolha = null;
    return;
  }
  arrastoFolha = { y: evento.touches[0].clientY, dy: 0, hora: Date.now(), ativo: false };
}, { passive: true });

folha.addEventListener('touchmove', evento => {
  if (!arrastoFolha) return;
  if (folha.scrollTop > 0) {
    arrastoFolha = null;
    return;
  }
  const dy = evento.touches[0].clientY - arrastoFolha.y;
  if (dy <= 0) {
    if (!arrastoFolha.ativo) arrastoFolha = null;
    return;
  }
  arrastoFolha.ativo = true;
  arrastoFolha.dy = dy;
  evento.preventDefault();
  const deslocamento = dy > 120 ? 120 + (dy - 120) * 0.35 : dy;
  folha.classList.remove('folha--voltando');
  folha.classList.add('folha--arrastando');
  folha.style.transform = `translateY(${deslocamento}px)`;
}, { passive: false });

function terminarArrastoFolha() {
  if (!arrastoFolha) return;
  const { dy, hora, ativo } = arrastoFolha;
  arrastoFolha = null;
  if (!ativo) return;
  folha.classList.remove('folha--arrastando');
  const velocidade = dy / Math.max(1, Date.now() - hora);
  if (dy > 96 || velocidade > 0.5) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fecharFolha();
      return;
    }
    folha.classList.add('folha--saindo');
    setTimeout(fecharFolha, 180);
    return;
  }
  folha.classList.add('folha--voltando');
  folha.style.transform = '';
  setTimeout(() => folha.classList.remove('folha--voltando'), 240);
}

folha.addEventListener('touchend', terminarArrastoFolha);
folha.addEventListener('touchcancel', terminarArrastoFolha);

folha.addEventListener('close', () => {
  arrastoFolha = null;
  folha.classList.remove('folha--arrastando', 'folha--voltando', 'folha--saindo');
  folha.style.transform = '';
});

const NOMES_CORES = ['rosa', 'verde', 'laranja', 'violeta', 'azul', 'ciano'];

function abrirEditorLista(lista) {
  const editando = !!lista;
  let cor = lista ? lista.cor : CORES[estado.listas.length % CORES.length];
  const campo = criar('input', { type: 'text', value: lista ? lista.nome : '', placeholder: 'Ex.: Loja do Zé', maxlength: 40, 'aria-label': 'Nome da lista' });
  const cores = criar('div', { classe: 'dialogo__cores' });
  const valorInicialCor = /^#[0-9a-f]{6}$/i.test(String(cor)) ? cor : CORES[0];
  const campoCor = criar('input', { type: 'color', value: valorInicialCor, 'aria-label': 'Escolher cor personalizada' });
  const corPersonalizada = criar('label', { classe: 'cor-personalizada' },
    criar('span', { texto: 'Personalizada' }),
    campoCor
  );
  const mesmaCor = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const atualizarSelecaoCor = () => {
    cores.querySelectorAll('.cor-opcao').forEach((botao, indice) => {
      botao.setAttribute('aria-pressed', mesmaCor(CORES[indice], cor) ? 'true' : 'false');
    });
    corPersonalizada.classList.toggle('cor-personalizada--ativa', !CORES.some(valor => mesmaCor(valor, cor)));
  };
  CORES.forEach((valorCor, indice) => {
    const botao = criar('button', {
      type: 'button',
      classe: 'cor-opcao',
      style: `--cor:${valorCor}`,
      'aria-label': 'Cor ' + NOMES_CORES[indice],
      'aria-pressed': mesmaCor(valorCor, cor) ? 'true' : 'false'
    });
    botao.addEventListener('click', () => {
      cor = valorCor;
      campoCor.value = valorCor;
      atualizarSelecaoCor();
    });
    cores.append(botao);
  });
  campoCor.addEventListener('input', () => {
    cor = campoCor.value;
    atualizarSelecaoCor();
  });
  cores.append(corPersonalizada);
  atualizarSelecaoCor();
  const corpo = criar('div', {}, campo, cores);
  if (editando) {
    const excluir = criar('button', { type: 'button', classe: 'botao botao--perigo', style: 'margin-top:14px;width:100%' },
      icone('i-lixeira'), criar('span', { texto: 'Excluir lista' })
    );
    excluir.addEventListener('click', () => fecharDialogo('excluir'));
    corpo.append(excluir);
  }
  const promessa = abrirDialogo({
    titulo: editando ? 'Editar lista' : 'Nova lista',
    confirmar: editando ? 'Salvar' : 'Criar',
    conteudo: corpo
  });
  setTimeout(() => campo.focus(), 60);
  return promessa.then(async resposta => {
    if (resposta === 'excluir' && editando) {
      const confirmacao = await abrirDialogo({
        titulo: 'Excluir lista',
        texto: `Os ${plural(estado.itens.filter(i => i.listaId === lista.id).length, 'produto', 'produtos')} dessa lista vão para "Meus fornecedores" — nada é apagado.`,
        confirmar: 'Excluir lista',
        perigo: true
      });
      if (confirmacao !== 'confirmar') return null;
      instantaneo();
      estado.itens.forEach(item => {
        if (item.listaId === lista.id) item.listaId = null;
      });
      estado.listas = estado.listas.filter(x => x.id !== lista.id);
      if (estado.ajustes.filtro === lista.id) estado.ajustes.filtro = 'todas';
      salvar();
      mostrar();
      avisar('Lista excluída', { acao: 'Desfazer', aoAcao: desfazerAcao });
      return null;
    }
    if (resposta !== 'confirmar') return null;
    const nome = campo.value.trim();
    if (!nome) {
      avisar('Dê um nome pra lista.');
      return null;
    }
    instantaneo();
    if (editando) {
      lista.nome = nome;
      lista.cor = cor;
    } else {
      const nova = { id: uid(), nome, cor };
      estado.listas.push(nova);
      salvar();
      mostrar();
      return nova;
    }
    salvar();
    mostrar();
    return lista;
  });
}

function dadosDoBackup() {
  return {
    json: JSON.stringify({
      app: 'meus-fornecedores',
      versao: VERSAO,
      exportadoEm: new Date().toISOString(),
      listas: estado.listas,
      itens: estado.itens
    }, null, 2),
    nome: `meu-catalogo-${new Date().toISOString().slice(0, 10)}.json`
  };
}

function renderUltimoBackup() {
  const quando = estado.ajustes.ultimoBackup;
  if (!quando) {
    ultimoBackup.textContent = 'Você ainda não baixou nenhum backup.';
    ultimoBackup.classList.remove('ultimo-backup--velho');
    return;
  }
  const dias = Math.floor((Date.now() - quando) / 86400000);
  let texto = `Último backup: há ${dias} dias.`;
  if (dias <= 0) texto = 'Último backup: hoje.';
  else if (dias === 1) texto = 'Último backup: ontem.';
  if (dias >= 30) texto += ' Vale baixar um novo.';
  ultimoBackup.textContent = texto;
  ultimoBackup.classList.toggle('ultimo-backup--velho', dias >= 30);
}

function marcarBackupFeito() {
  estado.ajustes.ultimoBackup = Date.now();
  salvar();
  renderUltimoBackup();
}

function baixarBackup() {
  if (!estado.itens.length && !estado.listas.length) {
    avisar('O catálogo está vazio. Nada pra baixar.');
    return;
  }
  const { json, nome } = dadosDoBackup();
  const blob = new Blob([json], { type: 'application/json' });
  const endereco = URL.createObjectURL(blob);
  const a = criar('a', { href: endereco, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(endereco);
  marcarBackupFeito();
  avisar('Backup baixado');
}

function suportaCompartilharArquivo() {
  try {
    return typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File(['{}'], 'teste.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

async function compartilharBackup() {
  if (!estado.itens.length && !estado.listas.length) {
    avisar('O catálogo está vazio. Nada pra compartilhar.');
    return;
  }
  const { json, nome } = dadosDoBackup();
  try {
    await navigator.share({
      files: [new File([json], nome, { type: 'application/json' })],
      title: 'Backup do catálogo',
      text: 'Backup dos meus fornecedores'
    });
    marcarBackupFeito();
    avisar('Backup compartilhado');
  } catch (erro) {
    if (erro && erro.name === 'AbortError') return;
    baixarBackup();
  }
}

arquivoBackup.addEventListener('change', async () => {
  const arquivo = arquivoBackup.files && arquivoBackup.files[0];
  arquivoBackup.value = '';
  if (!arquivo) return;
  try {
    const dados = JSON.parse(await arquivo.text());
    if (!dados || !Array.isArray(dados.itens)) throw new Error('formato');
    instantaneo();
    let novasListas = 0;
    (dados.listas || []).forEach(lista => {
      if (lista && lista.id && !porId(estado.listas, lista.id)) {
        estado.listas.push(lista);
        novasListas++;
      }
    });
    const ids = new Set(estado.itens.map(item => item.id));
    const urls = new Set(estado.itens.map(item => item.url));
    const novos = dados.itens.filter(item => item && item.url && !ids.has(item.id) && !urls.has(item.url));
    estado.itens.push(...novos);
    salvar();
    mostrar();
    const partes = [plural(novos.length, 'produto restaurado', 'produtos restaurados')];
    if (novasListas) partes.push(plural(novasListas, 'lista nova', 'listas novas'));
    avisar(partes.join(' e '), novos.length ? { acao: 'Desfazer', aoAcao: desfazerAcao } : {});
  } catch {
    avisar('Esse arquivo não é um backup válido do catálogo.');
  }
});

btnBackup.addEventListener('click', baixarBackup);
btnCompartilharBackup.addEventListener('click', compartilharBackup);
btnRestaurar.addEventListener('click', () => arquivoBackup.click());

btnApagarTudo.addEventListener('click', async () => {
  if (!estado.itens.length && !estado.listas.length) {
    avisar('O catálogo já está vazio.');
    return;
  }
  const resposta = await abrirDialogo({
    titulo: 'Apagar catálogo',
    texto: `Isso remove ${plural(estado.itens.length, 'produto', 'produtos')} e ${plural(estado.listas.length, 'lista', 'listas')} deste aparelho. Baixe um backup antes, se quiser guardar.`,
    confirmar: 'Apagar tudo',
    perigo: true
  });
  if (resposta !== 'confirmar') return;
  instantaneo();
  estado.itens = [];
  estado.listas = [];
  estado.ajustes.filtro = 'todas';
  salvar();
  mostrar();
  avisar('Catálogo apagado', { acao: 'Desfazer', aoAcao: desfazerAcao });
});

function mostrar() {
  renderCatalogo();
  renderListas();
  renderChipsForm();
  renderResumo();
  renderUltimoBackup();
}

window.addEventListener('beforeinstallprompt', evento => {
  evento.preventDefault();
  promptInstalar = evento;
  btnInstalar.hidden = false;
  topoInstalar.hidden = false;
  textoInstalar.textContent = 'Instale na tela inicial pra abrir em tela cheia e funcionar offline.';
});

function instrucoesInstalar() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    return 'Abra o menu ⋮ do navegador e toque em "Adicionar à tela inicial" ou "Instalar app".';
  }
  if (/iPad|iPhone|iPod/.test(ua)) {
    return 'Toque no botão Compartilhar do Safari e escolha "Adicionar à Tela de Início".';
  }
  return 'Na barra de endereço, clique no ícone de instalar — ou abra o menu do navegador e escolha "Instalar app".';
}

function marcarInstalado() {
  promptInstalar = null;
  btnInstalar.hidden = true;
  topoInstalar.hidden = true;
  textoInstalar.textContent = 'Pronto! Abra pelo ícone na tela inicial.';
}

async function instalarApp() {
  if (!promptInstalar) {
    abrirDialogo({
      titulo: 'Instalar no celular',
      texto: instrucoesInstalar(),
      confirmar: 'Entendi',
      cancelar: false
    });
    return;
  }
  promptInstalar.prompt();
  const escolha = await promptInstalar.userChoice;
  promptInstalar = null;
  if (escolha && escolha.outcome === 'accepted') marcarInstalado();
}

btnInstalar.addEventListener('click', instalarApp);
topoInstalar.addEventListener('click', instalarApp);

window.addEventListener('appinstalled', marcarInstalado);

function ajustarTextoInstalar() {
  const instalado = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (instalado) {
    textoInstalar.textContent = 'Você já está usando o app instalado. Tudo pronto.';
    btnInstalar.hidden = true;
    topoInstalar.hidden = true;
    return;
  }
  btnInstalar.hidden = false;
  topoInstalar.hidden = false;
  const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  textoInstalar.textContent = ehIOS
    ? 'No iPhone: toque em Instalar pra ver o passo a passo pra adicionar à Tela de Início.'
    : 'Instale na tela inicial pra abrir em tela cheia e funcionar offline.';
}

document.addEventListener('click', evento => {
  const alvo = evento.target.closest('[data-ir]');
  if (!alvo) return;
  const destino = alvo.dataset.ir;
  const ehNav = alvo.classList.contains('navegacao__item');
  irPara(destino, { novo: ehNav && destino === 'adicionar', foco: ehNav && destino === 'adicionar' });
});

campoBusca.addEventListener('input', () => {
  btnLimparBusca.hidden = !campoBusca.value;
  clearTimeout(buscaTimer);
  buscaTimer = setTimeout(() => renderCatalogo(), 120);
});

btnLimparBusca.addEventListener('click', () => {
  campoBusca.value = '';
  btnLimparBusca.hidden = true;
  renderCatalogo();
  campoBusca.focus();
});

btnLimparFiltros.addEventListener('click', () => {
  campoBusca.value = '';
  btnLimparBusca.hidden = true;
  estado.ajustes.filtro = 'todas';
  salvar();
  renderCatalogo();
});

campoOrdem.addEventListener('change', () => {
  estado.ajustes.ordem = campoOrdem.value;
  salvar();
  renderCatalogo();
});

catalogo.addEventListener('click', evento => {
  const abrir = evento.target.closest('.produto__abrir');
  if (abrir) {
    evento.preventDefault();
    abrirNaShopee(abrir.href);
    return;
  }
  if (evento.target.closest('a')) return;
  const menu = evento.target.closest('.produto__menu');
  if (menu) {
    abrirFolha(menu.closest('.produto').dataset.id);
    return;
  }
  const corpo = evento.target.closest('.produto__corpo, .produto__midia');
  if (corpo) abrirFolha(corpo.closest('.produto').dataset.id);
});

document.addEventListener('click', evento => {
  const botao = evento.target.closest('.navegacao__item');
  if (botao) return;
  const link = evento.target.closest('a[data-ir]');
  if (link) irPara(link.dataset.ir);
});

btnNovaLista.addEventListener('click', () => {
  abrirEditorLista(null).then(lista => {
    if (lista) avisar('Lista criada');
  });
});

function abrirAjudaListas() {
  abrirDialogo({
    titulo: 'Como funcionam as listas?',
    texto: 'Use listas para separar produtos por fornecedor, categoria ou campanha. Crie uma em Configuração ou, durante o cadastro, pelo botão Nova. Ao adicionar ou editar um produto, escolha a lista; depois, use os filtros no topo do catálogo para encontrar cada grupo. Produtos sem uma lista ficam em “Meus fornecedores”. Mover ou excluir uma lista não apaga os produtos.',
    confirmar: 'Entendi',
    cancelar: false
  });
}

btnAjudaListas.addEventListener('click', abrirAjudaListas);
btnAjudaListasConfiguracao.addEventListener('click', abrirAjudaListas);
btnCriarListaCatalogo.addEventListener('click', () => {
  irPara('listas');
  abrirEditorLista(null).then(lista => {
    if (lista) avisar('Lista criada');
  });
});

const camposPrevia = [campoNome, campoCusto, campoVenda, campoFornecedor, campoImagem, campoNota];
camposPrevia.forEach(campo => campo.addEventListener('input', atualizarPrevia));

campoLink.addEventListener('paste', evento => {
  const texto = evento.clipboardData && evento.clipboardData.getData('text');
  if (!texto) return;
  const achado = texto.match(/https?:\/\/\S+/);
  if (achado) {
    evento.preventDefault();
    campoLink.value = limparUrl(achado[0]);
    esconderDica();
    buscarDados('auto');
  }
});

btnColarArea.addEventListener('click', async () => {
  try {
    const texto = await navigator.clipboard.readText();
    const achado = (texto || '').match(/https?:\/\/\S+/);
    if (!achado) {
      mostrarAvisoDica('Não achei um link na área de transferência. Copie o link do produto e tente de novo.', true);
      return;
    }
    campoLink.value = limparUrl(achado[0]);
    esconderDica();
    buscarDados('auto');
  } catch {
    mostrarAvisoDica('Não consegui ler a área de transferência. Segure o campo do link e escolha "Colar".', true);
  }
});

btnBuscar.addEventListener('click', () => buscarDados('manual'));
btnSalvar.addEventListener('click', salvarProduto);
btnCancelarEdicao.addEventListener('click', () => {
  resetarFormulario();
  irPara('catalogo');
});

document.addEventListener('keydown', evento => {
  if (evento.key === 'Escape' && aviso.hidden === false) esconderAviso();
});

window.addEventListener('hashchange', () => {
  const nome = window.location.hash.replace('#', '');
  if (vistas[nome]) irPara(nome);
});

function tratarLinkCompartilhado() {
  const params = new URLSearchParams(window.location.search);
  const bruto = params.get('url') || params.get('text') || params.get('title') || '';
  if (!bruto) return false;
  const achado = bruto.match(/https?:\/\/\S+/);
  if (!achado) return false;
  campoLink.value = limparUrl(achado[0]);
  irPara('adicionar');
  history.replaceState(null, '', window.location.pathname + '#adicionar');
  buscarDados('auto');
  return true;
}

function iniciar() {
  ajustarTextoInstalar();
  pedirArmazenamentoPersistente();
  if (suportaCompartilharArquivo()) btnCompartilharBackup.hidden = false;
  const inicial = window.location.hash.replace('#', '');
  const veioDeCompartilhamento = tratarLinkCompartilhado();
  if (!veioDeCompartilhamento) {
    irPara(vistas[inicial] ? inicial : 'catalogo', { foco: false });
  }
  mostrar();
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

iniciar();
