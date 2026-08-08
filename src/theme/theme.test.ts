import { beforeEach, describe, expect, it } from 'vitest';

import { applyTheme, nextTheme, readStoredTheme, storeTheme, THEME_STORAGE_KEY } from './theme';

describe('tema', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('sem escolha guardada não afirma tema nenhum', () => {
    expect(readStoredTheme()).toBeNull();
  });

  it('ignora valor estragado no localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'roxo');
    expect(readStoredTheme()).toBeNull();
  });

  it('guarda e devolve a escolha do lojista', () => {
    storeTheme('light');
    expect(readStoredTheme()).toBe('light');
  });

  // O escuro é o :root puro: marcar data-theme="dark" sugeriria duas paletas.
  it('escreve data-theme só no claro', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    applyTheme('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('alterna entre os dois e volta', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme(nextTheme('dark'))).toBe('dark');
  });
});
