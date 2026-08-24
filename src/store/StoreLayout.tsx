import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { PageBar } from '../ds/PageBar';
import { useKeepActiveInView } from '../ds/useKeepActiveInView';

import { useAdoptedBranch } from '../auth/use-branch-scope';
import { usePermissoes } from '../auth/use-permissions';
import { StoreStatusCard } from './StoreStatusCard';
import { STORE_SECTIONS, type StoreSection } from './store-sections';
import { useBranchDetail } from './useBranchDetail';
import { useBranchOperation } from './useBranchOperation';
import { useStoreSettings } from './useStoreSettings';
import './StorePage.css';

/**
 * LOJA — UMA SEÇÃO, UMA PÁGINA.
 *
 * A coluna única com âncoras resolveu o problema das seis abas (tudo buscável,
 * o índice dizendo o que existe) e criou o próprio: seis formulários numa
 * página só é rolagem longa, e nenhuma quantidade de âncora grudenta conserta
 * uma página em que o rodapé de uma seção encosta no cabeçalho da seguinte.
 * O recolhimento foi um remendo — ele escondia o problema em vez de resolvê-lo,
 * e cobrava um clique para ver o que já estava carregado.
 *
 * Agora cada seção é uma ROTA (`/loja/entrega`), e a lista da esquerda é
 * navegação de verdade. O que se ganha, além da altura:
 *
 *   - o endereço identifica a tela: dá para mandar "abre /loja/horarios"
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
  /**
   * As seções que ESTE papel alcança — a mesma lista que desenha a coluna.
   *
   * Ela desce pelo contexto porque `StoreIndexPage` a renderiza de novo, em
   * outro desenho, no telefone. Refiltrar lá dentro seria a segunda expressão
   * da mesma regra, e as duas divergiriam na primeira seção nova.
   */
  secoes: readonly StoreSection[];
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
   * de "Loja" — dois títulos empilhados para dizer um lugar só. Na faixa
   * ele lê como o que é: "Loja › Horários de funcionamento".
   */
  const secaoAberta = STORE_SECTIONS.find((secao) => rota.endsWith(`/${secao.id}`));
  /*
   * NO TELEFONE ESTA COLUNA VIRA UMA FITA HORIZONTAL de oito seções que
   * transborda 271px. Ela nascia em zero, então quem abria Impressão ou
   * Pagamento via cinco OUTRAS seções e nenhuma marcada — a única pista de
   * "onde estou" era a migalha na faixa do topo.
   */
  const { fitaRef, ativoRef } = useKeepActiveInView<HTMLElement>(secaoAberta?.id ?? null);
  const { pode } = usePermissoes();
  /*
   * AS SEÇÕES QUE ESTE PAPEL ALCANÇA.
   *
   * Seção de Loja é formulário mais barra de salvar: sem a escrita, o que
   * sobraria é um formulário que aceita digitação e nunca grava — pior do que
   * não estar lá. Operação e Impressão continuam para todo mundo; o que é da
   * gerência dentro delas é escondido controle a controle.
   */
  const secoes = STORE_SECTIONS.filter((secao) => !secao.acao || pode(secao.acao));
  /*
   * NO ÍNDICE NÃO SE ADOTA FILIAL, e o motivo é o mesmo de Operação: `/loja`
   * sem seção aberta é a LISTA das nove (no telefone) ou um redirecionamento
   * (no desktop). Adotar ali faria o cabeçalho passar a dizer "Matriz Aldeota"
   * em cima de uma lista que não é de filial nenhuma — e faria isso no instante
   * em que o lojista tocasse "Mais › Loja", sem ele ter pedido nada.
   */
  const emSecao = secaoAberta !== undefined;
  const { branch, branchId, hasChoice } = useAdoptedBranch(emSecao && !emOperacao);
  const mostrarInterruptor = emSecao && !emOperacao;

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
    secoes,
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
        /*
          "LOJA", E NÃO MAIS "MINHA LOJA". O possessivo singular é o que mente
          num restaurante com duas filiais: "minha loja" promete uma. Quem diz
          de qual filial é o formulário continua sendo a ressalva de escopo ao
          lado, que é onde essa informação sempre esteve certa. Ver `nav.ts`.
        */
        title="Loja"
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
        <nav className="store__index" aria-label="Seções da loja" ref={fitaRef}>
          {/*
            NENHUMA SEÇÃO FICA ATENUADA. As de filial já ficaram, quando abri-las
            sem filial escolhida levava a um bloco que pedia uma — a atenuação era
            o aviso de que o clique não ia dar em nada. Com a filial resolvida na
            entrada, todas as oito abrem no formulário delas, e um item de
            navegação a meio tom passaria a mentir sobre o que vem depois do
            clique.
          */}
          {secoes.map((secao) => (
            <NavLink
              key={secao.id}
              to={secao.id}
              className={({ isActive }) => `store__anchor${isActive ? ' store__anchor--on' : ''}`}
              /* Ver `useKeepActiveInView`: no telefone esta coluna é uma fita, e
                 a seção aberta pode ser a oitava. Ref de função porque o alvo é
                 um `<a>` e o hook guarda um `HTMLElement` qualquer. */
              ref={(el) => {
                if (secao.id === secaoAberta?.id) ativoRef.current = el;
              }}
              data-testid={`store-anchor-${secao.id}`}
            >
              {secao.label}
            </NavLink>
          ))}
        </nav>

        <div className="store__col">
          {/*
            A VOLTA PARA A LISTA, e ela só existe onde a lista é uma PÁGINA.

            Abaixo de 720px a coluna de seções sai da tela (ver `StorePage.css`)
            e o índice vira a tela `/loja`. Uma seção aberta sem caminho de
            volta visível é a definição de beco: o gesto de voltar do aparelho
            existe, mas ele não é uma AFIRMAÇÃO de que há para onde voltar.

            Acima de 720px ela não aparece, e não porque estorve: a coluna à
            esquerda já está aberta com as nove seções, e um "todas as seções"
            ao lado de uma lista de todas as seções é a mesma informação duas
            vezes. É a regra do shell — a informação não some, ela troca de
            lugar.
          */}
          {emSecao ? (
            <NavLink to="/loja" end className="store__voltar" data-testid="store-voltar">
              <span aria-hidden="true">‹</span> Todas as seções
            </NavLink>
          ) : null}

          <Outlet context={context} />
        </div>
      </div>
    </div>
  );
}
