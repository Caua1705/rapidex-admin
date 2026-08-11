import { useOutletContext } from 'react-router-dom';

import { BranchTab } from './BranchTab';
import { DeliveryTab } from './DeliveryTab';
import { GeneralTab } from './GeneralTab';
import { HoursTab } from './HoursTab';
import { PaymentMethodsTab } from './PaymentMethodsTab';
import { PrintingTab } from './PrintingTab';
import { STORE_SECTIONS, type StoreSectionId } from './store-sections';
import type { StoreOutletContext } from './StoreLayout';

/**
 * Uma página de Minha loja: o título da seção e o formulário dela.
 *
 * O corpo é montado SÓ para a seção aberta. A coluna única montava os seis ao
 * mesmo tempo — seis formulários com estado sujo próprio e seis leituras de
 * API para mostrar um.
 */
export function StoreSectionPage({ id }: { id: StoreSectionId }) {
  const context = useOutletContext<StoreOutletContext>();
  const secao = STORE_SECTIONS.find((candidate) => candidate.id === id)!;
  const semFilial = context.activeBranchId === '';

  return (
    <section className="store__section" aria-labelledby={`${id}-titulo`}>
      <div className="store__section-head">
        <h2 className="t-section" id={`${id}-titulo`}>
          {secao.titulo}
        </h2>
        {secao.nota ? <span className="t-aux">{secao.nota}</span> : null}
      </div>

      {secao.scope === 'branch' && semFilial ? (
        <BranchRequired
          titulo={secao.titulo}
          branches={context.branches}
          onSelect={context.selectBranch}
        />
      ) : (
        <Corpo id={id} context={context} />
      )}
    </section>
  );
}

function Corpo({ id, context }: { id: StoreSectionId; context: StoreOutletContext }) {
  if (id === 'geral') return <GeneralTab settings={context.settings} />;
  if (id === 'filial') return <BranchTab branchDetail={context.branchDetail} />;
  if (id === 'horarios') return <HoursTab branchId={context.activeBranchId} />;
  if (id === 'entrega') return <DeliveryTab branchDetail={context.branchDetail} />;
  if (id === 'pagamento') return <PaymentMethodsTab branchId={context.activeBranchId} />;
  return <PrintingTab branchId={context.activeBranchId} />;
}

/**
 * O que falta, na página que precisa dele.
 *
 * "Todas as filiais" é um filtro legítimo no quadro de pedidos, mas aqui não
 * tem sentido: endereço, horário, entrega, formas de pagamento e setores são
 * de UMA loja, e salvar "todas" gravaria a mesma coisa em lojas diferentes.
 *
 * Ele nomeia a seção em que está — com uma página por seção, "esta seção" não
 * seria ambíguo, mas nomear é o que faz a frase servir também para quem chegou
 * pelo endereço direto. E já oferece as filiais como botão, para a escolha ser
 * feita daqui e não lá no topo.
 */
function BranchRequired({
  titulo,
  branches,
  onSelect,
}: {
  titulo: string;
  branches: readonly { id: string; name: string }[];
  onSelect: (branchId: string) => void;
}) {
  return (
    <div className="store__empty" data-testid="store-branch-required">
      <p className="t-body">
        <strong>{titulo} é de uma filial só.</strong>
      </p>
      <p className="faint">
        Com “Todas as filiais” escolhida no topo não há o que editar aqui — o mesmo valor iria para
        lojas diferentes. Escolha uma:
      </p>
      <div className="store__empty-actions">
        {branches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            className="btn"
            onClick={() => onSelect(branch.id)}
            data-testid={`store-pick-branch-${branch.id}`}
          >
            {branch.name}
          </button>
        ))}
      </div>
    </div>
  );
}
