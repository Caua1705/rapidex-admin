/**
 * O aviso que impede o lojista de perder venda em silêncio.
 *
 * Desativar a última opção ativa de um grupo obrigatório tira o item do
 * cardápio do cliente sem mexer em `is_active` nem em `is_available`. Estes
 * testes prendem as três partes do comportamento: perguntar antes, reler o
 * produto depois, e NÃO perguntar quando não há o que avisar.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductDetail, ProductOptionGroup } from '../api/types';

vi.mock('../api/menu', () => ({
  fetchProductDetail: vi.fn(),
  setOptionActive: vi.fn(),
}));

import { fetchProductDetail, setOptionActive } from '../api/menu';
import { ProductDialog } from './ProductDialog';
import type { ProductDraft } from './useMenu';

const draft: ProductDraft = {
  id: 'prod-1',
  categoryId: 'cat-1',
  name: 'Picanha na chapa',
  price: '59,90',
  description: '',
  isActive: true,
  isAvailable: true,
  printSectorId: null,
};

function grupoPonto(options: { id: string; name: string; is_active: boolean }[]): ProductOptionGroup {
  return {
    id: 'g-ponto',
    product_id: 'prod-1',
    name: 'Ponto da carne',
    min_select: 1,
    max_select: 1,
    is_required: true,
    sort_order: 0,
    is_active: true,
    options: options.map((o) => ({
      id: o.id,
      option_group_id: 'g-ponto',
      name: o.name,
      additional_price: 0,
      sort_order: 0,
      is_active: o.is_active,
    })),
  };
}

function detalhe(groups: ProductOptionGroup[]): ProductDetail {
  return {
    id: 'prod-1',
    category_id: 'cat-1',
    name: 'Picanha na chapa',
    price: 59.9,
    is_active: true,
    is_available: true,
    sort_order: 0,
    option_groups: groups,
  };
}

function renderDialog(initial: ProductDraft = draft) {
  return render(
    <ProductDialog
      initial={initial}
      categories={[{ id: 'cat-1', name: 'Carnes' } as never]}
      sectors={[]}
      branchChosen={false}
      onClose={() => {}}
      onSave={async () => true}
    />,
  );
}

describe('ProductDialog · opção que tira o item de venda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pergunta antes de desativar a ÚLTIMA opção ativa de um grupo obrigatório', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue(
      detalhe([grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: true }])]),
    );

    renderDialog();
    const interruptor = await screen.findByRole('switch', { name: /Mal passado ativa/ });
    await userEvent.click(interruptor);

    // Perguntou, e nomeou o grupo e o item — sem os dois nomes o aviso manda
    // procurar em todos.
    expect(await screen.findByText(/última opção ativa do grupo obrigatório/)).toBeInTheDocument();
    expect(screen.getByText(/Ponto da carne/)).toBeInTheDocument();

    // E não mexeu em nada antes de o lojista confirmar.
    expect(setOptionActive).not.toHaveBeenCalled();
  });

  it('ao confirmar, desativa e RELÊ o produto', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue(
      detalhe([grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: true }])]),
    );
    vi.mocked(setOptionActive).mockResolvedValue({} as never);

    renderDialog();
    await userEvent.click(await screen.findByRole('switch', { name: /Mal passado ativa/ }));

    // Depois do PATCH o produto vem de novo com o grupo já vazio.
    vi.mocked(fetchProductDetail).mockResolvedValue(
      detalhe([grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: false }])]),
    );
    await userEvent.click(screen.getByTestId('confirm-deactivate-option'));

    expect(setOptionActive).toHaveBeenCalledWith('o-mal', false);

    /*
     * A RELEITURA É O PONTO. O PATCH devolve AdminOptionResponse, que não fala
     * do produto — se a tela confiasse nessa resposta, o aviso abaixo nunca
     * apareceria.
     */
    await waitFor(() => expect(fetchProductDetail).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('product-blocked-warning')).toHaveTextContent(
      /fora de venda/,
    );
  });

  it('NÃO pergunta quando ainda sobra outra opção ativa', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue(
      detalhe([
        grupoPonto([
          { id: 'o-mal', name: 'Mal passado', is_active: true },
          { id: 'o-ponto', name: 'Ao ponto', is_active: true },
        ]),
      ]),
    );
    vi.mocked(setOptionActive).mockResolvedValue({} as never);

    renderDialog();
    await userEvent.click(await screen.findByRole('switch', { name: /Mal passado ativa/ }));

    // Foi direto: um diálogo que confirma tudo é um diálogo que ninguém lê.
    await waitFor(() => expect(setOptionActive).toHaveBeenCalledWith('o-mal', false));
    expect(screen.queryByText(/última opção ativa/)).not.toBeInTheDocument();
  });

  it('não pergunta ao REATIVAR uma opção', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue(
      detalhe([grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: false }])]),
    );
    vi.mocked(setOptionActive).mockResolvedValue({} as never);

    renderDialog();
    await userEvent.click(await screen.findByRole('switch', { name: /Mal passado ativa/ }));

    await waitFor(() => expect(setOptionActive).toHaveBeenCalledWith('o-mal', true));
  });

  it('mostra a faixa de fora de venda já ao abrir um item bloqueado', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue(
      detalhe([grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: false }])]),
    );

    renderDialog();
    expect(await screen.findByTestId('product-blocked-warning')).toHaveTextContent(
      /Ponto da carne/,
    );
  });
});

/**
 * O bloco da foto está montado NOS DOIS diálogos.
 *
 * Ele nasceu dentro do `isEdit ?` de "Grupos de complemento" no rascunho e sair
 * de lá foi uma linha — é o tipo de coisa que volta sem ninguém perceber, e o
 * sintoma (campo que some no "Novo item") só aparece abrindo a tela. Os grupos
 * de complemento continuam SÓ na edição, e o segundo teste prende os dois
 * fatos de uma vez: a foto aparece, os grupos não.
 *
 * No item novo o bloco aparece SEM o botão de escolher: `POST
 * /admin/products/{id}/image` precisa do id, e um item que ainda não foi criado
 * não tem id. O que está lá é a frase que diz isso.
 */
describe('ProductDialog · o bloco da foto nos dois modos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no "Editar item", com o botão de escolher', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue(detalhe([]));

    renderDialog();

    expect(await screen.findByRole('heading', { name: 'Foto do item' })).toBeInTheDocument();
    expect(screen.getByTestId('product-image-choose')).toBeInTheDocument();
  });

  it('no "Novo item", com a frase de que a foto entra depois de salvar', async () => {
    renderDialog({ ...draft, id: null });

    expect(await screen.findByRole('heading', { name: 'Foto do item' })).toBeInTheDocument();
    expect(screen.getByText(/A foto entra depois de salvar/)).toBeInTheDocument();

    // Sem id não há rota: o botão não é oferecido para não responder 404.
    expect(screen.queryByTestId('product-image-choose')).not.toBeInTheDocument();

    // E o item novo não lê detalhe nenhum — não há o que ler.
    expect(fetchProductDetail).not.toHaveBeenCalled();

    // Os grupos de complemento seguem só na edição.
    expect(screen.queryByRole('heading', { name: 'Grupos de complemento' })).not.toBeInTheDocument();
  });
});
