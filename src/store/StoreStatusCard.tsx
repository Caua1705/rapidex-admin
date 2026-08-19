import { Switch } from '../ds/Switch';

/**
 * Abrir e fechar a loja — DESTA FILIAL.
 *
 * Fica no topo de Minha loja, fora das seções: é a única configuração com
 * efeito imediato no que o cliente vê — loja fechada some do app — e a que o
 * lojista procura com pressa, no fim do expediente ou quando a cozinha não dá
 * conta.
 *
 * NÃO É MAIS UM CARTÃO. Ele é um controle na linha do título: uma caixa de
 * 60px ali empurrava o título da tela para o meio dela e o desalinhava das
 * abas e do primeiro campo do formulário. O que o destaca é a posição (a
 * primeira linha da tela) e o ponto de cor, não uma moldura.
 *
 * O texto ao lado diz a CONSEQUÊNCIA, não o estado. "Fechada" sozinho não
 * responde a pergunta que o lojista tem na cabeça, que é se ainda está entrando
 * pedido.
 *
 * POR ISSO ELE PRECISA DE `isOpenNow`. A chave e a agenda são duas coisas, e a
 * chave sozinha não responde a pergunta: com a loja deixada aberta às 23h de um
 * dia que fecha às 22h, "o cardápio está no ar e os clientes conseguem fazer
 * pedido" é mentira — e é o chamado mais comum ("não está entrando pedido").
 * Aberta fora do horário, o ponto de cor não acende: quem olha de longe precisa
 * ver a mesma coisa que o texto diz.
 */
export function StoreStatusCard({
  isOpen,
  isOpenNow,
  isLoading,
  isSaving,
  errorMessage,
  onToggle,
}: {
  /** A chave que o lojista controla. */
  isOpen: boolean;
  /** A chave combinada com a agenda de hoje. `null` enquanto não carregou. */
  isOpenNow: boolean | null;
  isLoading: boolean;
  isSaving: boolean;
  /** O que deu errado no último clique. O estado mostrado continua sendo o do backend. */
  errorMessage: string | null;
  onToggle: (next: boolean) => void;
}) {
  const noAr = isOpen && isOpenNow !== false;

  function hint() {
    if (isLoading) return 'Lendo a situação da loja.';
    if (!isOpen) return 'Ninguém consegue fazer pedido enquanto estiver assim.';
    if (isOpenNow === false)
      return 'Aberta, mas fora do horário de hoje: só volta a receber pedido no próximo horário cadastrado.';
    return 'O cardápio está no ar e os clientes conseguem fazer pedido.';
  }

  return (
    <div
      className={`store-status${noAr ? ' store-status--open' : ''}`}
      data-testid="store-status"
      data-open={isOpen}
      data-open-now={isOpenNow ?? ''}
    >
      <span className="store-status__dot" aria-hidden="true" />

      <strong className="store-status__label">
        {isLoading ? 'Carregando…' : isOpen ? 'Loja aberta' : 'Loja fechada'}
      </strong>

      {/*
        O erro TOMA O LUGAR da consequência, não se soma a ela: com os dois na
        mesma linha, a tela afirmaria que o cardápio está no ar ao lado do aviso
        de que o clique não foi gravado.
      */}
      {errorMessage ? (
        <span className="store-status__hint store-status__hint--error" role="alert">
          {errorMessage}
        </span>
      ) : (
        <span className="store-status__hint">{hint()}</span>
      )}

      <Switch
        hideLabel
        checked={isOpen}
        disabled={isLoading || isSaving}
        onChange={onToggle}
        label={isOpen ? 'Fechar a loja' : 'Abrir a loja'}
      />
    </div>
  );
}
