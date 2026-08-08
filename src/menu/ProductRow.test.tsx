import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Product } from '../api/types';
import { ProductRow } from './ProductRow';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    category_id: 'cat-1',
    name: 'X-Burger Clássico',
    price: 24.9,
    is_active: true,
    is_available: true,
    sort_order: 0,
    ...overrides,
  };
}

function renderRow(overrides: Partial<Product> = {}, onToggle = vi.fn()) {
  render(
    <ProductRow
      product={product(overrides)}
      isSaving={false}
      onToggleAvailability={onToggle}
      onEdit={() => {}}
    />,
  );
  return onToggle;
}

describe('ProductRow', () => {
  it('mostra nome e preço em real', () => {
    renderRow();
    expect(screen.getByText('X-Burger Clássico')).toBeInTheDocument();
    expect(screen.getByText(/24,90/)).toBeInTheDocument();
  });

  it('item disponível traz o interruptor ligado', () => {
    renderRow();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Disponível')).toBeInTheDocument();
  });

  it('esgotado desliga o interruptor e diz isso uma vez só, sem esmaecer a linha', () => {
    renderRow({ is_available: false });

    // Uma ocorrência: o rótulo do interruptor. Nada de tag repetindo a palavra.
    expect(screen.getAllByText('Esgotado')).toHaveLength(1);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    // A linha continua legível: é ela que o lojista procura para repor.
    expect(screen.getByTestId('product-row-prod-1').className).not.toContain('item--inactive');
  });

  /*
   * O requisito da tela: `is_active` e `is_available` são eixos diferentes.
   * Item inativo esmaece e NÃO oferece o interruptor de disponível.
   */
  it('item inativo esmaece a linha e não mostra o interruptor de disponível', () => {
    renderRow({ is_active: false });

    expect(screen.getByTestId('product-row-prod-1').className).toContain('item--inactive');
    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('inativo esconde o interruptor mesmo estando marcado como disponível', () => {
    renderRow({ is_active: false, is_available: true });
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText('Disponível')).not.toBeInTheDocument();
  });

  it('null vale como ativo e disponível, que é o padrão do backend', () => {
    renderRow({ is_active: null, is_available: null });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('product-row-prod-1').className).not.toContain('item--inactive');
  });

  it('clicar no interruptor pede a troca de disponibilidade', async () => {
    const onToggle = renderRow();
    await userEvent.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // Não existe excluir: a linha não oferece essa saída em lugar nenhum.
  it('não oferece excluir', () => {
    renderRow();
    expect(
      screen.queryByRole('button', { name: /excluir|remover|apagar/i }),
    ).not.toBeInTheDocument();
  });
});
