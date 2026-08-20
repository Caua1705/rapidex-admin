import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/*
 * ADERÊNCIA AO DESIGN SYSTEM, no código .ts/.tsx.
 *
 * Estas regras moram AQUI e não mais no `_adherence.oxlintrc.json` que o design
 * system antigo publicava em `design/_ds/`. Aquele arquivo descreve um sistema
 * que foi substituído: ele cobra as fontes antigas (Manrope, IBM Plex Mono) e
 * as props de uma biblioteca de componentes que nunca existiu neste repositório.
 * Carregá-lo agora seria pedir aderência a um sistema que não é o nosso.
 *
 * O que sobrou é o que importa e continua valendo: nenhuma cor, nenhum px e
 * nenhuma família de fonte solta no código de produto.
 *
 * A metade CSS desta mesma regra está em scripts/check-design-tokens.mjs, que
 * roda no mesmo `npm run lint` — o ESLint não olha dentro de arquivo .css.
 */
const adherenceSelectors = [
  {
    selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
    message: 'Cor literal — use um token de cor via var(), de src/styles/tokens.css.',
  },
  {
    selector: 'Literal[value=/\\b\\d+px\\b/]',
    message: 'Valor em px solto — use um token (--sp-*, --t-*, --r-*) via var().',
  },
  /*
   * A lista já foi `Archivo|JetBrains Mono` — as duas famílias de uma direção
   * que saiu. A mono saiu do sistema POR COMPLETO (lia como terminal de
   * servidor), e o número tabular hoje é `.tnum`/`.num` na mesma Inter. Manter
   * a mono na lista de permitidas era o caminho aberto para ela voltar.
   */
  {
    selector: 'Literal[value=/font-family\\s*:\\s*(?![\'\\"]?Inter)/i]',
    message: 'Fonte fora do design system. A interface inteira é Inter, e não há mono.',
  },
];

/*
 * OS CAMINHOS QUE DEVOLVEM HTML AO NAVEGADOR.
 *
 * O painel mostra texto escrito pelo CLIENTE FINAL — observação do item, nota
 * do pedido, nome e endereço. É um estranho escrevendo na tela de quem tem, no
 * `localStorage`, um token de 12h que abre o restaurante inteiro. React escapa
 * filho de JSX por padrão, então hoje esse caminho é seguro; cada selector
 * abaixo é uma forma de ANULAR esse padrão.
 *
 * Nenhum deles tem uso legítimo neste projeto: a auditoria de 12/08/2026 não
 * encontrou nenhuma ocorrência em `src/`. A regra existe para que a primeira
 * ocorrência seja um erro de build e não uma linha revisada às pressas —
 * `dangerouslySetInnerHTML` para renderizar uma quebra de linha numa
 * observação é exatamente o patch de boa-fé que abriria isto.
 *
 * `src/orders/OrderDetailPanel.xss.test.tsx` guarda o outro lado: que o texto
 * do cliente continua chegando como TEXTO.
 *
 * Se algum dia um destes for mesmo necessário, o desvio é explícito, com o
 * motivo escrito na linha — não afrouxando a regra para o projeto inteiro.
 */
const xssSinkSelectors = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message:
      'dangerouslySetInnerHTML anula o escape do React — e o painel mostra texto escrito pelo cliente final. Renderize como filho de JSX.',
  },
  {
    selector:
      "AssignmentExpression[left.type='MemberExpression'][left.property.name=/^(innerHTML|outerHTML)$/]",
    message: 'Atribuir innerHTML/outerHTML injeta HTML. Use texto (textContent) ou JSX.',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'insertAdjacentHTML injeta HTML. Use insertAdjacentText ou JSX.',
  },
  {
    selector: "CallExpression[callee.property.name=/^(write|writeln)$/][callee.object.name='document']",
    message: 'document.write injeta HTML e reescreve o documento.',
  },
  {
    selector: "NewExpression[callee.name='Function']",
    message: 'new Function é eval com outro nome.',
  },
];

export default tseslint.config(
  {
    // O cliente da API é gerado e o `design/` é a exportação do design system:
    // nenhum dos dois é código deste projeto, e cobrar estilo deles só geraria
    // ruído que ninguém pode consertar aqui. As REGRAS do design system, essas
    // sim, são carregadas — de dentro de `design/` — mais abaixo.
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'src/api/generated',
      'design',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Scripts de build/verificação: rodam no Node, não no navegador.
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    /*
     * Os caminhos de HTML valem em TODO o `src/`, teste incluído: um helper de
     * teste que monta HTML vira, mais cedo ou mais tarde, um helper de tela.
     *
     * Este bloco vem antes do de aderência de propósito. `no-restricted-syntax`
     * não acumula entre blocos — o último que casa com o arquivo substitui o
     * anterior —, então o bloco seguinte repete os seletores de XSS junto com
     * os de aderência. Para arquivo de teste, que o bloco seguinte não alcança,
     * este aqui é o que vale.
     */
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...xssSinkSelectors],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-script-url': 'error',
    },
  },
  {
    /*
     * Aderência só no código de produto.
     *
     * Fora os testes porque a regra de hexadecimal casa com qualquer string
     * que comece por `#` seguido de caracteres hexadecimais — e `'#137'`, um
     * número de pedido numa asserção, é exatamente isso. Barrar cor solta na
     * tela é o objetivo; barrar número de pedido em teste seria ruído que
     * acabaria fazendo alguém desligar a regra inteira.
     *
     * Os seletores de XSS voltam aqui porque `no-restricted-syntax` substitui
     * em vez de acumular (ver o bloco acima).
     */
    files: ['src/**/*.{ts,tsx}'],
    /*
     * `src/prototipo/**` fica de fora pelo mesmo motivo que em
     * scripts/check-design-tokens.mjs: são os protótipos de DIREÇÃO VISUAL, e
     * a pergunta que eles fazem é se a paleta, a letra e a densidade atuais
     * devem continuar. Uma regra que exige `Inter` e `var(--token)` numa tela
     * que existe para propor outra letra e outros tokens só produziria três
     * versões da mesma direção.
     *
     * Os seletores de XSS continuam valendo (o bloco anterior os aplica a todo
     * o `src/`), e a exceção sai junto com a pasta quando a direção for
     * escolhida.
     */
    ignores: ['src/**/*.test.{ts,tsx}', 'src/prototipo/**'],
    rules: {
      'no-restricted-syntax': ['error', ...xssSinkSelectors, ...adherenceSelectors],
    },
  },
  prettier,
);
