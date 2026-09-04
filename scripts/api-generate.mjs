/*
 * De onde sai o contrato que gera `src/api/generated/openapi.d.ts`.
 *
 * POR QUE ISTO EXISTE
 *
 * O comando antigo baixava `https://api.pederapidex.com/openapi.json`. Essa URL
 * é DESLIGADA de propósito em produção: publicar o documento entregaria a
 * superfície inteira da API, `/admin` inclusive — o inventário de rotas de um
 * painel autenticado é meio caminho andado para atacá-lo. Então o contrato não
 * vem mais da API no ar; vem do `openapi.json` COMMITADO na raiz do repositório
 * do backend, que é a fonte da verdade que o próprio backend versiona.
 *
 * São três origens possíveis, nesta ordem:
 *
 *   1. `RAPIDEX_OPENAPI` — caminho ou URL, para apontar para outro lugar (uma
 *      branch do backend, um arquivo baixado à mão).
 *   2. `../pedeaqui_back/openapi.json` — o checkout irmão, se existir. É o que
 *      vale no dia a dia: funciona sem rede e já enxerga a alteração de
 *      contrato que você está escrevendo do outro lado, antes de ela subir.
 *   3. O raw do GitHub na `main` do backend, que é público. É o que funciona
 *      para quem não tem o backend clonado.
 *
 * POR QUE NÃO SUBMÓDULO: um submódulo traz o backend inteiro (histórico e
 * tudo) para dentro deste repositório e crava um SHA que alguém precisa
 * atualizar a cada mudança de contrato — dois commits para um arquivo JSON. E
 * passaria a pesar em todo `git clone` e em todo checkout do CI, que hoje não
 * precisam do backend para nada: o `openapi.d.ts` gerado é versionado aqui, e o
 * `npm ci` do CI não roda este script.
 *
 * O documento é lido e passado JÁ EM MEMÓRIA para o gerador, em vez de entregar
 * o caminho para ele. O `openapi-typescript` transforma caminho em URL, e o
 * `Belém-Projetos` do caminho desta máquina volta percent-encoded para o
 * `lstat` — que então não acha o arquivo.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import openapiTS, { astToString } from 'openapi-typescript';
import { format, resolveConfig } from 'prettier';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const CHECKOUT_IRMAO = join(projectRoot, '..', 'pedeaqui_back', 'openapi.json');
const RAW_GITHUB = 'https://raw.githubusercontent.com/Caua1705/pedeaqui_back/main/openapi.json';
const SAIDA = join(projectRoot, 'src', 'api', 'generated', 'openapi.d.ts');

function origem() {
  if (process.env.RAPIDEX_OPENAPI) {
    return { fonte: process.env.RAPIDEX_OPENAPI, como: 'RAPIDEX_OPENAPI' };
  }
  if (existsSync(CHECKOUT_IRMAO)) {
    return { fonte: CHECKOUT_IRMAO, como: 'checkout irmão ../pedeaqui_back' };
  }
  return { fonte: RAW_GITHUB, como: 'raw do GitHub (main do backend)' };
}

async function lerContrato(fonte) {
  if (/^https?:\/\//.test(fonte)) {
    const resposta = await fetch(fonte);
    if (!resposta.ok) {
      throw new Error(`${resposta.status} ${resposta.statusText}`);
    }
    return resposta.json();
  }
  return JSON.parse(await readFile(fonte, 'utf8'));
}

const { fonte, como } = origem();
console.log(`api:generate: lendo o contrato de ${fonte}`);
console.log(`              (${como})`);

let contrato;
try {
  contrato = await lerContrato(fonte);
} catch (erro) {
  console.error(`api:generate: não consegui ler o contrato de ${fonte}`);
  console.error(`  ${erro instanceof Error ? erro.message : String(erro)}`);
  if (fonte === RAW_GITHUB) {
    console.error('Sem rede? Clone o backend ao lado deste repositório, ou aponte');
    console.error('RAPIDEX_OPENAPI para um openapi.json local.');
  }
  process.exit(1);
}

const tipos = astToString(await openapiTS(contrato));

// O Prettier roda pela API pelo mesmo motivo do gerador: o CLI resolveria
// caminho, e o diff no git precisa sair formatado igual ao resto do repositório.
const opcoes = (await resolveConfig(SAIDA)) ?? {};
await writeFile(SAIDA, await format(tipos, { ...opcoes, filepath: SAIDA }), 'utf8');

console.log(`api:generate: ${SAIDA} regravado.`);

/*
 * ============================================================================
 * E O CONTRATO CRU, PARA O FALSO DO E2E
 * ============================================================================
 *
 * O `.d.ts` é o contrato em tempo de COMPILAÇÃO, e é tudo que o `src/` precisa.
 * Ele não serve para conferir um corpo em tempo de EXECUÇÃO: tipo apagado é
 * tipo que não existe às 3h da manhã, quando o falso recebe um `name` de 300
 * caracteres que produção recusaria com 422.
 *
 * Era a lacuna nomeada em `scratchpad/falso-contra-o-contrato.md`: a amarra de
 * `e2e/contrato.ts` fechou a deriva de FORMA (campo renomeado, status que não
 * existe), e a de REGRA continuou aberta porque "validar o corpo recebido
 * exigiria o /openapi.json, e hoje só o .d.ts é versionado".
 *
 * ELE VIVE EM `e2e/`, E NÃO EM `src/api/generated/`, de propósito: são 698 KB,
 * e um `import` distraído dentro de `src/` os despacharia para o navegador do
 * lojista. Aqui isso é impossível por construção — o Vite não constrói `e2e/`.
 *
 * ESCRITO PELO MESMO COMANDO que o `.d.ts`, e nunca separado: dois artefatos do
 * mesmo contrato gerados por comandos diferentes divergem no dia em que alguém
 * roda um só.
 */
const CONTRATO_CRU = join(projectRoot, 'e2e', 'generated', 'openapi.json');
await mkdir(join(projectRoot, 'e2e', 'generated'), { recursive: true });

const cruOpcoes = (await resolveConfig(CONTRATO_CRU)) ?? {};
await writeFile(
  CONTRATO_CRU,
  await format(JSON.stringify(contrato), { ...cruOpcoes, filepath: CONTRATO_CRU }),
  'utf8',
);

console.log(`api:generate: ${CONTRATO_CRU} regravado.`);
