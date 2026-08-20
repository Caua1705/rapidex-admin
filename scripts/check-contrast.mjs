/*
 * CONTRASTE MEDIDO, NOS DOIS TEMAS.
 *
 * A spec de acessibilidade diz "meça, não estime" — então isto lê os valores
 * de `src/styles/tokens.css` (a fonte da verdade, não uma cópia), calcula a
 * razão de contraste de cada par que a interface realmente usa e falha se
 * algum ficar abaixo do mínimo da WCAG 2.2 AA.
 *
 * Mínimos:
 *   4.5:1  texto normal            (1.4.3)
 *   3.0:1  texto grande (≥18.66px bold ou ≥24px) (1.4.3)
 *   3.0:1  borda de controle e ícone informativo (1.4.11)
 *
 * Roda no `npm run lint` e, portanto, no CI.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokensFile = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url));
const source = readFileSync(tokensFile, 'utf8');

/**
 * Lê os tokens de um bloco (`:root` = claro, `[data-theme='dark']` = escuro).
 *
 * Resolve `var(--outro)` de um nível, que é o quanto o arquivo usa — assim
 * `--focus: var(--ember)` é medido como o laranja de verdade, e não ignorado.
 */
function readTheme(selector) {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`Bloco ${selector} não encontrado em tokens.css`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('\n}', open);
  const body = source.slice(open, close);

  const tokens = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

const light = readTheme(':root');
const darkOverrides = readTheme("[data-theme='dark']");
const dark = { ...light, ...darkOverrides };

function resolve(tokens, name) {
  const value = tokens[name];
  if (value === undefined) throw new Error(`Token ${name} não existe`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias ? resolve(tokens, alias[1]) : value;
}

function toRgb(value) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!hex) throw new Error(`Não sei medir "${value}" — o par precisa ser hexadecimal`);
  const digits =
    hex[1].length === 3
      ? hex[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : hex[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
}

function luminance(value) {
  const [r, g, b] = toRgb(value).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Os pares que a interface usa de verdade.
 *
 * `min` é o mínimo exigido para AQUELE uso: 4.5 em texto normal, 3 em texto
 * grande e em contorno de controle. Um par que não estiver nesta lista é um
 * par que ninguém garante — ao criar uma combinação nova na interface,
 * acrescente-a aqui.
 */
const PAIRS = [
  // --- texto sobre as superfícies ---
  { fg: '--ink', bg: '--bg', min: 4.5, use: 'corpo sobre o fundo da página' },
  { fg: '--ink', bg: '--surface', min: 4.5, use: 'corpo sobre cartão' },
  { fg: '--ink', bg: '--field', min: 4.5, use: 'corpo sobre campo' },
  { fg: '--ink-2', bg: '--bg', min: 4.5, use: 'texto secundário sobre a página' },
  { fg: '--ink-2', bg: '--surface', min: 4.5, use: 'texto secundário sobre cartão' },
  { fg: '--ink-3', bg: '--bg', min: 4.5, use: 'apoio/hint sobre a página' },
  { fg: '--ink-3', bg: '--surface', min: 4.5, use: 'apoio/hint sobre cartão' },
  { fg: '--ink-3', bg: '--field', min: 4.5, use: 'placeholder sobre campo' },
  { fg: '--ink', bg: '--surface-raised', min: 4.5, use: 'corpo em menu/diálogo' },
  { fg: '--ink-2', bg: '--surface-raised', min: 4.5, use: 'secundário em menu/diálogo' },
  { fg: '--ink-3', bg: '--surface-raised', min: 4.5, use: 'apoio em menu/diálogo' },

  /*
   * O PLANO DE AGRUPAMENTO. Ele carrega texto de verdade — cabeçalho de coluna
   * de tabela e trilho de segmentado — e ficava de fora da medição porque, na
   * direção anterior, quase nada escrevia sobre ele. Com a separação passando a
   * ser TONAL em vez de contornada, `--surface-muted` virou plano de leitura.
   */
  { fg: '--ink', bg: '--surface-muted', min: 4.5, use: 'corpo sobre agrupamento' },
  { fg: '--ink-2', bg: '--surface-muted', min: 4.5, use: 'secundário sobre agrupamento' },
  { fg: '--ink-3', bg: '--surface-muted', min: 4.5, use: 'cabeçalho de coluna de tabela' },

  /*
   * A SELEÇÃO. `--surface-selected` é o plano da linha/ticket escolhido, e o
   * texto dele continua sendo o texto comum: se ele não passar, selecionar um
   * pedido piora a legibilidade do que se veio ler.
   */
  { fg: '--ink', bg: '--surface-selected', min: 4.5, use: 'corpo sobre item selecionado' },
  { fg: '--ink-3', bg: '--surface-selected', min: 4.5, use: 'meta sobre item selecionado' },

  /*
   * A semântica de estado (--ok, --alert, --danger) sobre cada plano onde ela
   * aparece como TEXTO, e sobre o próprio wash quando ela vira faixa de aviso.
   */
  { fg: '--ok', bg: '--surface', min: 4.5, use: 'confirmação sobre cartão' },
  { fg: '--ok', bg: '--bg', min: 4.5, use: 'confirmação sobre a página' },
  { fg: '--alert', bg: '--surface', min: 4.5, use: 'atenção sobre cartão' },
  { fg: '--alert', bg: '--alert-wash', min: 4.5, use: 'texto do aviso de atenção' },
  { fg: '--danger', bg: '--surface', min: 4.5, use: 'perigo sobre cartão' },
  { fg: '--danger', bg: '--bg', min: 4.5, use: 'perigo sobre a página' },
  { fg: '--danger', bg: '--danger-wash', min: 4.5, use: 'texto do aviso de erro' },
  { fg: '--st-aceito', bg: '--st-aceito-wash', min: 4.5, use: 'texto do aviso informativo' },
  // O interruptor ligado é elemento gráfico, não texto (1.4.11).
  { fg: '--ok', bg: '--surface', min: 3, use: 'interruptor ligado sobre cartão' },
  // O traço do checkbox/rádio marcado é elemento gráfico, não texto (1.4.11).
  { fg: '--mark-ink', bg: '--mark-bg', min: 3, use: 'marca do checkbox/rádio marcado' },

  // --- marca ---
  { fg: '--on-ember', bg: '--ember', min: 4.5, use: 'texto do botão primário' },
  {
    fg: '--on-ember-press',
    bg: '--ember-press',
    min: 4.5,
    use: 'texto do botão primário pressionado',
  },
  { fg: '--ember', bg: '--bg', min: 3, use: 'anel de foco sobre a página' },
  { fg: '--ember', bg: '--surface', min: 3, use: 'anel de foco sobre cartão' },
  { fg: '--ember', bg: '--surface-raised', min: 3, use: 'anel de foco em menu/diálogo' },
  /*
   * `--ember-wash` NÃO carrega texto laranja em lugar nenhum, e é por isso que
   * o par medido aqui é com `--ink`.
   *
   * O item ativo da navegação já tentou ser "laranja sobre laranja claro": no
   * claro dava 3.11:1 e no escuro 4.17:1, os dois abaixo do mínimo para texto
   * de 13px, e não existe um laranja que passe nos dois sem deixar de ser o
   * laranja da marca. O item ativo virou tinta cheia + peso + um trilho de 2px
   * na cor da marca — mais legível, e com a marca aparecendo menos.
   */
  { fg: '--ink', bg: '--ember-wash', min: 4.5, use: 'texto selecionado (::selection)' },

  /*
   * O CONSOLE (a lateral), que é escuro nos DOIS temas — mas com um valor
   * PRÓPRIO por tema, não compartilhado. Continua tendo pares dedicados aqui
   * por um motivo diferente agora: um plano que só é redefinido num lugar do
   * arquivo é o que mais costuma escapar da revisão quando alguém mexe só no
   * bloco do tema escuro ou só no do claro.
   */
  { fg: '--console-ink', bg: '--console-bg', min: 4.5, use: 'item da navegação' },
  { fg: '--console-ink-2', bg: '--console-bg', min: 4.5, use: 'item inativo da navegação' },
  { fg: '--console-ink-3', bg: '--console-bg', min: 4.5, use: 'rótulo de grupo da navegação' },
  { fg: '--ember', bg: '--console-bg', min: 3, use: 'trilho do item ativo da navegação' },

  /*
   * Contorno de controle (1.4.11).
   *
   * `--line` e `--line-strong` NÃO estão aqui de propósito: eles separam
   * seções e linhas de lista, e separador não é "informação necessária para
   * identificar um componente". Quem contorna o que se opera é
   * `--line-control`, e é ele que precisa dos 3:1.
   */
  { fg: '--line-control', bg: '--surface', min: 3, use: 'borda de campo sobre cartão' },
  { fg: '--line-control', bg: '--bg', min: 3, use: 'borda de campo sobre a página' },
  { fg: '--line-control', bg: '--field', min: 3, use: 'borda de campo preenchido' },

  /*
   * O CHIP DE STATUS.
   *
   * O texto do chip é `--ink`, não a cor do status: as três matizes mais claras
   * da escala (pendente, concluído, cancelado) já chegam a ~4.5:1 contra branco
   * puro, então sobre QUALQUER fundo tingido elas caem abaixo do mínimo. Com a
   * tinta comum no texto e a matiz no ponto ao lado, o chip continua carregando
   * cor + texto + forma (1.4.1) e passa com folga.
   */
  { fg: '--ink', bg: '--st-pendente-wash', min: 4.5, use: 'texto do chip Pendente' },
  { fg: '--ink', bg: '--st-aceito-wash', min: 4.5, use: 'texto do chip Aceito' },
  { fg: '--ink', bg: '--st-preparando-wash', min: 4.5, use: 'texto do chip Preparando' },
  { fg: '--ink', bg: '--st-pronto-wash', min: 4.5, use: 'texto do chip Pronto' },
  { fg: '--ink', bg: '--st-entrega-wash', min: 4.5, use: 'texto do chip Saiu para entrega' },
  { fg: '--ink', bg: '--st-concluido-wash', min: 4.5, use: 'texto do chip Concluído' },
  { fg: '--ink', bg: '--st-cancelado-wash', min: 4.5, use: 'texto do chip Cancelado' },

  // O ponto do chip é elemento gráfico informativo: 3:1 basta (1.4.11).
  { fg: '--st-pendente', bg: '--st-pendente-wash', min: 3, use: 'ponto do chip Pendente' },
  { fg: '--st-aceito', bg: '--st-aceito-wash', min: 3, use: 'ponto do chip Aceito' },
  { fg: '--st-preparando', bg: '--st-preparando-wash', min: 3, use: 'ponto do chip Preparando' },
  { fg: '--st-pronto', bg: '--st-pronto-wash', min: 3, use: 'ponto do chip Pronto' },
  { fg: '--st-entrega', bg: '--st-entrega-wash', min: 3, use: 'ponto do chip Saiu para entrega' },
  { fg: '--st-concluido', bg: '--st-concluido-wash', min: 3, use: 'ponto do chip Concluído' },
  { fg: '--st-cancelado', bg: '--st-cancelado-wash', min: 3, use: 'ponto do chip Cancelado' },

  // --- status como texto e como marca gráfica sobre as superfícies ---
  { fg: '--st-pendente', bg: '--surface', min: 4.5, use: 'texto de status sobre cartão' },
  { fg: '--st-aceito', bg: '--surface', min: 4.5, use: 'texto de status sobre cartão' },
  { fg: '--st-preparando', bg: '--surface', min: 4.5, use: 'texto de status sobre cartão' },
  { fg: '--st-pronto', bg: '--surface', min: 4.5, use: 'texto de status sobre cartão' },
  { fg: '--st-entrega', bg: '--surface', min: 4.5, use: 'texto de status sobre cartão' },
  { fg: '--st-concluido', bg: '--surface', min: 4.5, use: 'texto de status sobre cartão' },
  { fg: '--st-cancelado', bg: '--surface', min: 4.5, use: 'texto de status sobre cartão' },
  { fg: '--st-pendente', bg: '--bg', min: 3, use: 'fio de maturação sobre a página' },
  { fg: '--st-pronto', bg: '--bg', min: 3, use: 'fio de maturação sobre a página' },
  { fg: '--st-cancelado', bg: '--bg', min: 3, use: 'fio de maturação sobre a página' },
];

const themes = [
  { name: 'claro', tokens: light },
  { name: 'escuro', tokens: dark },
];

const failures = [];
let measured = 0;

for (const theme of themes) {
  for (const pair of PAIRS) {
    const fg = resolve(theme.tokens, pair.fg);
    const bg = resolve(theme.tokens, pair.bg);
    const value = ratio(fg, bg);
    measured += 1;
    if (value < pair.min) {
      failures.push(
        `  [${theme.name}] ${pair.use}\n` +
          `      ${pair.fg} (${fg}) sobre ${pair.bg} (${bg})\n` +
          `      ${value.toFixed(2)}:1 — mínimo ${pair.min.toFixed(1)}:1`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`Contraste abaixo do mínimo da WCAG 2.2 AA em ${failures.length} par(es):\n`);
  console.error(failures.join('\n\n'));
  console.error('\nCorrija o token — não o critério.');
  process.exit(1);
}

console.log(`Contraste: ${measured} pares medidos nos dois temas, todos dentro da WCAG 2.2 AA.`);
