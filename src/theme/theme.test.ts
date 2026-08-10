import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTheme,
  initialTheme,
  nextTheme,
  readStoredTheme,
  storeTheme,
  systemTheme,
  THEME_STORAGE_KEY,
} from './theme';

/** Finge a preferência do sistema operacional para o teste. */
function mockPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? dark : !dark,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('tema', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sem escolha guardada não afirma tema nenhum', () => {
    expect(readStoredTheme()).toBeNull();
  });

  it('ignora valor estragado no localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'roxo');
    expect(readStoredTheme()).toBeNull();
  });

  it('guarda e devolve a escolha do lojista', () => {
    storeTheme('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  /*
   * O atributo é escrito SEMPRE, com o valor explícito nos dois casos. Deixar
   * o claro como ":root sem atributo" obrigava quem lê o DOM a deduzir o tema
   * pela ausência de algo.
   */
  it('escreve data-theme nos dois temas', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('alterna entre os dois e volta', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme(nextTheme('dark'))).toBe('dark');
  });

  it('lê a preferência declarada no sistema', () => {
    mockPrefersDark(true);
    expect(systemTheme()).toBe('dark');

    mockPrefersDark(false);
    expect(systemTheme()).toBe('light');
  });

  /*
   * A regra de precedência inteira: enquanto ninguém escolheu, o sistema manda;
   * depois da primeira escolha, ela manda — inclusive contra o sistema.
   */
  it('sem escolha, segue o sistema', () => {
    mockPrefersDark(true);
    expect(initialTheme()).toBe('dark');
  });

  it('com escolha guardada, ela ganha do sistema', () => {
    mockPrefersDark(true);
    storeTheme('light');
    expect(initialTheme()).toBe('light');
  });
});
