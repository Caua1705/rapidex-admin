import { useCallback, useEffect, useState, type ReactNode } from 'react';

import {
  applyTheme,
  DEFAULT_THEME,
  nextTheme,
  readStoredTheme,
  storeTheme,
  type Theme,
} from './theme';
import { ThemeContext } from './theme-context';

/**
 * Mantém o tema escolhido no <html> e no localStorage.
 *
 * O estado inicial já lê o que foi guardado, e não o padrão, para não haver um
 * quadro de tema errado entre a montagem e o primeiro efeito. O index.html
 * aplica o mesmo valor antes do JS do app carregar — os dois leem a mesma
 * chave e chegam ao mesmo resultado.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? DEFAULT_THEME);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const chosen = nextTheme(current);
      storeTheme(chosen);
      return chosen;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
