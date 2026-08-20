import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { PageBar } from '../ds/PageBar';

import { useAdoptedBranch } from '../auth/use-branch-scope';
import { StoreStatusCard } from './StoreStatusCard';
import { STORE_SECTIONS } from './store-sections';
import { useBranchDetail } from './useBranchDetail';
import { useBranchOperation } from './useBranchOperation';
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
  /**
   * O estado do dia de TODAS as filiais — a lista, não a adotada.
   *
   * Mora aqui, e não dentro da página de Operação, porque o interruptor do
   * cabeçalho lê a mesma coisa: duas cópias divergiriam no instante em que uma
   * das duas gravasse.
   */
  operation: ReturnType<typeof useBranchOperation>;
  /** A filial resolvida. Vazia só quando o lojista não enxerga filial nenhuma. */
  branchId: string;
  /** Nome dela, para a linha auxiliar. Vazio quando não há escolha a fazer. */
  branchLabel: string;
};

export function StoreLayout() {
  /*
   * OPERAÇÃO É A ÚNICA SEÇÃO QUE NÃO ADOTA FILIAL. Ela mostra todas, e adotar
   * uma faria o cabeçalho dizer "Matriz Aldeota" em cima de uma lista com as
   * cinco lojas. É também por isso que o interruptor do cabeçalho some lá: a
   * chave daquela filial já está na lista, uma linha abaixo.
   */
  const rota = useLocation().pathname.replace(/\/+$/, '');
  const emOperacao = rota.endsWith('/operacao');
  /*
   * O NOME DA SEÇÃO ABERTA SOBE PARA A FAIXA, como continuação do título.
   *
   * Ele morava dentro da página, em `StoreSectionPage`, a um bloco de distância
   * de "Minha loja" — dois títulos empilhados para dizer um lugar só. Na faixa
   * ele lê como o que é: "Minha loja › Horários de funcionamento".
   */
  const secaoAberta = STORE_SECTIONS.find((secao) => rota.endsWith(`/${secao.id}`));
  const { branch, branchId, hasChoice } = useAdoptedBranch(!emOperacao);
  const mostrarInterruptor = !emOperacao;

  const settings = useStoreSettings();
  const branchDetail = useBranchDetail(branchId);
  /*
   * Abrir/fechar é da FILIAL, e por isso não sai mais de `useStoreSettings`:
   * `is_open` deixou de existir nas configurações do restaurante.
   *
   * A LEITURA É DE TODAS AS FILIAIS, não da adotada: a página de Operação
   * precisa das cinco lojas na tela, e o interruptor do cabeçalho pega a linha
   * da filial que o seletor está exibindo dessa mesma lista. Uma chamada.
   */
  const operation = useBranchOperation('');

  /** Nome da filial adotada, para a ressalva de escopo. Vazio sem escolha. */
  const branchLabel = hasChoice && branch ? branch.display_name?.trim() || branch.name : '';

  /*
   * A RESSALVA DE ESCOPO VIVE COM O NOME DA SEÇÃO, e não solta no alto do
   * formulário.
   *
   * Ela é um FRAGMENTO de propósito — "vale para o restaurante inteiro" —
   * porque foi escrita para continuar o nome da seção: "Geral · vale para o
   * restaurante inteiro". Quando o nome subiu para a faixa e ela ficou para
   * trás, virou uma frase sem sujeito começando em minúscula no topo da
   * coluna. Ou ela vira uma sentença inteira, ou ela sobe junto — e subir
   * junto é o que mantém a leitura que ela sempre teve.
   *
   * Com uma filial só, `branchLabel` vem vazio e a linha não aparece: não há
   * escolha a fazer, e nomear a única filial seria escrever na tela uma palavra
   * que não distingue nada.
   */
  const escopo =
    secaoAberta?.scope === 'branch'
      ? branchLabel && `vale só para a filial ${branchLabel}`
      : secaoAberta?.nota;

  const context: StoreOutletContext = {
    settings,
    branchDetail,
    operation,
    branchId,
    branchLabel,
  };

  return (
    <div className="store">
      {/*
        A FAIXA DE 52px DO SISTEMA. O interruptor de abrir/fechar vive nela, à
        direita, como qualquer ferramenta de tela.

        ELE FECHA UMA FILIAL, a que o cabeçalho está mostrando — não a rede. É
        por isso que o cabeçalho exibir a filial adotada deixou de ser só uma
        cortesia: sem ele, o interruptor não diria o que está fechando.

        E ELE NÃO APARECE EM OPERAÇÃO. Lá a mesma filial já tem a própria chave
        na lista, e a mesma informação duas vezes na mesma tela faria o lojista
        ver dois interruptores para uma loja e ter que descobrir sozinho que são
        o mesmo.
      */}
      <PageBar
        title="Minha loja"
        crumb={secaoAberta?.titulo}
        aside={
          escopo ? (
            <span className="t-aux store__escopo" data-testid="store-branch-note">
              {escopo}
            </span>
          ) : null
        }
      >
        {mostrarInterruptor ? (
          <StoreStatusCard
            operacao={operation.branchOf(branchId)}
            isLoading={operation.isLoading}
            isSaving={operation.isSaving(branchId, 'is_open')}
            errorMessage={operation.errorFor(branchId)}
            onToggle={(next) => void operation.toggle(branchId, 'is_open', next)}
          />
        ) : null}
      </PageBar>

      <div className="store__body">
        {/*
          A NAVEGAÇÃO DA SEÇÃO. Ela é uma COLUNA separada por um fio, como a de
          categorias no Cardápio — a mesma peça, o mesmo desenho. Sem ícone e
          sem plano próprio: a lateral do painel diz em que parte do PRODUTO
          você está; isto diz em que parte de UMA tela.
        */}
        <nav className="store__index" aria-label="Seções de Minha loja">
          {/*
            NENHUMA SEÇÃO FICA ATENUADA. As de filial já ficaram, quando abri-las
            sem filial escolhida levava a um bloco que pedia uma — a atenuação era
            o aviso de que o clique não ia dar em nada. Com a filial resolvida na
            entrada, todas as oito abrem no formulário delas, e um item de
            navegação a meio tom passaria a mentir sobre o que vem depois do
            clique.
          */}
          {STORE_SECTIONS.map((secao) => (
            <NavLink
              key={secao.id}
              to={secao.id}
              className={({ isActive }) => `store__anchor${isActive ? ' store__anchor--on' : ''}`}
              data-testid={`store-anchor-${secao.id}`}
            >
              {secao.label}
            </NavLink>
          ))}
        </nav>

        <div className="store__col">
          <Outlet context={context} />
        </div>
      </div>
    </div>
  );
}
