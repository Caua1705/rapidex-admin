import './Switch.css';

/**
 * Interruptor de dois estados.
 *
 * `role="switch"` e não checkbox: o leitor de tela anuncia "ligado/desligado",
 * que é o que o controle significa, e o clique não precisa de um <label>
 * pareado — no toque, a área do controle inteira responde.
 *
 * A única animação é o botão deslizando: ela É a mudança de estado. Sob
 * `prefers-reduced-motion` o token de duração vai a zero e a troca fica
 * instantânea, nunca invisível.
 */
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /**
   * Rótulo acessível: o interruptor sozinho não diz do que ele é. É também
   * como os testes o encontram — `getByRole('switch', { name })` — em vez de um
   * data-testid, que o design system não declara entre as props de <Switch>.
   */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__knob" aria-hidden="true" />
    </button>
  );
}
