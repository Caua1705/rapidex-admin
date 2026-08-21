import type { ReactNode } from 'react';

import { useSession } from '../auth/session-context';
import { DataTable, type Column } from '../ds/DataTable';
import { PageBar } from '../ds/PageBar';
import { SearchField } from '../ds/SearchField';
import { branchName } from '../layout/branch-heading';
import { formatCurrency, formatDate } from '../orders/format';
import { customerKey, customerName, formatPhone, formatSince } from './customer-model';
import { billableNote, formatAverageTicket } from './customer-segment';
import { SegmentTag } from './SegmentTag';
import { useCustomers } from './useCustomers';
import './CustomersPage.css';

/**
 * ============================================================================
 * CLIENTES — quem já comprou, o que ele vale e se ainda volta
 * ============================================================================
 *
 * Uma rota (`GET /admin/customers`), uma tabela, e nada além do que ela
 * devolve.
 *
 * A PERGUNTA DA TELA MUDOU DE TAMANHO. Ela era "quem comprou, quanto e quando";
 * com a classificação RFV que o backend passou a devolver, ela é "a quem vale a
 * pena chamar de volta". As colunas seguem essa ordem: quem é a pessoa, em que
 * classe ela está, quanto ela vale, e há quanto tempo sumiu.
 *
 * O QUE ESTA TELA NÃO TEM, E POR QUÊ:
 *
 * - **Não filtra por classe.** Não existe `?segment=em_risco` no contrato, e
 *   filtrar o array recebido seria pior do que não filtrar: a classificação é
 *   derivada na leitura, sobre a PÁGINA, então "mostre só os em risco"
 *   devolveria os em risco DAS 50 LINHAS baixadas, com cara de resposta sobre a
 *   base inteira. Essa tela existe no dia em que a fórmula descer para o SQL.
 *
 * - **Não ordena por coluna.** A rota não tem parâmetro de ordenação e a lista
 *   é paginada; ver `useCustomers`. Vale igual para `average_ticket` e para
 *   `segment`, que o contrato diz explicitamente que não ordenam.
 *
 * - **Não abre o cliente.** Não existe `/admin/customers/{id}` no contrato, e
 *   nem haveria id para passar: o agrupamento é por telefone e o item não
 *   carrega um. Uma linha clicável que não leva a lugar nenhum é pior que uma
 *   linha que não convida ao clique.
 *
 * - **Não linka para os pedidos da pessoa.** `GET /admin/orders` busca por
 *   "número do pedido ou parte do NOME do cliente" — não por telefone. Ligar as
 *   duas telas por nome juntaria duas "Ana Paula" numa lista só, e o lojista
 *   leria os pedidos de uma como sendo da outra. Melhor não ter o link do que
 *   tê-lo impreciso.
 *
 * - **Não avisa quem MUDOU de classe.** O rótulo é derivado na leitura: não há
 *   evento, não há histórico e não existe "entrou em risco hoje". Um sino aqui
 *   seria uma promessa que nenhuma rota cumpre.
 *
 * ----------------------------------------------------------------------------
 * O AVISO DE RECORTE, QUE É A PEÇA NOVA E NÃO É DECORATIVA
 * ----------------------------------------------------------------------------
 *
 * A classificação segue o RECORTE DA CONSULTA. Sem `branch_id` ela é do
 * restaurante; com `branch_id`, é daquela loja. O MESMO CLIENTE PODE SER "FIEL"
 * NO RESTAURANTE E "PERDIDO" NA FILIAL, e as duas leituras estão certas: quem
 * pede toda semana no Centro e passou uma vez na Aldeota há seis meses está
 * perdido PARA A ALDEOTA — e é a leitura útil, porque quem chama de volta é uma
 * loja.
 *
 * Sem dizer qual recorte está no ar, isso vira chamado: o lojista troca de
 * filial no topo, vê a mesma pessoa mudar de rótulo e conclui que o painel
 * mente. Por isso o aviso aparece em DOIS lugares, com dois trabalhos
 * diferentes — não é a mesma informação duas vezes:
 *
 *   - na FAIXA, ao lado do título: três palavras dizendo o recorte. A faixa
 *     GRUDA no topo enquanto a lista rola, então na quadragésima linha ele
 *     continua na tela. É a única parte que precisa estar sempre visível.
 *   - na RESSALVA, acima da lista: a explicação, lida uma vez. Ela rola para
 *     fora e tudo bem — ninguém precisa reler que o ritmo é de cada cliente.
 *
 * ANTES ESTA TELA NÃO ESCREVIA ESCOPO NENHUM, com o argumento de que o
 * cabeçalho do shell já dizia a filial. O argumento valia enquanto ela só
 * mostrava FATOS (gastou R$ 748,50, pediu há 3 dias), que são os mesmos em
 * qualquer recorte. Deixou de valer no instante em que ela passou a mostrar um
 * JUÍZO derivado do recorte.
 */
export function CustomersPage() {
  const { branches, activeBranchId } = useSession();
  const customers = useCustomers(activeBranchId);

  /*
   * O RECORTE ATIVO, LIDO DA SESSÃO E NÃO RESOLVIDO.
   *
   * Aqui NÃO se usa `useResolvedBranch()`: aquele hook existe para telas que
   * GRAVAM por filial e precisam de uma quando o lojista não escolheu nenhuma.
   * Esta rota aceita `branch_id` em query e entende vazio como "todas as que eu
   * enxergo" (§4.3 da skill de API) — resolver a principal por baixo faria a
   * tela afirmar "filial Matriz" enquanto pede a lista do restaurante inteiro,
   * que é justamente a mentira de recorte que este bloco existe para evitar.
   *
   * Com UMA filial no escopo não há aviso a dar: "todas" e "a única" são o
   * mesmo recorte, e nomeá-la seria escrever na tela uma palavra que não
   * distingue nada — a mesma regra do `hasChoice` de `use-branch-scope.ts`.
   */
  const filialAtiva = branches.find((branch) => branch.id === activeBranchId) ?? null;
  const recorte =
    branches.length <= 1
      ? null
      : filialAtiva
        ? `da filial ${branchName(filialAtiva)}`
        : 'do restaurante inteiro';

  /*
   * A largura das colunas NÃO vem daqui, e sim de `CustomersPage.css`.
   *
   * A propriedade `width` de `ds/DataTable` existe, mas usá-la significaria
   * escrever "96px" dentro do TSX — e a régua de aderência (`npm run lint`)
   * barra valor em px solto no código de tela, com razão: largura de coluna é
   * medida de conteúdo e o lugar dela é a folha de estilo, junto do resto do
   * enquadramento da tabela.
   */
  const columns: readonly Column<Linha>[] = [
    { key: 'cliente', header: 'Cliente' },
    /*
     * A CLASSE VEM LOGO DEPOIS DO NOME, e não no fim da linha: ela é o que se
     * lê de relance, e o olho já está ali por causa do nome. Depois de quatro
     * colunas de número, ela estaria onde o olho não passa.
     *
     * O cabeçalho é "Classificação", e não o nome da filial. O recorte é prosa
     * em cima da lista pelo mesmo motivo que no Cardápio: "Pizzaria do Zé —
     * Aldeota" numa régua de 132px quebra em duas linhas, engorda o cabeçalho e
     * desalinha todos os outros rótulos do que eles nomeiam.
     */
    { key: 'classe', header: 'Classificação' },
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'total', header: 'Total gasto', align: 'end' },
    { key: 'ticket', header: 'Ticket médio', align: 'end' },
    { key: 'primeiro', header: 'Cliente desde' },
    { key: 'ultimo', header: 'Último pedido' },
  ];

  const rows: Linha[] = customers.customers.map((customer) => {
    /* O denominador do ticket, quando ele precisa ser dito. Ver `billableNote`. */
    const faturaveis = billableNote(customer);

    return {
      id: customerKey(customer),
      cliente: (
        <span className="cliente">
          {/*
          O NOME DA LINHA É 14/550, o MESMO da linha de pedido (`ds/OrderRow`).
          Ele era nível 2 (15/600) — o corpo de um título de seção dentro de uma
          célula de tabela —, e por isso cinquenta nomes empilhados liam como
          cinquenta títulos. Quem identifica a linha é o peso, não o corpo.
        */}
          <span className="cliente__nome">{customerName(customer)}</span>
          {/* Telefone NÃO leva `.tnum`: não é número que se compara em coluna. */}
          <span className="t-aux cliente__fone">{formatPhone(customer.customer_phone)}</span>
        </span>
      ),
      classe: <SegmentTag segment={customer.segment} />,
      /*
       * Contagem não leva `.tnum` (§1): "3 pedidos" é frase com número dentro.
       *
       * É `orders_count`, o TOTAL — cancelados e recusados inclusive. O
       * denominador do ticket médio é outro (`billable_orders_count`) e aparece
       * embaixo DELE, que é onde ele faz falta. Trocar esta coluna pelo faturável
       * faria a tela discordar do detalhe do pedido, que escreve "Cliente há 3
       * meses · 12 pedidos" a partir deste mesmo campo.
       */
      pedidos: customer.orders_count,
      /*
       * Dinheiro, e ele se compara descendo a coluna: `.tnum` + `.num`.
       * `total_spent` já vem como `number` nesta rota (nos relatórios o mesmo
       * tipo de valor vem como string) — `formatCurrency` aceita os dois e é o
       * único lugar que converte. Ele NUNCA somou cancelado, e isso não mudou.
       */
      total: <span className="tnum num">{formatCurrency(customer.total_spent)}</span>,
      /*
       * O TICKET MÉDIO VEM PRONTO DO BACKEND, e não é `total_spent /
       * orders_count` feito aqui. Essa divisão é justamente a que estava errada:
       * ela repartia o gasto por pedidos que nunca viraram dinheiro, e
       * sub-reportava o ticket de quem já cancelou alguma coisa.
       *
       * Embaixo dele, o denominador — só quando os dois contadores divergem, que
       * é quando os três números da linha parecem se contradizer.
       */
      ticket: (
        <span className="ticket">
          <span className="tnum num">{formatAverageTicket(customer)}</span>
          {faturaveis ? <span className="t-aux ticket__nota">{faturaveis}</span> : null}
        </span>
      ),
      /* A data exata: "cliente desde" é uma efeméride, não uma distância. */
      primeiro: <span className="muted">{formatDate(customer.first_order_at)}</span>,
      /*
       * A distância, não a data: a pergunta desta tela é a quem vale a pena
       * chamar de volta, e ela se responde comparando "há 12 dias" com "há 3
       * meses" — não subtraindo cinquenta datas com o dedo na tela.
       *
       * SAI DE `last_order_at`, e não do `days_since_last_order` que o contrato
       * passou a mandar. Não é desprezo pelo campo novo: `formatSince` responde à
       * MESMA pergunta contando dias-calendário no fuso da operação
       * (`America/Fortaleza`), que é o que faz um pedido das 23h de ontem ser
       * "ontem" e não "há 0 dias". Duas fontes para uma frase só é como as duas
       * passam a discordar na virada do dia, sem nada acender.
       */
      ultimo: formatSince(customer.last_order_at),
    };
  });

  const buscando = customers.search.trim() !== '';

  return (
    <div className="customers">
      {/*
        A MESMA FAIXA DE 52px DE TODAS AS TELAS (`ds/PageBar`). Esta tela tinha
        um cabeçalho próprio com título, um parágrafo e, embaixo, um cartão
        branco só para a busca e o contador — três blocos empilhados para uma
        busca e um número. Agora a ferramenta vive na linha do título, como em
        Pedidos, e a lista começa logo abaixo dela.
      */}
      <PageBar
        title="Clientes"
        aside={
          /*
            O RECORTE, GRUDADO NO TÍTULO. `aside` é o slot onde o sistema põe
            ressalva de escopo — é o mesmo que Minha loja usa —, e a faixa é
            grudenta: na quadragésima linha da lista ele continua na tela, que é
            exatamente onde a dúvida aparece.
          */
          recorte ? (
            <span className="t-aux customers__escopo" data-testid="customers-scope">
              classificação {recorte}
            </span>
          ) : null
        }
      >
        <div className="customers__busca">
          <SearchField
            label="Buscar cliente por nome ou telefone"
            placeholder="Nome ou telefone"
            value={customers.searchDraft}
            onValueChange={customers.setSearchDraft}
          />
        </div>

        {/*
          O total é o da LISTA INTEIRA, não o das linhas carregadas — é ele que
          diz que "Carregar mais" ainda tem o que trazer. Some enquanto carrega
          para não afirmar um número que a resposta seguinte desmente.
        */}
        {!customers.isLoading && !customers.errorMessage ? (
          <span className="t-aux customers__total">
            {customers.total === 1 ? '1 cliente' : `${customers.total} clientes`}
          </span>
        ) : null}
      </PageBar>

      <div className="customers__corpo">
        {/*
          A RESSALVA EXISTE PARA DIZER O QUE A TELA NÃO TEM.

          "Cadê o e-mail do cliente?" é a primeira pergunta de quem abre esta
          tela, e a resposta ("é da conta dele na plataforma, não do
          relacionamento com esta loja") não cabe em lugar nenhum da tabela.
          Dita uma vez aqui, ela não vira coluna vazia nem tarja repetida em
          cinquenta linhas. Não é um subtítulo explicando a tela — é a única
          coisa que a tabela não consegue dizer sozinha.
        */}
        <p className="t-aux customers__nota">
          Quem já pediu nesta loja, agrupado por telefone. E-mail e CPF são da conta do cliente na
          plataforma e não aparecem aqui.
        </p>

        {/*
          A SEGUNDA RESSALVA É SOBRE A CLASSIFICAÇÃO, e responde às duas
          perguntas que o contrato do backend avisou que virariam chamado.

          A PRIMEIRA é o recorte: a mesma pessoa muda de rótulo quando o lojista
          troca de filial no topo, e sem esta frase isso lê como defeito.

          A SEGUNDA é o ritmo, que é de CADA CLIENTE e não do restaurante. É por
          isso que dois nomes com o mesmo tempo sem pedir saem com rótulos
          diferentes — e é a pergunta que vem logo depois da primeira.

          Ela é um parágrafo separado, e não uma frase a mais no de cima: aquele
          fala do que a tela NÃO tem, este fala de como se lê o que ela tem.

          Sem escolha de filial (`recorte` nulo), a primeira metade não se aplica
          — restaurante e loja são o mesmo lugar —, mas a segunda continua
          valendo. A frase encolhe em vez de sumir.

          ELA ENCOLHEU DEPOIS DA PRIMEIRA CAPTURA. Eram quatro sentenças, e sete
          linhas de prosa antes da primeira linha da lista é o cabeçalho
          explicativo que a direção tirou de todas as telas voltando pela porta
          dos fundos. O que sobrou é o que muda uma decisão: o recorte, o fato de
          as duas leituras estarem certas, o ritmo ser de cada um, e o que o
          ticket não conta.
        */}
        <p className="t-aux customers__nota" data-testid="customers-nota-rfv">
          {recorte ? (
            <>
              A classificação e o ticket médio são <strong>{recorte}</strong> — o mesmo cliente pode
              ser Fiel no restaurante e Perdido numa loja, e as duas leituras estão certas.{' '}
            </>
          ) : null}
          O ritmo é de cada cliente: quem pede toda semana entra em risco em duas semanas; quem pede
          uma vez por mês, em dois meses. O ticket médio não conta cancelado nem recusado.
        </p>

        {customers.errorMessage ? (
          <p className="alert alert--error customers__alerta" role="alert">
            {customers.errorMessage}
          </p>
        ) : null}

        {customers.isLoading ? (
          <p className="muted customers__estado">Carregando…</p>
        ) : (
          <DataTable
            caption="Clientes que já pediram nesta loja"
            captionHidden
            columns={columns}
            rows={rows}
            empty={
              customers.errorMessage ? null : (
                <p className="muted customers__estado">
                  {buscando
                    ? `Nenhum cliente encontrado para “${customers.search.trim()}”.`
                    : 'Nenhum cliente ainda. Eles aparecem aqui depois do primeiro pedido.'}
                </p>
              )
            }
          />
        )}

        {customers.hasMore ? (
          <div className="customers__rodape">
            <button
              type="button"
              className="btn"
              onClick={() => void customers.loadMore()}
              disabled={customers.isLoadingMore}
            >
              {customers.isLoadingMore ? 'Carregando…' : 'Carregar mais'}
            </button>
            <span className="t-aux">
              <span className="tnum">{customers.customers.length}</span> de{' '}
              <span className="tnum">{customers.total}</span>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Uma linha da tabela. `id` é o telefone — ver `customerKey`. */
type Linha = {
  id: string;
  cliente: ReactNode;
  classe: ReactNode;
  pedidos: number;
  total: ReactNode;
  ticket: ReactNode;
  primeiro: ReactNode;
  ultimo: string;
};
