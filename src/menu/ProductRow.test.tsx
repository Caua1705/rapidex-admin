import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PrintSector, Product } from '../api/types';
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

const SETORES: PrintSector[] = [
  { id: 's-chapa', branch_id: 'b-1', name: 'Chapa', is_active: true, sort_order: 0 },
  { id: 's-bar', branch_id: 'b-1', name: 'Bar', is_active: false, sort_order: 1 },
];

function renderRow(
  overrides: Partial<Product> = {},
  onToggle = vi.fn(),
  {
    showSector = true,
    showPhoto = false,
    qualifier = null,
    sectors = SETORES,
  }: {
    showSector?: boolean;
    showPhoto?: boolean;
    qualifier?: string | null;
    sectors?: PrintSector[];
  } = {},
) {
  render(
    <ProductRow
      product={product(overrides)}
      sectors={sectors}
      showPhoto={showPhoto}
      showSector={showSector}
      qualifier={qualifier}
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

  /*
   * O estado positivo NÃO é escrito.
   *
   * "DISPONÍVEL" ao lado de um interruptor ligado, em toda linha da lista, é a
   * mesma informação duas vezes. Quem diz que o item está à venda é o
   * interruptor; a palavra fica para os estados que não são o normal.
   */
  it('item disponível traz o interruptor ligado e nenhum rótulo', () => {
    renderRow();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Disponível')).not.toBeInTheDocument();
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

  /*
   * O ITEM INATIVO CONTINUA MOSTRANDO O PREÇO QUE TEM.
   *
   * O que ele não está é à venda — o preço segue cadastrado, e apagá-lo (ou
   * mostrar zero) leria como erro de cadastro numa tela em que o lojista está
   * justamente conferindo o que reativar. Quem diz "isto está fora do cardápio"
   * é o recuo da linha mais a etiqueta, não um número mentiroso.
   */
  it('item inativo mostra o preço de verdade, não zero', () => {
    renderRow({ is_active: false, price: 45 });
    expect(screen.getByText(/45,00/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$\s*0,00/)).not.toBeInTheDocument();
  });

  /*
   * UM EIXO, UMA LINGUAGEM. "Inativo" e "Esgotado" respondem à mesma pergunta —
   * está à venda? — e por isso saem com a mesma forma (etiqueta) e no mesmo
   * lugar da linha. Antes um era etiqueta colada ao nome e o outro texto solto
   * ao lado do interruptor.
   */
  it('esgotado e inativo usam a mesma forma, no mesmo lugar', () => {
    const { unmount } = render(
      <ProductRow
        product={product({ is_available: false })}
        sectors={SETORES}
        showPhoto={false}
        showSector
        qualifier={null}
        isSaving={false}
        onToggleAvailability={vi.fn()}
        onEdit={() => {}}
      />,
    );
    const esgotado = screen.getByText('Esgotado');
    expect(esgotado.className).toContain('tag');
    expect(esgotado.parentElement?.className).toContain('item__state');
    unmount();

    renderRow({ is_active: false });
    const inativo = screen.getByText('Inativo');
    expect(inativo.className).toContain('tag');
    expect(inativo.parentElement?.className).toContain('item__state');
  });

  /*
   * A gramatura presa no fim do nome sai como marca própria: é a única coisa
   * que muda entre "Picanha Suína", "Picanha Suína (400g)" e "Picanha Suína
   * (1kg)", e no fim de uma string em semibold o olho não a acha.
   */
  it('com qualificador, o nome sai sem o parêntese e a variação vira etiqueta', () => {
    renderRow({ name: 'Picanha Suína (400g)' }, vi.fn(), { qualifier: '400 g' });

    expect(screen.getByText('Picanha Suína')).toBeInTheDocument();
    expect(screen.getByText('400 g').className).toContain('item__variant');
  });

  // Sem qualificador — nome que não se repete na lista — vai o nome cadastrado,
  // inteiro. A tela não reescreve o cadastro de quem não tem problema nenhum.
  it('sem qualificador, o nome vai inteiro como está cadastrado', () => {
    renderRow({ name: 'Coca-Cola (lata)' });
    expect(screen.getByText('Coca-Cola (lata)')).toBeInTheDocument();
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

  /*
   * A coluna de setor existe para o lojista conferir a categoria inteira de
   * relance e ver se esqueceu algum item — sem abrir item por item.
   */
  describe('coluna de setor de impressão', () => {
    it('mostra o nome do setor do item', () => {
      renderRow({ printing_sector_id: 's-chapa' });
      expect(screen.getByTestId('product-sector-prod-1')).toHaveTextContent('Chapa');
    });

    /*
     * "Não imprimir" repetido em toda linha era o mesmo problema do
     * "DISPONÍVEL" que já saiu daqui: a mesma palavra em cada linha, sempre a
     * mesma, ocupando a largura do que muda. O que se procura nesta coluna é o
     * item que TEM setor, e um nome escrito salta sobre células em branco.
     */
    it('item sem setor não escreve nada', () => {
      renderRow({ printing_sector_id: null });
      expect(screen.getByTestId('product-sector-prod-1')).toHaveTextContent('');
    });

    it('setor desativado continua identificado, e marcado como tal', () => {
      renderRow({ printing_sector_id: 's-bar' });
      expect(screen.getByTestId('product-sector-prod-1')).toHaveTextContent('Bar (desativado)');
    });

    // Produto é do restaurante e setor é da filial: um id gravado por outra
    // loja não está nesta lista, e chamar isso de "Não imprimir" seria mentir.
    it('setor de outra filial aparece como inconsistência, não como "Não imprimir"', () => {
      renderRow({ printing_sector_id: 's-de-outra-filial' });

      const celula = screen.getByTestId('product-sector-prod-1');
      expect(celula).not.toHaveTextContent('Não imprimir');
      expect(celula.className).toContain('item__sector--unknown');
    });

    it('sem filial escolhida, a coluna não aparece', () => {
      renderRow({ printing_sector_id: 's-chapa' }, vi.fn(), { showSector: false });
      expect(screen.queryByTestId('product-sector-prod-1')).not.toBeInTheDocument();
    });
  });
});
