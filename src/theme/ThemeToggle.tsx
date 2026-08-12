import { MoonIcon, SunIcon } from '../ds/icons';
import { useTheme } from './theme-context';

/**
 * Lua e sol: o botão mostra o tema PARA ONDE vai, não o atual.
 *
 * É a convenção que o lojista já viu em todo lugar, e o rótulo acessível diz a
 * mesma coisa em palavras — o ícone sozinho é ambíguo para quem usa leitor de
 * tela.
 *
 * Os dois ícones já foram desenhados aqui dentro, com traço 2. Hoje saem de
 * `ds/icons`, como todo ícone do sistema: um conjunto só, um traço só.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const goingToLight = theme === 'dark';
  const label = goingToLight ? 'Mudar para tema claro' : 'Mudar para tema escuro';

  return (
    <button
      type="button"
      className="btn btn--sm icon-btn"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
    >
      {goingToLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
