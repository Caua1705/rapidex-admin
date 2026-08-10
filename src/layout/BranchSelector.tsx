import { Select } from '../ds/Select';
import { useSession } from '../auth/session-context';
import { branchHeading, branchName } from './branch-heading';

/**
 * Qual filial o painel está olhando.
 *
 * Fica no cabeçalho e aparece SEMPRE, mesmo com uma filial só: quem opera duas
 * lojas precisa saber, sem procurar, de qual delas é o pedido na tela. O
 * endereço ao lado do nome é o que separa duas filiais de nome parecido
 * ("Centro" e "Centro II") quando o lojista bate o olho.
 *
 * O NOME NUNCA TRUNCA ANTES DO ENDEREÇO. O desenho anterior deixava os dois
 * disputarem a mesma largura, e quem perdia era o nome: a barra mostrava
 * "Pizzaria do Zé …" ao lado de um endereço inteiro com espaço de sobra. É a
 * prioridade invertida — o endereço existe para desempatar dois nomes, então
 * ele é o que cede.
 */
export function BranchSelector() {
  const { branches, activeBranchId, selectBranch } = useSession();
  const { name, detail } = branchHeading(branches, activeBranchId);

  const display = (
    <span className="branch__text">
      <span className="branch__name">{name}</span>
      {detail ? <span className="branch__detail">{detail}</span> : null}
    </span>
  );

  // Com uma filial só não há o que escolher: o cabeçalho vira texto.
  if (branches.length <= 1) {
    return (
      <div className="branch branch--static" data-testid="branch-selector">
        {display}
      </div>
    );
  }

  return (
    <div className="branch" data-testid="branch-selector">
      <Select
        bare
        display={display}
        value={activeBranchId}
        onChange={selectBranch}
        aria-label="Filial"
        data-testid="branch-select"
        options={[
          { value: '', label: 'Todas as filiais' },
          ...branches.map((branch) => ({ value: branch.id, label: branchName(branch) })),
        ]}
      />
    </div>
  );
}
