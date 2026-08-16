import type { ReactNode } from 'react';

import { useSession } from '../auth/session-context';
import { DataTable, type Column } from '../ds/DataTable';
import { SearchField } from '../ds/SearchField';
import { formatCurrency, formatDate } from '../orders/format';
import { customerKey, customerName, formatPhone, formatSince } from './customer-model';
import { useCustomers } from './useCustomers';
import './CustomersPage.css';

/**
 * ============================================================================
 * CLIENTES — quem já comprou, há quanto tempo e quanto gastou
 * ============================================================================
 *
 * Uma rota (`GET /admin/customers`), uma tabela, e nada além do que ela
 * devolve.
 *
 * O QUE ESTA TELA NÃO TEM, E POR QUÊ:
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
 * - **Não ordena por coluna.** A rota não tem parâmetro de ordenação e a lista
 *   é paginada; ver `useCustomers`.
 *
 * O SELETOR DE FILIAL DO TOPO FUNCIONA AQUI de verdade — a rota aceita
 * `branch_id` em query, e vazio significa "todas as filiais que eu enxergo".
 * Por isso esta tela não escreve nenhum aviso de escopo: o cabeçalho já diz
 * qual recorte está no ar, e repeti-lo seria a mesma informação duas vezes.
 */
export function CustomersPage() {
  const { activeBranchId } = useSession();
  const customers = useCustomers(activeBranchId);

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
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'total', header: 'Total gasto', align: 'end' },
    { key: 'primeiro', header: 'Cliente desde' },
    { key: 'ultimo', header: 'Último pedido' },
  ];

  const rows: Linha[] = customers.customers.map((customer) => ({
    id: customerKey(customer),
    cliente: (
      <span className="cliente">
        {/* Nível 2: nome de item de lista — o que a pessoa veio procurar. */}
        <span className="t-section cliente__nome">{customerName(customer)}</span>
        {/* Telefone NÃO leva `.tnum`: não é número que se compara em coluna. */}
        <span className="t-aux cliente__fone">{formatPhone(customer.customer_phone)}</span>
      </span>
    ),
    /* Contagem não leva `.tnum` (§1): "3 pedidos" é frase com número dentro. */
    pedidos: customer.orders_count,
    /*
     * Dinheiro, e ele se compara descendo a coluna: `.tnum` + `.num`.
     * `total_spent` já vem como `number` nesta rota (nos relatórios o mesmo
     * tipo de valor vem como string) — `formatCurrency` aceita os dois e é o
     * único lugar que converte.
     */
    total: <span className="tnum num">{formatCurrency(customer.total_spent)}</span>,
    /* A data exata: "cliente desde" é uma efeméride, não uma distância. */
    primeiro: <span className="muted">{formatDate(customer.first_order_at)}</span>,
    /*
     * A distância, não a data: a pergunta desta tela é a quem vale a pena
     * chamar de volta, e ela se responde comparando "há 12 dias" com "há 3
     * meses" — não subtraindo cinquenta datas com o dedo na tela.
     */
    ultimo: formatSince(customer.last_order_at),
  }));

  const buscando = customers.search.trim() !== '';

  return (
    <div className="customers">
      <header className="customers__head">
        <h1 className="t-title">Clientes</h1>
        <p className="t-aux customers__nota">
          Quem já pediu nesta loja, agrupado por telefone. E-mail e CPF são da conta do cliente na
          plataforma e não aparecem aqui.
        </p>
      </header>

      <div className="customers__bar">
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
      </div>

      {customers.errorMessage ? (
        <p className="alert alert--error customers__alerta" role="alert">
          {customers.errorMessage}
        </p>
      ) : null}

      <div className="customers__lista">
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
              {customers.customers.length} de {customers.total}
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
  pedidos: number;
  total: ReactNode;
  primeiro: ReactNode;
  ultimo: string;
};
