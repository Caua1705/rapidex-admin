import { Switch } from '../ui/Switch';

/**
 * Abrir e fechar a loja.
 *
 * Fica em destaque no topo de Minha loja, fora das abas: é a única
 * configuração com efeito imediato no que o cliente vê — loja fechada some do
 * app — e a que o lojista procura com pressa, no fim do expediente ou quando a
 * cozinha não dá mais conta.
 *
 * O texto ao lado diz a CONSEQUÊNCIA, não o estado. "Fechada" sozinho não
 * responde a pergunta que o lojista tem na cabeça, que é se ainda está entrando
 * pedido.
 */
export function StoreStatusCard({
  isOpen,
  isLoading,
  isSaving,
  onToggle,
}: {
  isOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div
      className={`store-status${isOpen ? ' store-status--open' : ''}`}
      data-testid="store-status"
      data-open={isOpen}
    >
      <span className="store-status__dot" aria-hidden="true" />

      <span className="store-status__text">
        <strong className="store-status__label">
          {isLoading ? 'Carregando…' : isOpen ? 'Loja aberta' : 'Loja fechada'}
        </strong>
        <span className="faint">
          {isLoading
            ? 'Lendo a situação da loja.'
            : isOpen
              ? 'O cardápio está no ar e os clientes conseguem fazer pedido.'
              : 'Ninguém consegue fazer pedido enquanto estiver assim.'}
        </span>
      </span>

      <Switch
        checked={isOpen}
        disabled={isLoading || isSaving}
        onChange={onToggle}
        label={isOpen ? 'Fechar a loja' : 'Abrir a loja'}
      />
    </div>
  );
}
