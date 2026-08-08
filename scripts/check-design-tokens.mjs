/**
 * Cor solta nos CSS do painel.
 *
 * O `_adherence.oxlintrc.json` do design system barra hexadecimal em literal
 * de JavaScript, mas neste projeto a cor mora em arquivo .css — onde o ESLint
 * não olha. Esta verificação fecha esse buraco: fora de `src/styles/tokens.css`,
 * cor é `var(--token)` ou não passa.
 *
 * Roda no `npm run lint`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const cssRoot = join(projectRoot, 'src');

/** O único arquivo onde uma cor literal é a definição, e não uma fuga. */
const TOKENS_FILE = join('src', 'styles', 'tokens.css');

/**
 * `transparent` e `currentColor` não são cor de marca: são "sem cor" e "a cor
 * que o pai já decidiu". Ambos aparecem legitimamente em color-mix e em SVG.
 */
const FORBIDDEN = [
  { name: 'hexadecimal', pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'rgb()/rgba()', pattern: /\brgba?\s*\(/g },
  { name: 'hsl()/hsla()', pattern: /\bhsla?\s*\(/g },
  { name: 'oklch()/oklab()', pattern: /\bokl(ch|ab)\s*\(/g },
  {
    name: 'cor por nome',
    pattern:
      /(?<![\w-])(white|black|red|green|blue|orange|yellow|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia)(?![\w-])/gi,
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
          text: match[0],
        });
      }
    }
  });
}

if (problems.length > 0) {
  console.error('Cor fora dos tokens do design system:\n');
  for (const problem of problems) {
    console.error(
      `  ${problem.file}:${problem.line}  ${problem.kind} "${problem.text}" — use var(--token) de src/styles/tokens.css`,
    );
  }
  console.error(
    `\n${problems.length} ocorrência(s). Cor literal só é permitida em ${TOKENS_FILE.split(sep).join('/')}.`,
  );
  process.exit(1);
}

console.log('Aderência de cor: nenhum valor solto fora de src/styles/tokens.css.');
