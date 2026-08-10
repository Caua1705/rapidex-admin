import './Switch.css';

/**
 * Interruptor de dois estados.
 *
 * `role="switch"` e não checkbox: o leitor de tela anuncia "ligado/desligado",
 * que é o que o controle significa, e o clique não precisa de um <label>
 * pareado — no toque, a área do controle inteira responde.
 *
 * O DESENHO É MENOR QUE O ALVO. O trilho tem 28×16 porque o interruptor indica
 * estado e não é a ação principal da página — num cardápio de sessenta itens,
 * um por linha, o tamanho anterior fazia dele o elemento mais pesado da lista.
 * O botão em volta continua com o alvo inteiro (WCAG 2.5.8): quem encolheu foi
 * a tinta, não a área que o dedo precisa acertar.
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
      <span className="switch__track" aria-hidden="true">
        <span className="switch__knob" />
      </span>
    </button>
  );
}
