import { useTheme } from './theme-context';

/**
 * Lua e sol: o botão mostra o tema PARA ONDE vai, não o atual.
 *
 * É a convenção que o lojista já viu em todo lugar, e o rótulo acessível diz a
 * mesma coisa em palavras — o ícone sozinho é ambíguo para quem usa leitor de
 * tela.
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

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}
