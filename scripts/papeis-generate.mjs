/*
 * De onde sai o mapa de PAPEL POR ROTA que gera `src/api/generated/papeis.ts`.
 *
 * ============================================================================
 * POR QUE ISTO EXISTE, E POR QUE NÃO SAI DO `openapi.json`
 * ============================================================================
 *
 * Desde a revisão `20260814_0020` do backend, o papel do lojista decide
 * autorização em 62 rotas `/admin`. Uma rota que respondia 200 para o atendente
 * passou a responder 403 — e **isso não muda o documento OpenAPI**: o esquema da
 * resposta é o mesmo, o corpo é o mesmo, o caminho é o mesmo. `api:generate`
 * roda e produz zero diff.
 *
 * O resultado, sem este arquivo, é o painel desenhando botões que a pessoa não
 * pode apertar. Do ponto de vista de quem está no balcão isso não lê como
 * "acesso restrito": lê como sistema quebrado.
 *
 * ============================================================================
 * DE ONDE O MAPA VEM, E POR QUE NÃO É ESCRITO AQUI
 * ============================================================================
 *
 * O backend NÃO tem tabela central de rota → papel, e isso é decisão dele: a
 * regra mora no `dependencies=[Depends(exigir_papel(...))]` de cada rota,
 * porque uma tabela envelhece separada das rotas e a rota nova nasce sem linha
 * nela — falhando ABERTA.
 *
 * O que ele tem é a AUDITORIA disso, em `tests/test_papeis_das_rotas.py`: um
 * dicionário `PAPEL_ESPERADO` que não autoriza nada, só registra o que já foi
 * decidido, conferido contra o que o `app` de fato aplica. Rota nova sem papel
 * deixa aquele teste vermelho. Nas palavras do próprio arquivo: "a tabela que
 * falha aberta é a que AUTORIZA; a que falha fechada é a que AUDITA".
 *
 * É essa segunda que este script lê. Escrever o mapa à mão no painel seria a
 * segunda fonte de verdade que a skill de API proíbe — e aqui o custo do erro é
 * pior que um nome de campo errado: esconder um botão que a pessoa PODE apertar
 * (e ela não descobre a funcionalidade) ou mostrar um que ela não pode (e volta
 * o 403 que esta frente existe para acabar).
 *
 * OS CONJUNTOS TAMBÉM SÃO LIDOS DE LÁ (`SOMENTE_DONO`, `GERENCIA`, `PESSOAS`,
 * `AGENTE_DE_IMPRESSAO`, `PESSOAS_E_AGENTE`, em `admin_scope.py`), e não
 * transcritos: se o backend acrescentar um papel a `GERENCIA`, ele chega aqui
 * na próxima geração em vez de esperar alguém reparar.
 *
 * ============================================================================
 * O QUE ESTE MAPA NÃO ALCANÇA — duas regras, e elas estão em `auth/permissions.ts`
 * ============================================================================
 *
 * Duas decisões do backend não cabem numa tabela de rotas, porque quem decide
 * não é a rota:
 *
 *   - `ensure_pode_definir_preco` — `PATCH /admin/products/{id}` é da GERÊNCIA,
 *     mas o campo `price` é do dono. Quem decide é o CORPO.
 *   - `ensure_pode_ler_dinheiro` — os relatórios são da GERÊNCIA, mas o gerente
 *     precisa mandar recorte de UMA filial; sem `branch_id` continua 403. Quem
 *     decide é a QUERY.
 *
 * As duas são escritas à mão no painel, com o motivo, e têm teste próprio. Não
 * há de onde derivá-las — e é por isso que elas são exceção nomeada, e não uma
 * lacuna silenciosa.
 *
 * A ORIGEM segue a mesma ordem de `api-generate.mjs`, pelos mesmos motivos.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { format, resolveConfig } from 'prettier';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const IRMAO = join(projectRoot, '..', 'pedeaqui_back');
const RAW = 'https://raw.githubusercontent.com/Caua1705/pedeaqui_back/main';

/** Onde moram os conjuntos de papéis, e onde mora a tabela auditada. */
const ARQUIVOS = {
  conjuntos: 'src/api/dependencies/admin_scope.py',
  tabela: 'tests/test_papeis_das_rotas.py',
};

const SAIDA = join(projectRoot, 'src', 'api', 'generated', 'papeis.ts');

function origem() {
  if (process.env.RAPIDEX_BACKEND) {
    return { base: process.env.RAPIDEX_BACKEND, como: 'RAPIDEX_BACKEND' };
  }
  if (existsSync(join(IRMAO, ARQUIVOS.tabela))) {
    return { base: IRMAO, como: 'checkout irmão ../pedeaqui_back' };
  }
  return { base: RAW, como: 'raw do GitHub (main do backend)' };
}

async function ler(base, arquivo) {
  if (/^https?:\/\//.test(base)) {
    const resposta = await fetch(`${base}/${arquivo}`);
    if (!resposta.ok) throw new Error(`${resposta.status} ${resposta.statusText} em ${arquivo}`);
    return resposta.text();
  }
  return readFile(join(base, arquivo), 'utf8');
}

/**
 * Os conjuntos de papéis, lidos de `admin_scope.py`.
 *
 *   SOMENTE_DONO = ("owner",)
 *   GERENCIA = ("owner", "manager")
 *
 * A regex exige NOME = ( ... ) no começo da linha, que é como o Python declara
 * constante de módulo. Nada aqui tenta ser um interpretador: se o backend
 * escrever o conjunto de outro jeito, a conferência lá embaixo derruba o
 * script em vez de emitir um mapa pela metade.
 */
function lerConjuntos(fonte) {
  const conjuntos = {};
  for (const [, nome, corpo] of fonte.matchAll(/^([A-Z_]+)\s*=\s*\(([^)]*)\)/gm)) {
    const papeis = [...corpo.matchAll(/"([a-z_]+)"/g)].map(([, papel]) => papel);
    if (papeis.length > 0) conjuntos[nome] = papeis;
  }
  return conjuntos;
}

/**
 * A tabela `PAPEL_ESPERADO`, lida do arquivo de teste.
 *
 *   ("GET", "/admin/categories"): PESSOAS,
 *
 * Os comentários do Python são apagados antes, senão uma linha comentada de
 * exemplo entraria no mapa como se fosse decisão.
 */
function lerTabela(fonte) {
  const bloco = recortarBloco(fonte, 'PAPEL_ESPERADO');
  const rotas = [];
  for (const [, metodo, caminho, conjunto] of bloco.matchAll(
    /\(\s*"([A-Z]+)"\s*,\s*"([^"]+)"\s*\)\s*:\s*([A-Z_]+)/g,
  )) {
    rotas.push({ metodo, caminho, conjunto });
  }
  return rotas;
}

/** As rotas que de propósito NÃO exigem papel — login, `me`, senha, stream. */
function lerSemExigencia(fonte) {
  const bloco = recortarBloco(fonte, 'SEM_EXIGENCIA_DE_PAPEL');
  return [...bloco.matchAll(/\(\s*"([A-Z]+)"\s*,\s*"([^"]+)"\s*\)/g)].map(
    ([, metodo, caminho]) => ({
      metodo,
      caminho,
    }),
  );
}

/** O corpo de `NOME = { ... }`, sem comentários. */
function recortarBloco(fonte, nome) {
  const inicio = fonte.indexOf(`${nome} = {`);
  if (inicio < 0) throw new Error(`não achei ${nome} no arquivo do backend`);
  const abre = fonte.indexOf('{', inicio);
  const fecha = fonte.indexOf('\n}', abre);
  if (fecha < 0) throw new Error(`${nome} não fecha`);
  return fonte
    .slice(abre, fecha)
    .split('\n')
    .map((linha) => linha.replace(/#.*$/, ''))
    .join('\n');
}

const { base, como } = origem();
console.log(`papeis:generate: lendo o mapa de papéis de ${base}`);
console.log(`                 (${como})`);

let conjuntos;
let rotas;
let semExigencia;
try {
  conjuntos = lerConjuntos(await ler(base, ARQUIVOS.conjuntos));
  const tabela = await ler(base, ARQUIVOS.tabela);
  rotas = lerTabela(tabela);
  semExigencia = lerSemExigencia(tabela);
} catch (erro) {
  console.error(`papeis:generate: não consegui ler o mapa de ${base}`);
  console.error(`  ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error('Sem rede? Clone o backend ao lado deste repositório, ou aponte');
  console.error('RAPIDEX_BACKEND para um checkout local.');
  process.exit(1);
}

/*
 * AS CONFERÊNCIAS, e elas são o que separa "gerar" de "adivinhar".
 *
 * Um parser de regex sobre outro idioma falha em silêncio com facilidade: basta
 * o backend reindentar o arquivo para o bloco recortado vir vazio, e um mapa
 * VAZIO é o pior resultado possível — ele esconderia todo botão de todo mundo,
 * ou (dependendo do default) mostraria todos. As três abaixo derrubam o script
 * em vez de gravar um arquivo plausível.
 */
const CONJUNTOS_ESPERADOS = [
  'SOMENTE_DONO',
  'GERENCIA',
  'PESSOAS',
  'AGENTE_DE_IMPRESSAO',
  'PESSOAS_E_AGENTE',
];
const faltando = CONJUNTOS_ESPERADOS.filter((nome) => !conjuntos[nome]);
if (faltando.length > 0) {
  console.error(`papeis:generate: não achei os conjuntos ${faltando.join(', ')}.`);
  console.error('O backend renomeou ou mudou a forma de declará-los?');
  process.exit(1);
}

if (rotas.length < 50) {
  console.error(`papeis:generate: só ${rotas.length} rotas na tabela — são mais de 60.`);
  console.error('O recorte do bloco falhou. Nada foi gravado.');
  process.exit(1);
}

const semConjunto = rotas.filter((rota) => !conjuntos[rota.conjunto]);
if (semConjunto.length > 0) {
  console.error('papeis:generate: rotas apontando para conjunto que não existe:');
  semConjunto.forEach((rota) =>
    console.error(`  ${rota.metodo} ${rota.caminho} → ${rota.conjunto}`),
  );
  process.exit(1);
}

/** `{ '/admin/x': { GET: 'PESSOAS' } }`, agrupado por caminho. */
const porCaminho = new Map();
for (const { metodo, caminho, conjunto } of rotas) {
  if (!porCaminho.has(caminho)) porCaminho.set(caminho, new Map());
  porCaminho.get(caminho).set(metodo, conjunto);
}

const papeisConhecidos = [...new Set(Object.values(conjuntos).flat())].sort();

const linhasDoMapa = [...porCaminho.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([caminho, metodos]) => {
    const entradas = [...metodos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([metodo, conjunto]) => `${metodo}: '${conjunto}'`)
      .join(', ');
    return `  '${caminho}': { ${entradas} },`;
  })
  .join('\n');

const linhasSemExigencia = semExigencia
  .map(({ metodo, caminho }) => `  '${metodo} ${caminho}',`)
  .join('\n');

const arquivo = `/**
 * GERADO POR \`npm run papeis:generate\`. NÃO EDITE À MÃO.
 *
 * O mapa de PAPEL POR ROTA do backend, lido de
 * \`tests/test_papeis_das_rotas.py\` e \`src/api/dependencies/admin_scope.py\` do
 * repositório do backend. Ver \`scripts/papeis-generate.mjs\` para o porquê de
 * ele não sair do \`openapi.json\`: 200 virando 403 não muda o documento.
 *
 * Uma linha acrescentada aqui à mão some na próxima geração, e some em
 * silêncio — como no \`openapi.d.ts\` ao lado.
 *
 * Duas regras do backend NÃO cabem neste mapa, porque quem decide não é a rota:
 * o preço no PATCH de produto (o corpo decide) e o recorte de filial nos
 * relatórios (a query decide). As duas moram em \`src/auth/permissions.ts\`,
 * escritas à mão e com o motivo.
 */

import type { paths } from './openapi';

/** Os quatro papéis de \`admin_users.role\`. */
export type Papel = ${papeisConhecidos.map((papel) => `'${papel}'`).join(' | ')};

/** Os conjuntos com nome que o backend usa em \`Depends(exigir_papel(...))\`. */
export type ConjuntoDePapeis = ${CONJUNTOS_ESPERADOS.map((nome) => `'${nome}'`).join(' | ')};

export const CONJUNTOS: Record<ConjuntoDePapeis, readonly Papel[]> = {
${CONJUNTOS_ESPERADOS.map(
  (nome) => `  ${nome}: [${conjuntos[nome].map((papel) => `'${papel}'`).join(', ')}],`,
).join('\n')}
};

/**
 * Quem pode chamar cada rota \`/admin\`.
 *
 * \`satisfies Partial<Record<keyof paths, ...>>\` é o que trava o mapa contra o
 * contrato GERADO: um caminho que o backend renomeou vira erro de compilação
 * aqui, e não um botão escondido para sempre por apontar para uma rota que não
 * existe mais.
 */
export const PAPEL_POR_ROTA = {
${linhasDoMapa}
} as const satisfies Partial<
  Record<keyof paths, Partial<Record<'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', ConjuntoDePapeis>>>
>;

/**
 * As rotas \`/admin\` que de propósito NÃO exigem papel, com o motivo lá.
 *
 * Login aceita TODOS os papéis, inclusive \`print_agent\` — é por ele que o
 * agente de impressão se autentica, e recusá-lo no backend pararia a impressão
 * de todas as lojas. Quem recusa a conta de máquina é a TELA, depois do login.
 */
export const SEM_EXIGENCIA_DE_PAPEL: readonly string[] = [
${linhasSemExigencia}
];
`;

const opcoes = (await resolveConfig(SAIDA)) ?? {};
await writeFile(SAIDA, await format(arquivo, { ...opcoes, filepath: SAIDA }), 'utf8');

console.log(`papeis:generate: ${rotas.length} rotas em ${porCaminho.size} caminhos.`);
console.log(`papeis:generate: ${SAIDA} regravado.`);
