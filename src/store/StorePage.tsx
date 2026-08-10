import type { ReactNode } from 'react';

import { useSession } from '../auth/session-context';
import { BranchTab } from './BranchTab';
import { DeliveryTab } from './DeliveryTab';
import { GeneralTab } from './GeneralTab';
import { HoursTab } from './HoursTab';
import { PaymentMethodsTab } from './PaymentMethodsTab';
import { PrintingTab } from './PrintingTab';
import { StoreStatusCard } from './StoreStatusCard';
import { useActiveSection } from './useActiveSection';
import { useBranchDetail } from './useBranchDetail';
import { useStoreSettings } from './useStoreSettings';
import './StorePage.css';

/**
 * As seções da tela, na ordem em que a coluna as apresenta.
 *
 * `scope` não é enfeite: ele diz se a seção mexe no restaurante inteiro ou em
 * UMA filial. As de filial não têm o que editar com "Todas as filiais"
 * escolhida no cabeçalho — não existe id para mandar no PATCH — e é este campo
 * que faz a seção pedir uma filial em vez de mostrar um formulário que não
 * salva.
 */
const SECOES: readonly {
  id: string;
  label: string;
  titulo: string;
  nota?: string;
  scope: 'restaurant' | 'branch';
}[] = [
  {
    id: 'geral',
    label: 'Geral',
    titulo: 'Geral',
    nota: 'vale para o restaurante inteiro',
    scope: 'restaurant',
  },
  { id: 'filial', label: 'Filial', titulo: 'Filial', scope: 'branch' },
  { id: 'horarios', label: 'Horários', titulo: 'Horários', scope: 'branch' },
  { id: 'entrega', label: 'Entrega', titulo: 'Entrega', scope: 'branch' },
  { id: 'pagamento', label: 'Pagamento', titulo: 'Formas de pagamento', scope: 'branch' },
  { id: 'impressao', label: 'Impressão', titulo: 'Setores de impressão', scope: 'branch' },
];

/**
 * MINHA LOJA — COLUNA ÚNICA COM ÂNCORAS. As seis abas saíram.
 *
 * POR QUE AS ABAS CAÍRAM: elas escondiam cinco formulários atrás de um clique
 * cada. Conferir o horário e a taxa de entrega — que é a pergunta mais comum
 * desta tela — custava duas trocas de aba e a perda do que já tinha sido lido,
 * porque a aba anterior sai inteira da tela. Uma aba é boa quando os conteúdos
 * são alternativas; aqui eles são PARTES de uma configuração só.
 *
 * O QUE A COLUNA GANHOU DE VERDADE: o índice à esquerda diz quantas seções
 * existem e quais são, o que uma fileira de abas nunca disse (com sete abas,
 * as últimas somem numa rolagem horizontal), e a página inteira é buscável com
 * Ctrl+F — coisa que, com abas, valia só para a aberta.
 *
 * O PREÇO, e ele é real: a página ficou longa. É por isso que o índice é
 * grudento e sabe onde você está (`useActiveSection`) — sem isso, coluna longa
 * vira rolagem cega.
 */
export function StorePage() {
  const { branches, activeBranchId, selectBranch } = useSession();

  const settings = useStoreSettings();
  // Filial e Entrega salvam pelo MESMO PATCH, então dividem um hook só: duas
  // cópias da filial divergiriam assim que uma das seções gravasse.
  const branchDetail = useBranchDetail(activeBranchId);

  const semFilial = activeBranchId === '';

  /*
   * SEM FILIAL, O AVISO É UM SÓ — mas o ÍNDICE CONTINUA INTEIRO.
   *
   * Duas coisas erradas foram descartadas no caminho até aqui:
   *
   *   1. Repetir a caixa "escolha uma filial" dentro de cada uma das cinco
   *      seções de filial. Era a mesma frase cinco vezes na mesma página —
   *      o defeito que a regra da lista proíbe, em escala de seção.
   *   2. Sumir com as cinco âncoras. Resolvia a repetição e criava outra
   *      coisa pior: o índice é o MAPA desta tela, e um mapa que muda de
   *      tamanho conforme o filtro do cabeçalho não é mapa.
   *
   * O que sobrou: as seis âncoras sempre existem; as de filial ficam
   * atenuadas e todas apontam para o MESMO bloco, que diz uma vez o que
   * falta e oferece as filiais como botão.
   */
  const secoesVisiveis = semFilial
    ? SECOES.filter((secao) => secao.scope === 'restaurant')
    : SECOES;

  /** Onde uma âncora de filial leva enquanto não há filial: o bloco do aviso. */
  const ALVO_TRAVADO = 'filial';

  const active = useActiveSection(secoesVisiveis.map((secao) => secao.id));

  const corpo: Record<string, ReactNode> = {
    geral: <GeneralTab settings={settings} />,
    filial: <BranchTab branchDetail={branchDetail} />,
    horarios: <HoursTab branchId={activeBranchId} />,
    entrega: <DeliveryTab branchDetail={branchDetail} />,
    pagamento: <PaymentMethodsTab branchId={activeBranchId} />,
    impressao: <PrintingTab branchId={activeBranchId} />,
  };

  return (
    <div className="store">
      {/*
        O ÍNDICE. Grudento, com a seção que está sendo lida marcada. Ele não é
        navegação do produto — é o sumário desta tela —, e por isso não imita a
        lateral: sem ícone, sem caixa, só a lista e o trilho de brasa.
      */}
      <nav className="store__index" aria-label="Seções de Minha loja">
        {SECOES.map((secao) => {
          const travada = semFilial && secao.scope === 'branch';
          return (
            <a
              key={secao.id}
              href={`#${travada ? ALVO_TRAVADO : secao.id}`}
              className={[
                'store__anchor',
                active === secao.id && !travada ? 'store__anchor--on' : '',
                travada ? 'store__anchor--locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={active === secao.id && !travada ? 'true' : undefined}
              /* Diz POR QUE está atenuada — a cor sozinha não explica nada. */
              title={travada ? 'Depende da filial escolhida no topo' : undefined}
              data-testid={`store-anchor-${secao.id}`}
            >
              {secao.label}
            </a>
          );
        })}
      </nav>

      <div className="store__col">
        <header className="store__head">
          <h1 className="t-title">Minha loja</h1>

          {/*
            Abrir/fechar fica na linha do título: é a ação mais clicada desta
            tela e a única com efeito imediato no que o cliente vê.
          */}
          <StoreStatusCard
            isOpen={settings.settings?.is_open !== false}
            isLoading={settings.isLoading}
            isSaving={settings.isTogglingOpen}
            onToggle={(next) => void settings.toggleOpen(next)}
          />
        </header>

        {secoesVisiveis.map((secao) => (
          <section
            key={secao.id}
            id={secao.id}
            className="store__section"
            aria-labelledby={`${secao.id}-titulo`}
          >
            <div className="store__section-head">
              <h2 className="t-section" id={`${secao.id}-titulo`}>
                {secao.titulo}
              </h2>
              {secao.nota ? <span className="t-aux">{secao.nota}</span> : null}
            </div>

            {corpo[secao.id]}
          </section>
        ))}

        {semFilial ? (
          <BranchRequired
            id={ALVO_TRAVADO}
            faltando={SECOES.filter((secao) => secao.scope === 'branch').map(
              (secao) => secao.titulo,
            )}
            branches={branches.map((branch) => ({
              id: branch.id,
              name: branch.display_name?.trim() || branch.name,
            }))}
            onSelect={selectBranch}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * O que falta, dito UMA vez.
 *
 * "Todas as filiais" é um filtro legítimo no quadro de pedidos, mas aqui não
 * tem sentido: endereço, horário, entrega, formas de pagamento e setores são
 * de UMA loja, e salvar "todas" gravaria a mesma coisa em lojas diferentes.
 *
 * Ele LISTA o que a escolha destrava, em vez de só avisar: sem isso, o lojista
 * não tem como saber que existem mais cinco seções — elas não estão no índice
 * justamente porque ainda não existem. E já oferece as filiais como botão, para
 * a escolha ser feita daqui e não lá em cima.
 */
function BranchRequired({
  id,
  faltando,
  branches,
  onSelect,
}: {
  id: string;
  faltando: readonly string[];
  branches: readonly { id: string; name: string }[];
  onSelect: (branchId: string) => void;
}) {
  return (
    <div className="store__empty" id={id} data-testid="store-branch-required">
      <p className="t-body">
        <strong>Escolha uma filial para configurar o resto.</strong>
      </p>
      <p className="faint">
        {faltando.join(', ')} são de uma filial só — com “Todas as filiais” no topo, não há o que
        editar nelas.
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
