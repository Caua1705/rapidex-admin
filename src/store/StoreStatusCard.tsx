import { Switch } from '../ds/Switch';
import type { BranchOperation } from '../api/types';
import { estaNoAr, situacaoDaFilial } from './operation-state';

/**
 * Abrir e fechar a loja — DESTA FILIAL.
 *
 * Fica no topo de Loja, fora das seções: é a única configuração com
 * efeito imediato no que o cliente vê — loja fechada some do app — e a que o
 * lojista procura com pressa, no fim do expediente ou quando a cozinha não dá
 * conta. Em Operação ele não aparece: lá a mesma filial já tem a própria chave
 * na lista.
 *
 * NÃO É UM CARTÃO. Ele é um controle na linha do título: uma caixa de 60px ali
 * empurrava o título da tela para o meio dela e o desalinhava das abas e do
 * primeiro campo do formulário. O que o destaca é a posição (a primeira linha
 * da tela) e o ponto de cor, não uma moldura.
 *
 * O TEXTO AO LADO DIZ A CONSEQUÊNCIA, NÃO O ESTADO. "Fechada" sozinho não
 * responde a pergunta que o lojista tem na cabeça, que é se ainda está entrando
 * pedido — e são três coisas que decidem isso, não só a chave. A regra de quais
 * mora em `operation-state.ts`, junto com a da linha de Operação; aqui está só
 * a prosa de cada caso, que é mais longa porque este controle está sozinho no
 * alto da tela e não tem uma coluna ao lado explicando.
 */
export function StoreStatusCard({
  operacao,
  isLoading,
  isSaving,
  errorMessage,
  onToggle,
}: {
  /** A linha da filial que o cabeçalho está exibindo. Nula antes de carregar. */
  operacao: BranchOperation | null;
  isLoading: boolean;
  isSaving: boolean;
  /** O que deu errado no último clique. O estado mostrado continua sendo o do backend. */
  errorMessage: string | null;
  onToggle: (next: boolean) => void;
}) {
  const isOpen = operacao?.is_open !== false;
  const noAr = estaNoAr(operacao);

  function hint() {
    if (isLoading) return 'Lendo a situação da loja.';

    switch (situacaoDaFilial(operacao)) {
      case 'fechada':
        return 'Ninguém consegue fazer pedido enquanto estiver assim.';
      case 'fora-do-horario':
        return 'Aberta, mas fora do horário de hoje: só volta a receber pedido no próximo horário cadastrado.';
      case 'sem-forma-de-comprar':
        return 'Aberta, mas sem entrega e sem retirada: ninguém consegue comprar até uma das duas voltar.';
      default:
        return 'O cardápio está no ar e os clientes conseguem fazer pedido.';
    }
  }

  return (
    <div
      className={`store-status${noAr ? ' store-status--open' : ''}`}
      data-testid="store-status"
      data-open={isOpen}
      data-no-ar={noAr}
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
