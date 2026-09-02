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

function arquivos(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, out);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(p);
  }
  return out;
}

const problemas = [];

for (const arquivo of arquivos(srcRoot)) {
  const relativo = relative(projectRoot, arquivo).split(sep).join('/');
  // O contrato é gerado: o que estiver lá é do backend, e não se edita aqui.
  if (relativo.startsWith('src/api/generated/')) continue;

  const src = readFileSync(arquivo, 'utf8');
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

console.log('Fuso: todo formatador de data em src/ declara o timeZone da operação.');
