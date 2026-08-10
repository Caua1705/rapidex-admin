/**
 * Tema claro/escuro.
 *
 * CLARO É O PADRÃO DO SISTEMA, mas o padrão INICIAL de cada pessoa é o que o
 * sistema operacional dela pede (`prefers-color-scheme`). Só depois que ela
 * mexe no alternador é que existe uma escolha, e aí ela vale para sempre — é a
 * ordem que a WCAG e o bom senso pedem: respeitar a preferência declarada
 * antes de impor a nossa.
 *
 * O atributo `data-theme` é SEMPRE escrito no <html>, com "light" ou "dark".
 * Deixar o claro como ":root sem atributo" economizava um atributo e custava
 * clareza: com o valor sempre explícito, `document.documentElement.dataset`
 * responde qual tema está no ar sem ninguém precisar deduzir.
 */
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'rapidex-admin.theme';

/** O que vale quando não há escolha guardada NEM preferência do sistema. */
export const FALLBACK_THEME: Theme = 'light';

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

/**
 * O que a pessoa escolheu da última vez, ou null se nunca escolheu.
 *
 * Devolve null em vez do padrão para o chamador conseguir distinguir "quer
 * claro" de "nunca opinou" — é essa distinção que faz o `prefers-color-scheme`
 * ser consultado apenas enquanto ninguém decidiu nada.
 */
export function readStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    // localStorage bloqueado (modo privado, política do navegador): o painel
    // funciona sem lembrar do tema, não é motivo para tela branca.
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Idem: não lembrar é aceitável, quebrar não.
  }
}

/** A preferência declarada no sistema operacional, se o navegador a expõe. */
export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return FALLBACK_THEME;
  }
}

/** A escolha guardada ganha do sistema; o sistema ganha do padrão. */
export function initialTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

/**
 * Escreve o tema no <html>.
 *
 * No <html> e não num wrapper do React porque o fundo da página, a barra de
 * rolagem e o `color-scheme` nativo dos campos leem do elemento raiz.
 */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', theme);
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
