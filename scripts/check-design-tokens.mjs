/*
 * Valor solto nos CSS do painel.
 *
 * O ESLint não olha dentro de arquivo .css, e é lá que mora quase todo o
 * estilo. Esta verificação fecha o buraco: fora de `src/styles/tokens.css`,
 *
 *   - cor é `var(--token)`;
 *   - corpo de fonte é `var(--t-*)`;
 *   - raio é `var(--r-*)`.
 *
 * É a metade CSS da mesma regra que o eslint.config.js aplica no .ts/.tsx.
 * Roda no `npm run lint`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const cssRoot = join(projectRoot, 'src');

/** O único arquivo onde um literal é a definição, e não uma fuga. */
const TOKENS_FILE = join('src', 'styles', 'tokens.css');

const FORBIDDEN = [
  /*
   * `transparent` e `currentColor` não são cor de marca: são "sem cor" e "a cor
   * que o pai já decidiu". Ambos aparecem legitimamente em color-mix e em SVG.
   */
  { name: 'hexadecimal', pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'rgb()/rgba()', pattern: /\brgba?\s*\(/g },
  { name: 'hsl()/hsla()', pattern: /\bhsla?\s*\(/g },
  {
    name: 'cor por nome',
    pattern:
      /(?<![\w-])(white|black|red|green|blue|orange|yellow|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia)(?![\w-])/gi,
  },
  /*
   * Corpo de fonte em px. `font: inherit` e `font-size: inherit` continuam
   * valendo — o que não pode é escolher um tamanho que não está na escala.
   */
  {
    name: 'corpo de fonte solto',
    pattern: /font-size\s*:\s*[^;]*\b\d*\.?\d+(px|pt|rem|em)\b/g,
  },
  /*
   * Raio solto. A escala tem três degraus (--r-chip, --r-field, --r-card) mais
   * o --r-round; um quarto valor escrito à mão é como ela começa a desandar.
   */
  {
    name: 'raio solto',
    pattern: /border-radius\s*:\s*[^;]*\b\d*\.?\d+(px|rem|em)\b/g,
  },
  /*
   * FAMÍLIA DE FONTE MONOESPAÇADA — proibida em qualquer tela.
   *
   * A direção usava JetBrains Mono para tempo decorrido, dinheiro e nº de
   * pedido; isso saiu (ver o bloco do número em styles/typography.css). O
   * painel inteiro é uma letra só, Space Grotesk, com `tabular-nums` onde
   * precisa alinhar em coluna. Esta regra fecha a porta para a mono voltar
   * escondida num componente novo.
   */
  {
    name: 'família de fonte monoespaçada (proibida)',
    pattern: /font-family\s*:\s*[^;]*(mono|jetbrains|menlo|consolas|courier|sf mono)/gi,
  },
];

/** Troca o miolo dos comentários por espaço, preservando as quebras de linha. */
function blankComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

function collectCssFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      found.push(...collectCssFiles(fullPath));
    } else if (entry.endsWith('.css')) {
      found.push(fullPath);
    }
  }
  return found;
}

const problems = [];

for (const file of collectCssFiles(cssRoot)) {
  const relativePath = relative(projectRoot, file);
  if (relativePath === TOKENS_FILE) continue;

  const lines = blankComments(readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, index) => {
    for (const { name, pattern } of FORBIDDEN) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        problems.push({
          file: relativePath.split(sep).join('/'),
          line: index + 1,
          kind: name,
          text: match[0].trim(),
        });
      }
    }
  });
}

if (problems.length > 0) {
  console.error('Valor solto fora dos tokens do design system:\n');
  for (const problem of problems) {
    console.error(`  ${problem.file}:${problem.line}  ${problem.kind} "${problem.text}"`);
  }
  console.error(
    `\n${problems.length} ocorrência(s). Literal só é permitido em ${TOKENS_FILE.split(sep).join('/')}.`,
  );
  process.exit(1);
}

console.log('Aderência: nenhuma cor, corpo de fonte ou raio solto fora de src/styles/tokens.css.');
