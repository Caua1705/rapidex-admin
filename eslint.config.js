import { createRequire } from 'node:module';

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

const require = createRequire(import.meta.url);

/*
 * As regras de aderência ao design system vêm do arquivo que o próprio design
 * system publica, e não de uma cópia mantida à mão:
 *
 *   design/_ds/rapidex-design-system-<id>/_adherence.oxlintrc.json
 *
 * Ele é um oxlintrc, mas as duas regras que importam (`no-restricted-syntax` e
 * `no-restricted-imports`) são regras do ESLint com a mesma forma de
 * configuração, então dá para carregá-las direto. Quando o design system for
 * reexportado, o lint acompanha sem ninguém editar este arquivo.
 *
 * `react/forbid-elements` fica de fora de propósito: a lista `forbid` dele vem
 * vazia (não proíbe elemento nenhum) e habilitá-la exigiria o
 * eslint-plugin-react só para não fazer nada.
 */
const adherence = require('./design/_ds/rapidex-design-system-c214e0d9-9d0d-4c89-a2fa-a40733347892/_adherence.oxlintrc.json');

const adherenceRules = {
  'no-restricted-syntax': adherence.rules['no-restricted-syntax'],
  'no-restricted-imports': adherence.rules['no-restricted-imports'],
};

export default tseslint.config(
  {
    // O cliente da API é gerado e o `design/` é a exportação do design system:
    // nenhum dos dois é código deste projeto, e cobrar estilo deles só geraria
    // ruído que ninguém pode consertar aqui. As REGRAS do design system, essas
    // sim, são carregadas — de dentro de `design/` — mais abaixo.
    ignores: ['dist', 'coverage', 'playwright-report', 'src/api/generated', 'design'],
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
