import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import type { OrderListItem } from '../api/types';
import { OrderLine } from './OrderLine';

function orderFixture(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'ordem-1',
    order_number: 137,
    branch_id: 'filial-1',
    customer_name_snapshot: 'Maria Souza',
    customer_phone_snapshot: '85999990000',
    order_type: 'delivery',
    status: 'pending',
    payment_method: 'pix',
    payment_status: 'paid',
    total: 42.5,
    created_at: '2026-08-07T18:00:00Z',
    ...overrides,
  };
}

describe('OrderLine', () => {
  it('mostra os dados que o lojista usa para decidir', () => {
    render(
      <OrderLine
        order={orderFixture()}
        stageLabel="Em preparo"
        isSelected={false}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText('#137')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Entrega')).toBeInTheDocument();
    expect(screen.getByText('Pix')).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument(); // fuso da operação
    expect(screen.getByText(/42,50/)).toBeInTheDocument();
  });

  // O requisito mais importante da tela: a cozinha não pode preparar antes de
  // o pagamento online entrar.
  it('destaca pedido com pagamento online ainda não pago', () => {
    render(
      <OrderLine
        order={orderFixture({ payment_status: 'pending' })}
        stageLabel="Novos"
        isSelected={false}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText(/não preparar/i)).toBeInTheDocument();
    /*
      A LINHA É UMA SÓ NO SISTEMA, e o modificador de alerta é o dela — da
      LINHA, não do botão de abrir que mora dentro dela. `order-card-137`
      identifica o botão (é ele que se clica); quem carrega a régua, o fio do
      estágio e o alerta é a `.ds-row` em volta. Ver o cabeçalho de
      `ds/OrderRow`: a linha deixou de ser um `<button>` para que o avanço
      pudesse ser irmão dele em vez de filho.
    */
    const linha = screen.getByTestId('order-card-137').closest('.ds-row');
    expect(linha?.className).toContain('ds-row--alerta');
  });

  it('não destaca pedido pago nem pedido pago na entrega', () => {
    const { rerender } = render(
      <OrderLine
        order={orderFixture()}
        stageLabel="Em preparo"
        isSelected={false}
        onOpen={() => {}}
      />,
    );
    expect(screen.queryByText(/não preparar/i)).not.toBeInTheDocument();

    rerender(
      <OrderLine
        order={orderFixture({ payment_status: 'on_delivery', payment_method: 'cash' })}
        stageLabel="Novos"
        isSelected={false}
        onOpen={() => {}}
      />,
    );
    expect(screen.queryByText(/não preparar/i)).not.toBeInTheDocument();
    expect(screen.getByText('Paga na entrega')).toBeInTheDocument();
  });

  it('abre o detalhe ao clicar', async () => {
    const onOpen = vi.fn();
    render(
      <OrderLine
        order={orderFixture()}
        stageLabel="Em preparo"
        isSelected={false}
        onOpen={onOpen}
      />,
    );

    await userEvent.click(screen.getByTestId('order-card-137'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  /*
   * ============================================================================
   * O AVANÇO NA PRÓPRIA LINHA
   * ============================================================================
   *
   * Ele existe para poupar o desvio pelo painel de tela cheia no celular, que
   * custava quatro toques na ação mais frequente do turno. O que estes testes
   * prendem é o que não pode variar: QUAL avanço aparece em cada estágio, e —
   * mais importante — QUANDO ele não pode aparecer.
   */
  it('oferece o avanço do estágio na linha, com o verbo curto', () => {
    const { rerender } = render(
      <OrderLine
        order={orderFixture({ status: 'pending' })}
        stageLabel="Novos"
        isSelected={false}
        onOpen={() => {}}
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByTestId('row-advance-137')).toHaveTextContent('Aceitar');

    rerender(
      <OrderLine
        order={orderFixture({ status: 'accepted' })}
        stageLabel="Aceito"
        isSelected={false}
        onOpen={() => {}}
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByTestId('row-advance-137')).toHaveTextContent('Preparar');

    // De "pronto" quem escolhe é a MODALIDADE, como no rodapé do detalhe.
    rerender(
      <OrderLine
        order={orderFixture({ status: 'ready', order_type: 'delivery' })}
        stageLabel="Pronto"
        isSelected={false}
        onOpen={() => {}}
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByTestId('row-advance-137')).toHaveTextContent('Despachar');

    rerender(
      <OrderLine
        order={orderFixture({ status: 'ready', order_type: 'pickup' })}
        stageLabel="Pronto"
        isSelected={false}
        onOpen={() => {}}
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByTestId('row-advance-137')).toHaveTextContent('Concluir');
  });

  /*
   * O CASO QUE MAIS IMPORTA. Com o pagamento online não confirmado, o backend
   * recusa a ida para a cozinha — e um "Aceitar" de 44px na quina do polegar,
   * sem o motivo escrito ao lado (não há linha para ele aqui), seria um alvo
   * morto convidando a insistir. A linha já responde por que: o alerta.
   */
  it('não oferece avanço quando o pagamento ainda trava o pedido', () => {
    render(
      <OrderLine
        order={orderFixture({ status: 'pending', payment_status: 'pending' })}
        stageLabel="Novos"
        isSelected={false}
        onOpen={() => {}}
        onAdvance={() => {}}
      />,
    );

    expect(screen.queryByTestId('row-advance-137')).not.toBeInTheDocument();
    expect(screen.getByText(/não preparar/i)).toBeInTheDocument();
  });

  it('não oferece avanço em pedido encerrado nem sem quem o receba', () => {
    const { rerender } = render(
      <OrderLine
        order={orderFixture({ status: 'completed' })}
        stageLabel="Concluído"
        isSelected={false}
        onOpen={() => {}}
        onAdvance={() => {}}
      />,
    );
    expect(screen.queryByTestId('row-advance-137')).not.toBeInTheDocument();

    // Sem `onAdvance` — é assim que o histórico monta a mesma linha.
    rerender(
      <OrderLine
        order={orderFixture({ status: 'pending' })}
        stageLabel="Novos"
        isSelected={false}
        onOpen={() => {}}
      />,
    );
    expect(screen.queryByTestId('row-advance-137')).not.toBeInTheDocument();
  });

  it('avança sem abrir o detalhe, e diz ao leitor de tela qual pedido', async () => {
    const onOpen = vi.fn();
    const onAdvance = vi.fn();
    render(
      <OrderLine
        order={orderFixture({ status: 'pending' })}
        stageLabel="Novos"
        isSelected={false}
        onOpen={onOpen}
        onAdvance={onAdvance}
      />,
    );

    /*
      O NOME ACESSÍVEL É O VERBO INTEIRO MAIS O PEDIDO. Na tela o botão diz só
      "Aceitar"; numa lista de seis, seis "Aceitar" iguais não dizem a quem ouve
      a tela qual deles está prestes a ser aceito.
    */
    const botao = screen.getByRole('button', { name: 'Aceitar pedido #137' });
    await userEvent.click(botao);

    expect(onAdvance).toHaveBeenCalledWith('ordem-1', 'accepted');
    /*
      E O CLIQUE NÃO SOBE PARA A LINHA. Enquanto a linha era um `<button>`, uma
      ação dentro dela seria marcação inválida e o clique acabaria abrindo o
      detalhe junto — aceitar viraria "aceitar E sair da lista", que é
      exatamente o desvio que esta ação veio eliminar.
    */
    expect(onOpen).not.toHaveBeenCalled();
  });
});
