/**
 * O diálogo do item: o que ele grava, e o que ele NÃO grava.
 *
 * OS COMPLEMENTOS SAÍRAM DAQUI. Eles têm rotas próprias, gravam sozinhos e
 * agora têm componente e teste próprios (`OptionGroupsSection`) — o que
 * continua sendo deste arquivo é o produto: nome, preço, foto, e a diferença
 * entre salvar-e-fechar e salvar-e-continuar.
 *
 * `listProductOptionGroups` continua no dublê porque a seção é montada DENTRO
 * deste diálogo: sem ela, todo teste daqui quebraria por uma chamada de rede
 * que não é o assunto dele.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductDetail, ProductOptionGroup } from '../api/types';

vi.mock('../api/menu', () => ({
  fetchProductDetail: vi.fn(),
  listProductOptionGroups: vi.fn(),
  setOptionActive: vi.fn(),
}));

import { fetchProductDetail, listProductOptionGroups } from '../api/menu';
import { ProductDialog } from './ProductDialog';
import type { ProductDraft } from './useMenu';

const draft: ProductDraft = {
  id: 'prod-1',
  categoryId: 'cat-1',
  name: 'Picanha na chapa',
  price: '59,90',
  description: '',
  // Sem par de catálogo: é o estado normal, e este diálogo é montado sem
  // sessão — o campo de pareamento não entra (ver `catalogPairing`).
  catalog: null,
  isActive: true,
  isAvailable: true,
  printSectorId: null,
};

function detalhe(groups: ProductOptionGroup[]): ProductDetail {
  return {
    id: 'prod-1',
    // O produto é DA FILIAL desde que o cardápio deixou de ser do restaurante.
    branch_id: 'fil-1',
    category_id: 'cat-1',
    name: 'Picanha na chapa',
    price: 59.9,
    is_active: true,
    is_available: true,
    sort_order: 0,
    // O contrato passou a exigir o campo: o backend calcula em SQL se um grupo
    // obrigatório sem opção disponível tirou o item de venda.
    unavailable_by_required_group: false,
    option_groups: groups,
  };
}

function renderDialog(
  initial: ProductDraft = draft,
  overrides: {
    onClose?: () => void;
    podeDefinirPreco?: boolean;
    podeEditarComplemento?: boolean;
    onSave?: (draft: ProductDraft, price: number | null) => Promise<string | null>;
    onImageUploaded?: () => void;
  } = {},
) {
  return render(
    <ProductDialog
      initial={initial}
      categories={[{ id: 'cat-1', name: 'Carnes' } as never]}
      sectors={[]}
      branchChosen={false}
      branchId="fil-1"
      /*
        Este arquivo monta o diálogo SEM SessionProvider, e o campo de
        pareamento procura o gêmeo nas outras filiais da sessão. Desligado
        aqui, o que estes testes cobrem continua sendo o que eles sempre
        cobriram; o campo tem cobertura própria em `catalog-key.test.ts` e no
        E2E, que sobem o painel inteiro.
      */
      catalogPairing={false}
      /*
        O CAMPO DE PREÇO LIGADO É O PADRÃO DESTES TESTES: eles cobrem o
        diálogo do dono, que é quem tem a tela inteira. A ausência do campo
        para o gerente tem teste próprio, mais abaixo.
      */
      podeDefinirPreco={overrides.podeDefinirPreco ?? true}
      podeEditarComplemento={overrides.podeEditarComplemento ?? true}
      onClose={overrides.onClose ?? (() => {})}
      // Devolve o id salvo, e não um `true`: é o id que permite pôr foto sem
      // fechar o diálogo.
      onSave={overrides.onSave ?? (async () => 'prod-1')}
      onImageUploaded={overrides.onImageUploaded ?? (() => {})}
    />,
  );
}

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
 * não tem id. O que está lá é o botão que PEDE a foto — ver o describe seguinte.
 */
describe('ProductDialog · o bloco da foto nos dois modos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProductOptionGroups).mockResolvedValue([]);
  });

  it('no "Editar item", com o botão de escolher', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue(detalhe([]));

    renderDialog();

    expect(await screen.findByRole('heading', { name: 'Foto do item' })).toBeInTheDocument();
    expect(screen.getByTestId('product-image-choose')).toBeInTheDocument();
  });

  /*
   * A FOTO QUE JÁ ESTÁ NO ITEM mede 56px no diálogo (`foto__atual`), e vinha do
   * bucket em tamanho de upload — ~100 KB para desenhar um selo de confirmação
   * de qual foto está lá. Ver `ds/image-url.ts`.
   */
  it('a foto atual vem no tamanho do selo de 56px, não no tamanho do bucket', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue({
      ...detalhe([]),
      image_url:
        'https://exemplo.supabase.co/storage/v1/object/public/restaurant-assets/p/picanha.webp',
    });

    renderDialog();

    const foto = await screen.findByTestId('product-image-current');
    const url = new URL(foto.getAttribute('src') ?? '');

    expect(url.pathname).toContain('/storage/v1/render/image/public/');
    expect(url.searchParams.get('width')).toBe('112');
    expect(url.searchParams.get('height')).toBe('112');
  });

  it('no "Novo item", com o botão que PEDE a foto no lugar do de escolher', async () => {
    renderDialog({ ...draft, id: null });

    expect(await screen.findByRole('heading', { name: 'Foto do item' })).toBeInTheDocument();
    expect(screen.getByTestId('product-image-intent')).toHaveTextContent('Adicionar foto');

    // Sem id não há rota: o escolhedor não é oferecido para não responder 404.
    expect(screen.queryByTestId('product-image-choose')).not.toBeInTheDocument();

    // E o item novo não lê detalhe nenhum — não há o que ler.
    expect(fetchProductDetail).not.toHaveBeenCalled();

    // Os grupos de complemento seguem só na edição.
    expect(
      screen.queryByRole('heading', { name: 'Grupos de complemento' }),
    ).not.toBeInTheDocument();
  });
});

/**
 * QUEM DECIDE SE O DIÁLOGO FICA ABERTO É O PEDIDO DE FOTO.
 *
 * Cadastrar cardápio é trabalho em série — vinte itens seguidos —, e um
 * diálogo que sempre fica aberto depois de salvar cobra um fechamento manual em
 * cada um deles. Ficar aberto é o favor de UM caso: o da foto, que precisa do
 * id que só existe depois de criar. Estes testes prendem os dois desfechos e a
 * frase que impede o lojista de cadastrar o mesmo item duas vezes.
 */
describe('ProductDialog · salvar um item novo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProductOptionGroups).mockResolvedValue([]);
  });

  const novo: ProductDraft = { ...draft, id: null };

  it('sem pedir foto: salva e FECHA', async () => {
    const onClose = vi.fn();
    renderDialog(novo, { onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('com foto pedida: NÃO fecha, vira edição e diz que o item foi criado', async () => {
    vi.mocked(fetchProductDetail).mockResolvedValue(detalhe([]));
    const onClose = vi.fn();
    renderDialog(novo, { onClose, onSave: async () => 'prod-9' });

    await userEvent.click(screen.getByTestId('product-image-intent'));
    // O rodapé passa a anunciar o que vai acontecer, antes de acontecer.
    await userEvent.click(screen.getByRole('button', { name: 'Salvar e pôr foto' }));

    // A frase é o que separa "salvou e continuou" de "não salvou": sem ela, a
    // mesma janela aberta depois do clique lê como falha.
    expect(await screen.findByTestId('product-created-notice')).toHaveTextContent(/foi criado/);
    expect(onClose).not.toHaveBeenCalled();

    // Virou edição do item que acabou de nascer: título, escolhedor de foto
    // (agora há id) e a releitura do detalhe, que traz grupos e foto vazios.
    // O título do Modal é o nome acessível do diálogo, não um heading.
    expect(screen.getByRole('dialog', { name: 'Editar item' })).toBeInTheDocument();
    expect(await screen.findByTestId('product-image-choose')).toBeInTheDocument();
    await waitFor(() => expect(fetchProductDetail).toHaveBeenCalledWith('prod-9'));

    // E "Cancelar" saiu: não há como cancelar um item que já existe.
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });

  it('desistir da foto antes de salvar volta a fechar', async () => {
    const onClose = vi.fn();
    renderDialog(novo, { onClose });

    await userEvent.click(screen.getByTestId('product-image-intent'));
    await userEvent.click(screen.getByRole('button', { name: 'Não adicionar foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('falha ao salvar não fecha nem promete um item que não existe', async () => {
    const onClose = vi.fn();
    renderDialog(novo, { onClose, onSave: async () => null });

    await userEvent.click(screen.getByTestId('product-image-intent'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar e pôr foto' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Salvar e pôr foto' })).toBeEnabled(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId('product-created-notice')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Novo item' })).toBeInTheDocument();
  });
});
