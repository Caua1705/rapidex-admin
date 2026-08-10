import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { applyTheme, initialTheme, nextTheme, storeTheme, type Theme } from './theme';
import { ThemeContext } from './theme-context';

/**
 * Mantém o tema no <html> e no localStorage.
 *
 * O estado inicial já lê a escolha guardada (ou, na falta dela, a preferência
 * do sistema), e não um padrão fixo, para não haver um quadro de tema errado
 * entre a montagem e o primeiro efeito. O index.html aplica exatamente a mesma
 * regra antes de o JS do app carregar — os dois leem a mesma chave e chegam ao
 * mesmo resultado.
 *
 * ENQUANTO NINGUÉM ESCOLHEU, o painel acompanha o sistema em tempo real: quem
 * usa o modo automático do celular vê a tela mudar junto com ele ao anoitecer.
 * Depois da primeira escolha, o painel para de escutar — a escolha explícita
 * vale mais que a do sistema.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (chosen) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setTheme(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [chosen]);

  const toggleTheme = useCallback(() => {
    setChosen(true);
    setTheme((current) => {
      const escolhido = nextTheme(current);
      storeTheme(escolhido);
      return escolhido;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
