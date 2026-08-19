import { Switch } from '../ds/Switch';
import type { BranchOperation } from '../api/types';
import type { useBranchOperation } from './useBranchOperation';

/**
 * O ESTADO DO DIA, UMA LINHA POR FILIAL.
 *
 * Enquanto `is_open` era do restaurante, esta tela era um interruptor: fechar
 * a loja do Centro fechava a da Aldeota junto, e a pergunta "quais das minhas
 * lojas estão no ar agora?" não tinha onde ser respondida. É a conferência que
 * a tela existe para dar, e é por isso que o interruptor do cabeçalho não
 * bastava: ele opera UMA filial, a que o seletor está exibindo.
 *
 * Quem está preso a uma filial recebe uma lista de um item — a mesma tela serve
 * aos dois casos sem conhecer a regra de escopo, que mora no token.
 *
 * O QUE CADA LINHA ESCREVE, E O QUE ELA CALA. A chave já diz aberta ou
 * fechada, e o ponto repete isso de longe; escrever "aberta" ao lado de um
 * interruptor ligado é a palavra que se repete em toda linha sem distinguir
 * nada. Sobra UM caso, e é o que ninguém adivinha: a chave ligada com a agenda
 * de hoje fechada. Aí a linha fala, porque a tela estaria mentindo se calasse.
 */
export function OperationTab({ operation }: { operation: ReturnType<typeof useBranchOperation> }) {
  if (operation.isLoading) return <p className="muted store__loading">Carregando as filiais…</p>;

  if (operation.loadError)
    return (
      <p className="alert alert--error" role="alert">
        {operation.loadError}
      </p>
    );

  const linhas = operation.branches ?? [];

  if (linhas.length === 0)
    return <p className="muted store__loading">Nenhuma filial ativa para operar.</p>;

  return (
    <ul className="op-list" data-testid="operation-list">
      {linhas.map((linha) => (
        <OperationRow
          key={linha.branch_id}
          linha={linha}
          isSaving={operation.isSaving(linha.branch_id)}
          errorMessage={operation.errorFor(linha.branch_id)}
          onToggle={(next) => void operation.toggleOpen(linha.branch_id, next)}
        />
      ))}
    </ul>
  );
}

function OperationRow({
  linha,
  isSaving,
  errorMessage,
  onToggle,
}: {
  linha: BranchOperation;
  isSaving: boolean;
  errorMessage: string | null;
  onToggle: (next: boolean) => void;
}) {
  // Aberta e fora do horário não é "no ar": o ponto de cor precisa dizer o
  // mesmo que o texto, senão quem olha de longe lê o contrário de quem lê.
  const noAr = linha.is_open && linha.is_open_now;

  return (
    <li
      className={`op-row${noAr ? ' op-row--on' : ''}`}
      data-testid={`operation-row-${linha.branch_id}`}
      data-open={linha.is_open}
      data-open-now={linha.is_open_now}
    >
      <span className="op-row__dot" aria-hidden="true" />

      <span className="op-row__name">{linha.branch_name}</span>

      {errorMessage ? (
        <span className="op-row__note op-row__note--error" role="alert">
          {errorMessage}
        </span>
      ) : (
        <span className="op-row__note">
          {linha.is_open && !linha.is_open_now ? 'Fora do horário de hoje' : ''}
        </span>
      )}

      <Switch
        hideLabel
        checked={linha.is_open}
        loading={isSaving}
        onChange={onToggle}
        label={
          linha.is_open
            ? `Fechar a filial ${linha.branch_name}`
            : `Abrir a filial ${linha.branch_name}`
        }
      />
    </li>
  );
}
