/*
 * ============================================================================
 * DATA FORMATADA SEM FUSO DECLARADO
 * ============================================================================
 *
 * O painel conta o dia em `America/Fortaleza` (`OPERATION_TIMEZONE`), como o
 * backend. Um formatador de data ou hora SEM `timeZone` usa o fuso do
 * NAVEGADOR — o do tablet de balcão em modo quiosque que ninguém configurou, o
 * do notebook trazido de outro estado —, e a tela passa a dizer uma hora que
 * não é a da loja.
 *
 * ISTO EXISTE POR UM CASO REAL, e ele estava vivo quando este arquivo foi
 * escrito: `notaDaPausa` formatava o fim da pausa da entrega sem fuso. O
 * lojista pausava até as 20:30 e um aparelho mal configurado lia "Pausada até
 * 23:30" — três horas de mentira sobre quando a entrega volta, no único estado
 * do painel que se desfaz sozinho e cujo único sintoma é a ausência de pedido.
 *
 * POR QUE UMA VERIFICAÇÃO E NÃO UM TESTE. O portão fixa o fuso do processo em
 * `America/Fortaleza` (ver `vite.config.ts`), e isso é certo — sem ele o teste
 * responde uma coisa na máquina do desenvolvedor e outra no CI. Mas o pino
 * ESCONDE justamente esta classe: com o processo em UTC-3, o código errado
 * produz a string certa e nenhum teste acende. Só uma regra estrutural, que
 * olha o CÓDIGO e não o resultado, alcança isto.
 *
 * `toLocaleString` de NÚMERO não entra: ele não tem fuso, e o painel o usa para
 * porcentagem e nota média. A diferença é olhada caso a caso abaixo.
 *
 * Roda no `npm run lint`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const srcRoot = join(projectRoot, 'src');

/** Só os que formatam DATA. `toLocaleString` de número não tem fuso. */
const FORMATADORES = [
  { nome: 'Intl.DateTimeFormat', pattern: /new\s+Intl\.DateTimeFormat\s*\(/g },
  { nome: 'toLocaleTimeString', pattern: /\.toLocaleTimeString\s*\(/g },
  { nome: 'toLocaleDateString', pattern: /\.toLocaleDateString\s*\(/g },
];

/**
 * ============================================================================
 * A OUTRA METADE: LER a data no fuso errado, sem formatar nada
 * ============================================================================
 *
 * Os formatadores acima são só uma das portas. `getHours()`, `getDate()` e
 * `getDay()` respondem no fuso do NAVEGADOR sem passar por `Intl` nenhum, e
 * `toISOString()` responde em UTC — que às 22h em Fortaleza já é o dia
 * seguinte.
 *
 * Foi por aqui que passou o segundo defeito desta família: `usePrepRange` lia
 * o dia da semana com `backendWeekday(new Date())`, e o painel num aparelho
 * mal configurado mostrava o prazo de preparo do dia errado. Nenhum formatador
 * estava envolvido, e a primeira versão desta verificação não o teria visto.
 *
 * ELES NÃO SÃO SEMPRE ERRADOS — e é por isso que a saída é um COMENTÁRIO no
 * lugar, e não uma lista de arquivos aqui. Ancorar ao meio-dia UTC e ler em UTC
 * é correto e o repositório o faz de propósito em três lugares. O que não pode
 * é o próximo passar batido.
 */
/**
 * ============================================================================
 * O "AGORA" ENTREGUE A QUEM LÊ NO FUSO LOCAL
 * ============================================================================
 *
 * A regra de `LEITURAS` tem um buraco, e ele é o do defeito que a originou:
 * `backendWeekday(new Date())` não tem `.getDay()` nenhum no lugar da chamada —
 * a leitura local mora DENTRO de `backendWeekday`, que é legitimamente isenta
 * (ela converte a numeração de uma data que quem chama escolheu).
 *
 * A COMPOSIÇÃO é que está errada: entregar o INSTANTE ATUAL a uma função que
 * responde no fuso de quem a chamou é perguntar "que dia é hoje" ao aparelho.
 * "Hoje" tem função própria — `weekdayDaOperacao()`.
 *
 * Esta lista é de PARES nome+agora, e cresce um por vez. Uma regra genérica
 * ("`new Date()` sem argumento em qualquer lugar") acusaria as dezenas de usos
 * corretos — carimbo de "salvo", medição de tempo decorrido — e viraria ruído
 * que se aprende a ignorar, que é como um portão morre.
 */
const AGORA_NO_FUSO_ERRADO = [
  {
    nome: 'backendWeekday(new Date())',
    pattern: /backendWeekday\s*\(\s*(?:new\s+Date\s*\(\s*\)|Date\.now\s*\(\s*\))/g,
    conserto: 'use `weekdayDaOperacao()`: "hoje" é o dia da LOJA, não o do aparelho',
  },
];
const LEITURAS = [
  {
    nome: 'getter de fuso LOCAL',
    pattern: /\.get(?:Hours|Minutes|Seconds|Date|Month|FullYear|Day)\s*\(\)/g,
  },
  { nome: 'toISOString (responde em UTC)', pattern: /\.toISOString\s*\(\)/g },
  { nome: 'getter UTC', pattern: /\.getUTC[A-Za-z]+\s*\(\)/g },
];

/**
 * A fuga declarada: `// fuso-ok: <razão>` na linha, ou no comentário colado
 * acima dela.
 *
 * Lista de exceção por caminho de arquivo envelhece calada — o arquivo é
 * renomeado, a linha muda, e a isenção passa a cobrir outra coisa. O
 * comentário anda junto com o código que ele isenta, e obriga a escrever o
 * PORQUÊ ali, onde quem for mexer vai lê-lo.
 *
 * A busca sobe pelo BLOCO de comentário inteiro, e não uma linha só: exigir que
 * a razão caiba em 100 colunas produziria a razão que cabe, não a que explica —
 * e o motivo de `backendWeekday` ser legítimo leva três linhas para ser dito.
 */
function temFugaDeclarada(linhas, indice) {
  if (/fuso-ok:/.test(linhas[indice] ?? '')) return true;

  for (let i = indice - 1; i >= 0; i -= 1) {
    const linha = (linhas[i] ?? '').trim();
    // Só sobe enquanto for comentário colado: uma linha de código no meio
    // significa que aquele bloco isenta OUTRA coisa.
    if (!linha.startsWith('//') && !linha.startsWith('*') && !linha.startsWith('/*')) return false;
    if (/fuso-ok:/.test(linha)) return true;
  }
  return false;
}

/**
 * O trecho de código a partir do `(`, até fechar os parênteses.
 *
 * Contar parênteses em vez de olhar a linha não é preciosismo: as opções de um
 * `Intl.DateTimeFormat` deste repositório ocupam cinco linhas, e uma regra que
 * olhasse só a linha da chamada acusaria todas elas.
 */
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
 * O código sem os comentários, com o comprimento e as quebras preservados.
 *
 * SEM ISTO A VERIFICAÇÃO ACUSA A SI MESMA: o comentário de `weekdayDaOperacao`
 * cita `backendWeekday(new Date())` para explicar por que aquilo é errado, e a
 * regra casava com a explicação. Um portão que acusa a documentação do próprio
 * defeito ensina, em uma tarde, a desligar o portão.
 *
 * Os espaços no lugar do texto mantêm índice e número de linha idênticos, então
 * a posição relatada continua sendo a do arquivo de verdade — e a busca pela
 * fuga `// fuso-ok:` continua lendo as linhas ORIGINAIS, que é onde ela mora.
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

const problemas = [];
const leiturasSemFuga = [];
const composicoes = [];

for (const arquivo of arquivos(srcRoot)) {
  const relativo = relative(projectRoot, arquivo).split(sep).join('/');
  // O contrato é gerado: o que estiver lá é do backend, e não se edita aqui.
  if (relativo.startsWith('src/api/generated/')) continue;

  const original = readFileSync(arquivo, 'utf8');
  // As regras casam no código CEGO; a fuga é procurada no texto original.
  const src = semComentarios(original);
  const linhas = original.split('\n');

  for (const { nome, pattern, conserto } of AGORA_NO_FUSO_ERRADO) {
    pattern.lastIndex = 0;
    let mm;
    while ((mm = pattern.exec(src))) {
      const numero = src.slice(0, mm.index).split('\n').length;
      if (temFugaDeclarada(linhas, numero - 1)) continue;
      composicoes.push({ file: relativo, line: numero, kind: nome, conserto });
    }
  }

  for (const { nome, pattern } of LEITURAS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(src))) {
      const numero = src.slice(0, m.index).split('\n').length;
      if (temFugaDeclarada(linhas, numero - 1)) continue;
      leiturasSemFuga.push({ file: relativo, line: numero, kind: nome });
    }
  }

  for (const { nome, pattern } of FORMATADORES) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(src))) {
      const abre = m.index + m[0].length - 1;
      const texto = chamada(src, abre);
      if (texto.includes('timeZone')) continue;
      problemas.push({
        file: relativo,
        line: src.slice(0, m.index).split('\n').length,
        kind: nome,
      });
    }
  }
}

if (composicoes.length > 0) {
  console.error('"Hoje" perguntado ao APARELHO, e não à loja:\n');
  for (const c of composicoes) {
    console.error(`  ${c.file}:${c.line}  ${c.kind} — ${c.conserto}`);
  }
  process.exit(1);
}

if (leiturasSemFuga.length > 0) {
  console.error('Leitura de data no fuso do navegador (ou em UTC) sem razão declarada:\n');
  for (const p of leiturasSemFuga) {
    console.error(`  ${p.file}:${p.line}  ${p.kind}`);
  }
  console.error(
    '\nSe estiver certo, escreva a razão no lugar: `// fuso-ok: <por quê>` na' +
      ' mesma linha ou na anterior.',
  );
  process.exit(1);
}

if (problemas.length > 0) {
  console.error('Data formatada sem `timeZone` — ela sai no fuso do navegador:\n');
  for (const p of problemas) {
    console.error(`  ${p.file}:${p.line}  ${p.kind}() sem timeZone`);
  }
  console.error(
    '\nO painel conta o dia em America/Fortaleza. Passe' +
      ' `timeZone: OPERATION_TIMEZONE` (src/orders/format.ts).',
  );
  process.exit(1);
}

console.log(
  'Fuso: todo formatador de data em src/ declara o timeZone da operação, e toda' +
    ' leitura de fuso local tem razão escrita.',
);
