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
const adherenceRules = {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
      message: 'Cor literal — use um token de cor via var(), de src/styles/tokens.css.',
    },
    {
      selector: 'Literal[value=/\\b\\d+px\\b/]',
      message: 'Valor em px solto — use um token (--sp-*, --t-*, --r-*) via var().',
    },
    {
      selector: 'Literal[value=/font-family\\s*:\\s*(?![\'\\"]?(?:Archivo|JetBrains Mono))/i]',
      message: 'Fonte fora do design system. Disponíveis: Archivo, JetBrains Mono.',
    },
  ],
};

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
     * Aderência só no código de produto.
     *
     * Fora os testes porque a regra de hexadecimal casa com qualquer string
     * que comece por `#` seguido de caracteres hexadecimais — e `'#137'`, um
     * número de pedido numa asserção, é exatamente isso. Barrar cor solta na
     * tela é o objetivo; barrar número de pedido em teste seria ruído que
     * acabaria fazendo alguém desligar a regra inteira.
     */
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: adherenceRules,
  },
  prettier,
);
