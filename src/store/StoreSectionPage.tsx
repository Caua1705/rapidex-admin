import { useOutletContext } from 'react-router-dom';

import { BranchTab } from './BranchTab';
import { BranchValuesTab } from './BranchValuesTab';
import { DeliveryTab } from './DeliveryTab';
import { GeneralTab } from './GeneralTab';
import { HoursTab } from './HoursTab';
import { OperationTab } from './OperationTab';
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
 *
 * A LINHA AUXILIAR DO CABEÇALHO É O QUE SOBROU DA PAREDE. Onde havia um cartão
 * com título em negrito, um parágrafo explicando o modelo de dados e um botão
 * por filial, hoje há uma frase no mesmo lugar em que Geral já dizia "vale para
 * o restaurante inteiro" — e ela é o par exato daquela: uma diz até onde a
 * configuração alcança, a outra também. Trocar de filial é no seletor do topo,
 * que é onde o lojista já espera, e que agora exibe a filial resolvida.
 *
 * Com uma filial só, `branchLabel` vem vazio e a linha não aparece: não há
 * escolha a fazer, e nomear a única filial seria escrever na tela uma palavra
 * que não distingue nada.
 */
export function StoreSectionPage({ id }: { id: StoreSectionId }) {
  const context = useOutletContext<StoreOutletContext>();
  const secao = STORE_SECTIONS.find((candidate) => candidate.id === id)!;

  const nota =
    secao.scope === 'branch'
      ? context.branchLabel && `vale só para a filial ${context.branchLabel}`
      : secao.nota;

  return (
    <section
      className={`store__section${secao.estreita ? ' store__section--estreita' : ''}`}
      aria-labelledby={`${id}-titulo`}
    >
      <div className="store__section-head">
        <h2 className="t-section" id={`${id}-titulo`}>
          {secao.titulo}
        </h2>
        {nota ? (
          <span className="t-aux" data-testid="store-branch-note">
            {nota}
          </span>
        ) : null}
      </div>

      <Corpo id={id} context={context} />
    </section>
  );
}

function Corpo({ id, context }: { id: StoreSectionId; context: StoreOutletContext }) {
  if (id === 'operacao') return <OperationTab operation={context.operation} />;
  if (id === 'geral') return <GeneralTab settings={context.settings} />;
  if (id === 'valores')
    return (
      <BranchValuesTab
        branchId={context.branchId}
        operation={context.operation}
        settings={context.settings}
      />
    );
  if (id === 'filial') return <BranchTab branchDetail={context.branchDetail} />;
  if (id === 'horarios') return <HoursTab branchId={context.branchId} />;
  if (id === 'entrega') return <DeliveryTab branchDetail={context.branchDetail} />;
  if (id === 'pagamento') return <PaymentMethodsTab branchId={context.branchId} />;
  return <PrintingTab branchId={context.branchId} />;
}
