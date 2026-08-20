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
    // A linha é uma só no sistema, e o modificador de alerta é o dela.
    expect(screen.getByTestId('order-card-137').className).toContain('ds-row--alerta');
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
});
