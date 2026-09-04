/*
 * ============================================================================
 * ESCOPO DE TENANT: DE ONDE VEM O RESTAURANTE E A FILIAL
 * ============================================================================
 *
 * O backend varreu as 82 rotas de `/admin` com iscas. O painel nunca passou por
 * varredura nenhuma, e esta é a metade do problema que fica do lado de cá.
 *
 * A REGRA QUE ESTE ARQUIVO GUARDA, e ela é uma só:
 *
 *   O restaurante e a filial de qualquer chamada vêm da SESSÃO, nunca de algo
 *   que a pessoa do outro lado da tela controla.
 *
 * O restaurante nunca é escolhido: ele está dentro do JWT, e NENHUMA rota
 * `/admin` o aceita por path, query ou corpo (skill `rapidex-api` §4.3). A
 * filial é escolhida, e a lista do que dá para escolher é a resposta de
 * `GET /admin/branches` — que já vem recortada pelo token.
 *
 * ----------------------------------------------------------------------------
 * POR QUE UMA VERIFICAÇÃO, E NÃO SÓ CONFIANÇA NO BACKEND
 * ----------------------------------------------------------------------------
 *
 * O backend recusa: um id de outra loja responde 404, e é assim que tem que
 * ser. Uma verificação aqui não existe para substituir aquela — existe porque
 * do lado do painel o mesmo defeito tem OUTRO sintoma, e ele não é um vazamento
 * de dado: é um BOTÃO QUE EXISTE E NÃO FUNCIONA. Uma tela que monta a filial a
 * partir do endereço, do `localStorage` ou de um parâmetro leva o lojista a uma
 * ação que o servidor vai recusar, e a recusa chega na mão dele, no meio do
 * turno, como "o sistema não deixa".
 *
 * E há a metade que o backend não alcança: o painel lê VÁRIAS filiais de uma
 * vez (o quadro de pedidos, os relatórios, a busca do gêmeo do cardápio). Todas
 * elas são legítimas e todas passam pelo mesmo funil — `useSession().branches`.
 * Uma que passe a montar a lista por outro caminho não erra por 403; erra
 * somando lojas que o lojista não pediu, que foi exatamente o defeito do
 * cardápio em dobro (§4.4).
 *
 * ----------------------------------------------------------------------------
 * O QUE ELE NÃO É
 * ----------------------------------------------------------------------------
 *
 * Ele é ESTRUTURAL: olha o código, não o comportamento. A metade dinâmica —
 * as iscas de verdade, plantadas no falso do e2e — mora em `e2e/escopo.spec.ts`.
 * As duas juntas são a varredura; nenhuma das duas sozinha é.
 *
 * Roda no `npm run lint`. Com `--lista`, imprime o inventário inteiro em vez do
 * resumo — é ele que vira a tabela de `scratchpad/escopo-de-tenant.md`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const srcRoot = join(projectRoot, 'src');
const listar = process.argv.includes('--lista');

/**
 * As portas por onde entra dado que a PESSOA controla.
 *
 * Nenhuma delas é proibida — o `localStorage` guarda a sessão, e é o certo. O
 * que a regra cobra é que cada uma tenha razão escrita no lugar, para que a
 * próxima não entre por hábito.
 */
const ORIGENS_DO_CLIENTE = [
  { nome: 'useParams', pattern: /\buseParams\s*\(/g },
  { nome: 'useSearchParams', pattern: /\buseSearchParams\s*\(/g },
  { nome: 'location.search', pattern: /location\s*\.\s*search\b/g },
  { nome: 'location.hash', pattern: /location\s*\.\s*hash\b/g },
  { nome: 'URLSearchParams', pattern: /new\s+URLSearchParams\s*\(/g },
  { nome: 'localStorage', pattern: /\blocalStorage\b/g },
  { nome: 'sessionStorage', pattern: /\bsessionStorage\b/g },
  { nome: 'document.cookie', pattern: /document\s*\.\s*cookie\b/g },
  { nome: 'document.referrer', pattern: /document\s*\.\s*referrer\b/g },
  { nome: 'window.name', pattern: /window\s*\.\s*name\b/g },
  { nome: 'postMessage', pattern: /\bpostMessage\s*\(/g },
  { nome: "addEventListener('message')", pattern: /addEventListener\s*\(\s*['"]message['"]/g },
];

/**
 * As formas em que um id de filial pode chegar a uma chamada.
 *
 * Todas saem, direta ou indiretamente, de `useSession()` — ou seja, da resposta
 * de `GET /admin/branches`, que o token já recortou. `activeBranchId` está aqui
 * porque o único jeito de ele mudar é `selectBranch`, e a Regra C guarda quem
 * pode chamá-lo.
 *
 * Uma expressão fora desta lista não é necessariamente errada; é
 * NÃO-RASTREÁVEL, que para esta varredura é a mesma coisa. Ou ela ganha um
 * nome daqui, ou ganha razão escrita.
 */
const ORIGENS_DA_SESSAO = [
  /^activeBranchId$/,
  /^branchId$/,
  /^currentBranchId$/,
  /^branch\??\.id$/,
  /^filial\??\.id$/,
  /^resolved\??\.branchId$/,
  /^(?:params|filters|filtros|props|opcoes)\.branchId$/,
  /^branches\[\d+\]\??\.id$/,
  /^(?:activeBranchId|branchId)\s*\|\|\s*\w+$/,
  /^''$/,
  /^undefined$/,
];

/** A fuga declarada: `// escopo-ok: <razão>` na linha, ou colada acima dela. */
function temFugaDeclarada(linhas, indice) {
  if (/escopo-ok:/.test(linhas[indice] ?? '')) return true;
  for (let i = indice - 1; i >= 0; i -= 1) {
    const linha = (linhas[i] ?? '').trim();
    if (!linha.startsWith('//') && !linha.startsWith('*') && !linha.startsWith('/*')) return false;
    if (/escopo-ok:/.test(linha)) return true;
  }
  return false;
}

/**
 * O código sem os comentários, com comprimento e quebras preservados.
 *
 * Pelo mesmo motivo do `check-fuso`: metade dos comentários deste repositório
 * CITA o defeito para explicá-lo, e um portão que acusa a própria documentação
 * ensina a desligar o portão. A fuga continua sendo procurada no texto
 * original, que é onde ela mora.
 */
function semComentarios(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (linha) => ' '.repeat(linha.length));
}

function arquivos(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, out);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(p);
  }
  return out;
}

function linhaDe(src, indice) {
  return src.slice(0, indice).split('\n').length;
}

/** O trecho a partir do `(`, até fechar os parênteses. */
function chamada(src, abre) {
  let nivel = 0;
  for (let i = abre; i < src.length; i += 1) {
    if (src[i] === '(') nivel += 1;
    if (src[i] === ')') {
      nivel -= 1;
      if (nivel === 0) return src.slice(abre, i + 1);
    }
  }
  return src.slice(abre);
}

/**
 * A expressão é um PARÂMETRO de quem a usa — um repasse, não uma origem.
 *
 * `useBranchOperation` grava com `alvo`, que quem chama o hook entrega; o
 * `useReviews` lê com `filtros`, idem. Acusá-los seria mandar consertar código
 * certo: o id não NASCE ali, ele passa. O que fecha o repasse não é regra
 * estática nenhuma — é a isca do `e2e/escopo.spec.ts`, que olha o id que de
 * fato saiu pela rede. Por isso eles saem contados e nomeados no inventário,
 * em vez de silenciados.
 */
function ehParametro(cego, expressao, ate) {
  if (!/^\w+$/.test(expressao)) return false;
  const antes = cego.slice(0, ate);
  return new RegExp(`[(,]\\s*${expressao}\\s*[:,)]`).test(antes);
}

/** O primeiro argumento de uma chamada, sem entrar em parênteses aninhados. */
function primeiroArgumento(trecho) {
  const corpo = trecho.slice(1, -1);
  let nivel = 0;
  for (let i = 0; i < corpo.length; i += 1) {
    const c = corpo[i];
    if ('([{'.includes(c)) nivel += 1;
    else if (')]}'.includes(c)) nivel -= 1;
    else if (c === ',' && nivel === 0) return corpo.slice(0, i).trim();
  }
  return corpo.trim();
}

const todos = arquivos(srcRoot)
  .map((p) => relative(projectRoot, p).split(sep).join('/'))
  .filter((p) => !p.startsWith('src/api/generated/'));

const fonte = new Map();
for (const relativo of todos) {
  const original = readFileSync(join(projectRoot, relativo), 'utf8');
  fonte.set(relativo, { original, cego: semComentarios(original) });
}

const problemas = [];

/* ==========================================================================
 * O INVENTÁRIO — quais funções de `src/api/` carregam filial, e como
 * ======================================================================= */

const funcoesComFilial = [];
for (const relativo of todos) {
  if (!relativo.startsWith('src/api/')) continue;
  const { cego } = fonte.get(relativo);
  const re = /export\s+async\s+function\s+(\w+)/g;
  let m;
  const marcas = [];
  while ((m = re.exec(cego))) marcas.push({ nome: m[1], inicio: m.index });
  for (const [i, marca] of marcas.entries()) {
    const fim = marcas[i + 1]?.inicio ?? cego.length;
    const corpo = cego.slice(marca.inicio, fim);
    const ondeViaja = [];
    if (/path:\s*\{[^}]*branch_id/.test(corpo)) ondeViaja.push('path');
    if (/query:[\s\S]{0,200}?branch_id/.test(corpo)) ondeViaja.push('query');
    if (/body:[\s\S]{0,400}?branch_id/.test(corpo)) ondeViaja.push('corpo');
    if (ondeViaja.length === 0) continue;
    funcoesComFilial.push({ arquivo: relativo, nome: marca.nome, onde: ondeViaja.join('+') });
  }
}

/* ==========================================================================
 * REGRA A — `restaurant_id` não sai numa requisição
 *
 * Nenhuma rota `/admin` o aceita: o restaurante está no token. Um painel que o
 * mandasse estaria oferecendo um parâmetro de tenant a quem abre o DevTools —
 * e, mesmo com o backend ignorando, estaria dizendo no código que a escolha
 * existe.
 * ======================================================================= */

for (const relativo of todos) {
  if (!relativo.startsWith('src/api/')) continue;
  const { cego, original } = fonte.get(relativo);
  const linhas = original.split('\n');
  const re = /\brestaurant_id\s*:/g;
  let m;
  while ((m = re.exec(cego))) {
    const linha = linhaDe(cego, m.index);
    if (temFugaDeclarada(linhas, linha - 1)) continue;
    problemas.push({
      regra: 'A',
      lugar: `${relativo}:${linha}`,
      texto: '`restaurant_id` escrito numa chamada — o restaurante vem do token',
    });
  }
}

/* ==========================================================================
 * REGRA B — origem controlada pelo cliente sem razão escrita
 * ======================================================================= */

const origensAchadas = [];
for (const relativo of todos) {
  const { cego, original } = fonte.get(relativo);
  const linhas = original.split('\n');
  for (const origem of ORIGENS_DO_CLIENTE) {
    origem.pattern.lastIndex = 0;
    let m;
    while ((m = origem.pattern.exec(cego))) {
      const linha = linhaDe(cego, m.index);
      const registro = { origem: origem.nome, lugar: `${relativo}:${linha}` };
      origensAchadas.push(registro);
      if (temFugaDeclarada(linhas, linha - 1)) continue;
      problemas.push({
        regra: 'B',
        lugar: registro.lugar,
        texto: `${origem.nome}: origem que a pessoa controla, sem razão escrita`,
      });
    }
  }
}

/* ==========================================================================
 * REGRA C — a filial ativa só é escolhida da lista do servidor
 *
 * `activeBranchId` é o id que a maior parte do painel manda. Ele começa vazio e
 * só muda por `selectBranch`. Se um dia alguém o alimentar do endereço ou do
 * `localStorage`, todas as chamadas que hoje são rastreáveis deixam de ser de
 * uma vez — por isso a guarda é sobre QUEM PODE CHAMAR, e não sobre o valor.
 * ======================================================================= */

const CHAMADORES_DE_SELECT = new Set([
  // O seletor do topo: as opções são `branches`, e o `value` é um id de lá.
  'src/layout/BranchSelector.tsx',
  // A adoção da filial resolvida, cujo id sai de `resolveBranch(branches, …)`.
  'src/auth/use-branch-scope.ts',
  // O provedor, que declara o estado.
  'src/auth/SessionProvider.tsx',
]);

for (const relativo of todos) {
  const { cego, original } = fonte.get(relativo);
  const linhas = original.split('\n');
  const re = /\b(selectBranch|setActiveBranchId)\s*\(/g;
  let m;
  while ((m = re.exec(cego))) {
    if (CHAMADORES_DE_SELECT.has(relativo)) continue;
    const linha = linhaDe(cego, m.index);
    if (temFugaDeclarada(linhas, linha - 1)) continue;
    problemas.push({
      regra: 'C',
      lugar: `${relativo}:${linha}`,
      texto: `${m[1]} fora dos três lugares que escolhem filial da lista do servidor`,
    });
  }
}

/* ==========================================================================
 * REGRA D — nenhuma tela do painel recebe id pelo endereço
 *
 * Hoje o roteador não tem UM parâmetro: `/pedidos`, `/cardapio`, `/loja/:secao`
 * seria a primeira exceção e ela não existe. É a razão de o painel não ter a
 * classe de defeito que o backend varreu — e é uma linha de distância dela.
 * ======================================================================= */

for (const relativo of todos) {
  const { cego, original } = fonte.get(relativo);
  const linhas = original.split('\n');
  const re = /<Route\s[^>]*path=\{?["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(cego))) {
    if (!m[1].includes(':')) continue;
    const linha = linhaDe(cego, m.index);
    if (temFugaDeclarada(linhas, linha - 1)) continue;
    problemas.push({
      regra: 'D',
      lugar: `${relativo}:${linha}`,
      texto: `rota com parâmetro no endereço: "${m[1]}"`,
    });
  }
}

/* ==========================================================================
 * REGRA E — toda filial que sai numa chamada tem origem rastreável
 *
 * Percorre os pontos de uso das funções do inventário e classifica a expressão
 * passada. O que não casa com `ORIGENS_DA_SESSAO` não é acusado de errado: é
 * acusado de não dar para seguir a olho, que é o que uma varredura precisa.
 * ======================================================================= */

const nomesComFilial = new Set(funcoesComFilial.map((f) => f.nome));
const usos = [];

for (const relativo of todos) {
  if (relativo.startsWith('src/api/')) continue;
  const { cego, original } = fonte.get(relativo);
  const linhas = original.split('\n');

  for (const nome of nomesComFilial) {
    const re = new RegExp(`\\b${nome}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(cego))) {
      const abre = cego.indexOf('(', m.index);
      const trecho = chamada(cego, abre);
      const linha = linhaDe(cego, m.index);

      /*
       * Três formas, e a terceira é a que a primeira versão desta regra não
       * viu: `{ branchId }` abreviado não tem dois-pontos, e o extrator devolvia
       * o objeto inteiro como se fosse a expressão. Quatro hooks corretos
       * apareceram como "não rastreável" — falso positivo que manda mexer em
       * código certo, que é o mais caro que uma régua destas pode fazer.
       */
      const abreviado = /\bbranchId\s*[,}]/.test(trecho);
      const porChave = /branchId\s*:\s*([^,\n}]+)/.exec(trecho);
      const expressao = (
        abreviado ? 'branchId' : porChave ? porChave[1] : primeiroArgumento(trecho)
      )
        .trim()
        .replace(/\s+/g, ' ');

      const daSessao = ORIGENS_DA_SESSAO.some((forma) => forma.test(expressao));
      const repasse = !daSessao && ehParametro(cego, expressao, m.index);
      usos.push({
        lugar: `${relativo}:${linha}`,
        nome,
        expressao,
        classe: daSessao ? 'sessão' : repasse ? 'repasse' : 'desconhecida',
      });
      if (daSessao || repasse || temFugaDeclarada(linhas, linha - 1)) continue;
      problemas.push({
        regra: 'E',
        lugar: `${relativo}:${linha}`,
        texto: `${nome}(${expressao}) — origem da filial não rastreável a partir de useSession()`,
      });
    }
  }
}

/* ==========================================================================
 * A saída
 * ======================================================================= */

if (listar) {
  console.log('# Funções de src/api que carregam filial\n');
  for (const f of funcoesComFilial.sort((a, b) => a.nome.localeCompare(b.nome))) {
    console.log(`${f.nome} | ${f.onde} | ${f.arquivo}`);
  }
  console.log(`\n(${funcoesComFilial.length} funções)\n`);

  console.log('# Pontos de uso, com a expressão passada\n');
  for (const u of usos.sort((a, b) => a.lugar.localeCompare(b.lugar))) {
    console.log(`${u.classe.padEnd(11)} | ${u.lugar} | ${u.nome} | ${u.expressao}`);
  }
  console.log(`\n(${usos.length} pontos de uso)\n`);

  console.log('# Origens controladas pelo cliente\n');
  for (const o of origensAchadas.sort((a, b) => a.lugar.localeCompare(b.lugar))) {
    console.log(`${o.lugar} | ${o.origem}`);
  }
  console.log(`\n(${origensAchadas.length} ocorrências)`);
}

if (problemas.length > 0) {
  console.error('\nEscopo de tenant: origem que não vem da sessão.\n');
  for (const p of problemas.sort((a, b) => a.lugar.localeCompare(b.lugar))) {
    console.error(`  [${p.regra}] ${p.lugar}\n      ${p.texto}`);
  }
  console.error(
    '\nSe estiver certo, escreva a razão no lugar: `// escopo-ok: <por quê>` na' +
      ' linha ou no comentário colado acima dela.\n',
  );
  process.exit(1);
}

const daSessao = usos.filter((u) => u.classe === 'sessão').length;
const repassados = usos.filter((u) => u.classe === 'repasse').length;

console.log(
  `Escopo: ${funcoesComFilial.length} funções levam filial; dos ${usos.length} pontos de uso, ` +
    `${daSessao} tiram o id da sessão e ${repassados} o repassam de parâmetro ` +
    '(a isca de e2e/escopo.spec.ts é quem fecha esses). Nenhum restaurante viaja em ' +
    'requisição, e nenhuma rota do painel tem parâmetro.',
);
