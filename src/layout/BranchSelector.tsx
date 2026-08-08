import type { Branch } from '../api/types';
import { useSession } from '../auth/session-context';
import { ChevronDownIcon } from '../ui/icons';

/** Endereço em uma linha, pulando o que o backend não mandou. */
export function branchAddressLine(branch: Branch): string {
  return [branch.address, branch.neighborhood, branch.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
}

function branchName(branch: Branch): string {
  return branch.display_name?.trim() || branch.name;
}

/**
 * Qual filial o painel está olhando.
 *
 * Fica no cabeçalho e aparece SEMPRE, mesmo com uma filial só: quem opera duas
 * lojas precisa saber, sem procurar, de qual delas é o pedido na tela. O
 * endereço embaixo do nome é o que separa duas filiais de nome parecido
 * ("Centro" e "Centro II") quando o lojista bate o olho.
 *
 * Com mais de uma filial, um <select> nativo cobre a caixa inteira: ele carrega
 * o teclado, o leitor de tela e o seletor do celular de graça, enquanto o texto
 * empilhado por baixo dá o desenho de duas linhas que um <select> não faz.
 */
export function BranchSelector() {
  const { branches, restaurantLabel, activeBranchId, selectBranch } = useSession();

  const active = branches.find((branch) => branch.id === activeBranchId) ?? null;
  const name = active ? branchName(active) : restaurantLabel;
  const detail = active
    ? branchAddressLine(active)
    : branches.length > 1
      ? `Todas as filiais · ${branches.length}`
      : (branches[0] && branchAddressLine(branches[0])) || '';

  return (
    <div className="branch" data-testid="branch-selector">
      <span className="branch__text">
        <span className="branch__name">{name}</span>
        {detail ? <span className="branch__detail">{detail}</span> : null}
      </span>

      {branches.length > 1 ? (
        <>
          <span className="branch__chevron" aria-hidden="true">
            <ChevronDownIcon size={14} />
          </span>
          <select
            className="branch__select"
            aria-label="Filial"
            value={activeBranchId}
            onChange={(event) => selectBranch(event.target.value)}
          >
            <option value="">Todas as filiais</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branchName(branch)}
              </option>
            ))}
          </select>
        </>
      ) : null}
    </div>
  );
}
