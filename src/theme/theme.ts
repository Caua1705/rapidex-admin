/**
 * Tema claro/escuro.
 *
 * Escuro é o padrão do design system e continua sendo: o painel fica aberto o
 * turno inteiro, muitas vezes numa tela de cozinha. O claro existe para o
 * balcão perto de janela, onde o escuro vira espelho.
 *
 * Os dois temas saem dos MESMOS tokens semânticos — trocar o tema troca o
 * valor de `--bg-*`, `--text-*`, `--border-*` e das sombras, e nada mais.
 * Nenhuma tela precisa saber qual tema está ativo.
 */
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'rapidex-admin.theme';

export const DEFAULT_THEME: Theme = 'dark';

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

/**
 * O que o lojista escolheu da última vez, ou null se nunca escolheu.
 *
 * Devolve null em vez do padrão para o chamador conseguir distinguir "quer
 * escuro" de "nunca opinou" — a mesma distinção que o script anti-flash do
 * index.html faz.
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

/**
 * Escreve o tema no <html>.
 *
 * No <html> e não num wrapper do React porque o fundo da página, a barra de
 * rolagem e o `color-scheme` nativo dos campos leem do elemento raiz.
 */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // O escuro é o :root sem atributo; deixar `data-theme="dark"` pendurado
    // faria parecer que existem duas paletas quando existe uma só.
    root.removeAttribute('data-theme');
  }
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
