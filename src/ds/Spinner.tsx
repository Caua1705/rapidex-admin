import './Spinner.css';

/**
 * Indicador de "está acontecendo".
 *
 *   <Spinner />                       // dentro de um botão ou campo ocupado
 *   <Spinner label="Salvando…" />     // quando é a única coisa na tela
 *
 * NÃO É DECORAÇÃO: ele só aparece em estado `loading` de um componente. Um
 * spinner que gira sempre vira papel de parede e deixa de significar espera.
 *
 * Sob `prefers-reduced-motion` o giro para (o reset zera a animação) e quem
 * carrega a informação passa a ser o `aria-busy` do controle e o rótulo — por
 * isso o rótulo existe e não é opcional para o leitor de tela.
 */
export function Spinner({ label }: { label?: string }) {
  return (
    <span className="ds-spinner" role="status" aria-live="polite">
      <span className="ds-spinner__ring" aria-hidden="true" />
      <span className={label ? undefined : 'sr-only'}>{label ?? 'Carregando'}</span>
    </span>
  );
}
