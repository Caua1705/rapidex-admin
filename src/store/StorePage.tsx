import { useState } from 'react';

import { useSession } from '../auth/session-context';
import { BranchTab } from './BranchTab';
import { DeliveryTab } from './DeliveryTab';
import { GeneralTab } from './GeneralTab';
import { HoursTab } from './HoursTab';
import { PaymentMethodsTab } from './PaymentMethodsTab';
import { PrintingTab } from './PrintingTab';
import { StoreStatusCard } from './StoreStatusCard';
import { useBranchDetail } from './useBranchDetail';
import { useStoreSettings } from './useStoreSettings';
import './StorePage.css';

type TabKey = 'geral' | 'filial' | 'horarios' | 'entrega' | 'pagamento' | 'impressao';

/**
 * As abas, e o que cada uma edita.
 *
 * `scope` não é enfeite: ele diz se a aba mexe no restaurante inteiro ou em UMA
 * filial. As de filial não têm o que editar com "Todas as filiais" escolhida no
 * cabeçalho — não existe id para mandar no PATCH — e é este campo que faz a
 * tela pedir uma filial em vez de mostrar um formulário que não salva.
 */
const TABS: readonly { key: TabKey; label: string; scope: 'restaurant' | 'branch' }[] = [
  { key: 'geral', label: 'Geral', scope: 'restaurant' },
  { key: 'filial', label: 'Filial', scope: 'branch' },
  { key: 'horarios', label: 'Horários', scope: 'branch' },
  { key: 'entrega', label: 'Entrega', scope: 'branch' },
  { key: 'pagamento', label: 'Formas de pagamento', scope: 'branch' },
  { key: 'impressao', label: 'Impressão', scope: 'branch' },
];

export function StorePage() {
  const { branches, activeBranchId, selectBranch } = useSession();
  const [activeTab, setActiveTab] = useState<TabKey>('geral');

  const settings = useStoreSettings();
  // Filial e Entrega salvam pelo MESMO PATCH, então dividem um hook só: duas
  // cópias da filial divergiriam assim que uma das abas gravasse.
  const branchDetail = useBranchDetail(activeBranchId);

  const tab = TABS.find((candidate) => candidate.key === activeTab) ?? TABS[0]!;
  const needsBranch = tab.scope === 'branch' && activeBranchId === '';

  return (
    <div className="store">
      <div className="store__head">
        {/*
          O título é a PRIMEIRA coisa da linha, alinhado com as abas e com o
          primeiro campo do formulário. Antes ele dividia a linha com um cartão
          de status de 60px de altura e ficava centrado nele — ou seja, fora de
          linha com tudo o que vem abaixo.
        */}
        <h1 className="t-title">Minha loja</h1>

        {/*
          Abrir/fechar fica AQUI, na linha do título e fora das abas: é a ação
          mais clicada desta tela e a única com efeito imediato no que o cliente
          vê. Escondida atrás de uma aba, ela vira dois cliques no momento em
          que a cozinha já está afogada.
        */}
        <StoreStatusCard
          isOpen={settings.settings?.is_open !== false}
          isLoading={settings.isLoading}
          isSaving={settings.isTogglingOpen}
          onToggle={(next) => void settings.toggleOpen(next)}
        />
      </div>

      <div className="store__tabs" role="tablist" aria-label="Configurações da loja">
        {TABS.map((candidate) => (
          <button
            key={candidate.key}
            type="button"
            role="tab"
            id={`store-tab-${candidate.key}`}
            aria-selected={candidate.key === activeTab}
            aria-controls={`store-panel-${candidate.key}`}
            className={`store__tab${candidate.key === activeTab ? ' store__tab--active' : ''}`}
            onClick={() => setActiveTab(candidate.key)}
            data-testid={`store-tab-${candidate.key}`}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      <div
        className="store__panel"
        role="tabpanel"
        id={`store-panel-${tab.key}`}
        aria-labelledby={`store-tab-${tab.key}`}
      >
        {needsBranch ? (
          <BranchRequired
            branches={branches.map((branch) => ({
              id: branch.id,
              name: branch.display_name?.trim() || branch.name,
            }))}
            onSelect={selectBranch}
          />
        ) : tab.key === 'geral' ? (
          <GeneralTab settings={settings} />
        ) : tab.key === 'filial' ? (
          <BranchTab branchDetail={branchDetail} />
        ) : tab.key === 'horarios' ? (
          <HoursTab branchId={activeBranchId} />
        ) : tab.key === 'entrega' ? (
          <DeliveryTab branchDetail={branchDetail} />
        ) : tab.key === 'pagamento' ? (
          <PaymentMethodsTab branchId={activeBranchId} />
        ) : (
          <PrintingTab branchId={activeBranchId} />
        )}
      </div>
    </div>
  );
}

/**
 * O estado de "escolha uma filial".
 *
 * "Todas as filiais" é um filtro legítimo no quadro de pedidos, mas aqui ele
 * não tem sentido: endereço, horário, entrega e formas de pagamento são de UMA
 * loja, e salvar "todas" gravaria a mesma coisa em lojas diferentes.
 *
 * Em vez de só avisar, a tela já oferece as filiais como botão — o lojista
 * resolve daqui e não precisa procurar o seletor lá em cima.
 */
function BranchRequired({
  branches,
  onSelect,
}: {
  branches: readonly { id: string; name: string }[];
  onSelect: (branchId: string) => void;
}) {
  return (
    <div className="store__empty" data-testid="store-branch-required">
      <p className="store__empty-title">Escolha uma filial</p>
      <p className="faint">
        Endereço, horários, entrega, formas de pagamento e setores de impressão são de uma filial
        só. Com “Todas as filiais” no topo não há o que editar aqui.
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
