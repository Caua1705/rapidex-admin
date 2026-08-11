import { NavLink, Outlet } from 'react-router-dom';

import { useAdoptedBranch } from '../auth/use-branch-scope';
import { StoreStatusCard } from './StoreStatusCard';
import { STORE_SECTIONS } from './store-sections';
import { useBranchDetail } from './useBranchDetail';
import { useStoreSettings } from './useStoreSettings';
import './StorePage.css';

/**
 * MINHA LOJA — UMA SEÇÃO, UMA PÁGINA.
 *
 * A coluna única com âncoras resolveu o problema das seis abas (tudo buscável,
 * o índice dizendo o que existe) e criou o próprio: seis formulários numa
 * página só é rolagem longa, e nenhuma quantidade de âncora grudenta conserta
 * uma página em que o rodapé de uma seção encosta no cabeçalho da seguinte.
 * O recolhimento foi um remendo — ele escondia o problema em vez de resolvê-lo,
 * e cobrava um clique para ver o que já estava carregado.
 *
 * Agora cada seção é uma ROTA (`/minha-loja/entrega`), e a lista da esquerda é
 * navegação de verdade. O que se ganha, além da altura:
 *
 *   - o endereço identifica a tela: dá para mandar "abre /minha-loja/horarios"
 *     para o suporte, e o F5 volta onde estava;
 *   - o botão voltar do navegador funciona entre seções;
 *   - cada página monta só o SEU formulário — a coluna única montava seis, com
 *     seis leituras de API, para mostrar uma.
 *
 * O QUE SE PERDE, e é honesto dizer: o Ctrl+F deixa de varrer a configuração
 * inteira. Em troca, a navegação da esquerda continua listando as seis seções
 * o tempo todo — o mapa não sumiu, só deixou de ser um sumário de rolagem.
 *
 * Os dois hooks compartilhados ficam AQUI e descem pelo contexto do `Outlet`:
 * Filial e Entrega salvam pelo MESMO PATCH, e duas cópias da filial
 * divergiriam assim que uma das páginas gravasse.
 *
 * A FILIAL É RESOLVIDA, NÃO PEDIDA. Cinco destas seis seções gravam por
 * filial, e com "Todas as filiais" no topo elas mostravam a mesma parede
 * ("Horários de funcionamento é de uma filial só. Escolha uma:") — a mesma
 * frase em quatro rotas, que é o defeito de repetição da §8 em escala de tela.
 * Hoje `useAdoptedBranch()` escolhe a principal e o cabeçalho passa a exibi-la;
 * o que sobra na página é uma linha auxiliar dizendo de qual filial é aquele
 * formulário. Ver `auth/branch-scope.ts`.
 */
export type StoreOutletContext = {
  settings: ReturnType<typeof useStoreSettings>;
  branchDetail: ReturnType<typeof useBranchDetail>;
  /** A filial resolvida. Vazia só quando o lojista não enxerga filial nenhuma. */
  branchId: string;
  /** Nome dela, para a linha auxiliar. Vazio quando não há escolha a fazer. */
  branchLabel: string;
};

export function StoreLayout() {
  const { branch, branchId, hasChoice } = useAdoptedBranch();

  const settings = useStoreSettings();
  const branchDetail = useBranchDetail(branchId);

  const context: StoreOutletContext = {
    settings,
    branchDetail,
    branchId,
    branchLabel: hasChoice && branch ? (branch.display_name?.trim() || branch.name) : '',
  };

  return (
    <div className="store">
      {/*
        A NAVEGAÇÃO DA SEÇÃO. Ela não imita a lateral do produto: sem ícone,
        sem caixa, sem plano próprio. A lateral diz em que parte do produto
        você está; isto diz em que parte de UMA tela — dois componentes com o
        mesmo desenho fariam o lojista achar que trocou de seção do painel.
      */}
      <nav className="store__index" aria-label="Seções de Minha loja">
        {/*
          NENHUMA SEÇÃO FICA ATENUADA. As de filial já ficaram, quando abri-las
          sem filial escolhida levava a um bloco que pedia uma — a atenuação era
          o aviso de que o clique não ia dar em nada. Com a filial resolvida na
          entrada, todas as seis abrem no formulário delas, e um item de
          navegação a meio tom passaria a mentir sobre o que vem depois do
          clique.
        */}
        {STORE_SECTIONS.map((secao) => (
          <NavLink
            key={secao.id}
            to={secao.id}
            className={({ isActive }) =>
              `store__anchor${isActive ? ' store__anchor--on' : ''}`
            }
            data-testid={`store-anchor-${secao.id}`}
          >
            {secao.label}
          </NavLink>
        ))}
      </nav>

      <div className="store__col">
        <header className="store__head">
          <h1 className="t-title">Minha loja</h1>

          {/*
            Abrir/fechar fica na linha do título e FORA das páginas: é a ação
            mais clicada desta tela e a única com efeito imediato no que o
            cliente vê. Dentro de uma das seis, ela custaria uma navegação no
            momento em que a cozinha já não dá conta.
          */}
          <StoreStatusCard
            isOpen={settings.settings?.is_open !== false}
            isLoading={settings.isLoading}
            isSaving={settings.isTogglingOpen}
            onToggle={(next) => void settings.toggleOpen(next)}
          />
        </header>

        <Outlet context={context} />
      </div>
    </div>
  );
}
