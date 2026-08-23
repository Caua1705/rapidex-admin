import { Navigate, useOutletContext } from 'react-router-dom';

import { usePermissoes } from '../auth/use-permissions';

import { BranchTab } from './BranchTab';
import { BranchValuesTab } from './BranchValuesTab';
import { BrandTab } from './BrandTab';
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
 * O NOME DA SEÇÃO NÃO MORA MAIS AQUI: ele subiu para a faixa de 52px da tela,
 * como continuação do título ("Minha loja › Horários de funcionamento"). Ver
 * `StoreLayout`. O que restou nesta página é o FORMULÁRIO e a ressalva de
 * escopo — e a seção passa a se nomear por `aria-label`, que diz a mesma coisa
 * sem escrever a palavra duas vezes na mesma tela.
 *
 * A RESSALVA DE ESCOPO — "vale só para a filial X" — também não mora aqui: ela
 * é a continuação do nome da seção e subiu junto com ele. Ver `StoreLayout`.
 *
 * O que sobrou nesta página é o formulário, e só ele.
 */
export function StoreSectionPage({ id }: { id: StoreSectionId }) {
  const context = useOutletContext<StoreOutletContext>();
  const { pode } = usePermissoes();
  const secao = STORE_SECTIONS.find((candidate) => candidate.id === id)!;

  /*
   * A SEGUNDA GUARDA, e ela não é redundante com a lista filtrada ao lado: o
   * endereço continua digitável, e uma aba deixada aberta antes de alguém ser
   * rebaixado volta nesta rota no F5. Sem ela, o formulário monta e a barra de
   * salvar responde 403.
   *
   * O destino é Operação — a seção que todo papel do painel alcança, e para
   * onde /minha-loja já redireciona sozinha.
   */
  if (secao.acao && !pode(secao.acao)) {
    return <Navigate to="/minha-loja/operacao" replace />;
  }

  return (
    <section
      className={`store__section${secao.estreita ? ' store__section--estreita' : ''}`}
      aria-label={secao.titulo}
    >
      <Corpo id={id} context={context} />
    </section>
  );
}

function Corpo({ id, context }: { id: StoreSectionId; context: StoreOutletContext }) {
  if (id === 'operacao') return <OperationTab operation={context.operation} />;
  if (id === 'marca') return <BrandTab />;
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
  if (id === 'entrega')
    return <DeliveryTab branchId={context.branchId} branchDetail={context.branchDetail} />;
  if (id === 'pagamento') return <PaymentMethodsTab branchId={context.branchId} />;
  return <PrintingTab branchId={context.branchId} />;
}
