/**
 * Os grupos de complemento, de leitura para edição.
 *
 * Dois assuntos moram aqui, e eles são diferentes:
 *
 *   1. **O aviso que impede o lojista de perder venda em silêncio.** Desativar
 *      a última opção ativa de um grupo obrigatório tira o item do cardápio do
 *      cliente sem mexer em `is_active` nem em `is_available`. Estes casos
 *      vieram de `ProductDialog.test.tsx`, com a seção; o comportamento não
 *      mudou, a casa mudou.
 *
 *   2. **A edição, que não existia.** Quatro rotas prontas no backend e
 *      paradas: criar grupo, editar as regras, criar opção. O que elas
 *      destravam — "Escolha o tamanho", "Ponto da carne", "Adicionais" — é o
 *      cardápio de qualquer pizzaria, hamburgueria ou açaí.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductOptionGroup } from '../api/types';

vi.mock('../api/menu', () => ({
  listProductOptionGroups: vi.fn(),
  createOptionGroup: vi.fn(),
  updateOptionGroup: vi.fn(),
  createOption: vi.fn(),
  setOptionActive: vi.fn(),
}));

import {
  createOption,
  createOptionGroup,
  listProductOptionGroups,
  setOptionActive,
  updateOptionGroup,
} from '../api/menu';
import { OptionGroupsSection } from './OptionGroupsSection';

function grupoPonto(
  options: { id: string; name: string; is_active: boolean }[],
  overrides: Partial<ProductOptionGroup> = {},
): ProductOptionGroup {
  return {
    id: 'g-ponto',
    product_id: 'prod-1',
    name: 'Ponto da carne',
    description: null,
    min_select: 1,
    max_select: 1,
    is_required: true,
    sort_order: 0,
    is_active: true,
    options: options.map((o, i) => ({
      id: o.id,
      option_group_id: 'g-ponto',
      name: o.name,
      description: null,
      additional_price: 0,
      sort_order: i,
      is_active: o.is_active,
    })),
    ...overrides,
  };
}

function renderSecao(podeEditar = true) {
  return render(<OptionGroupsSection productId="prod-1" podeEditar={podeEditar} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listProductOptionGroups).mockResolvedValue([]);
});

describe('opção que tira o item de venda', () => {
  it('pergunta antes de desativar a ÚLTIMA opção ativa de um grupo obrigatório', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: true }]),
    ]);

    renderSecao();
    await userEvent.click(await screen.findByRole('switch', { name: /Mal passado ativa/ }));

    // Perguntou, e nomeou o grupo e a opção — sem os dois nomes o aviso manda
    // procurar em todos.
    expect(await screen.findByText(/última opção ativa do grupo obrigatório/)).toBeInTheDocument();
    expect(screen.getByTestId('grupo-confirmar')).toHaveTextContent(/Ponto da carne/);

    // E não mexeu em nada antes de o lojista confirmar.
    expect(setOptionActive).not.toHaveBeenCalled();
  });

  it('ao confirmar, desativa e RELÊ a lista', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: true }]),
    ]);
    vi.mocked(setOptionActive).mockResolvedValue({} as never);

    renderSecao();
    await userEvent.click(await screen.findByRole('switch', { name: /Mal passado ativa/ }));

    // Depois do PATCH a lista vem de novo, com o grupo já vazio.
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: false }]),
    ]);
    await userEvent.click(screen.getByTestId('confirm-deactivate-option'));

    expect(setOptionActive).toHaveBeenCalledWith('o-mal', false);

    /*
     * A RELEITURA É O PONTO. O PATCH devolve `AdminOptionResponse`, que não
     * fala do grupo — se a tela confiasse nessa resposta, o aviso abaixo nunca
     * apareceria.
     */
    await waitFor(() => expect(listProductOptionGroups).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('product-blocked-warning')).toHaveTextContent(/fora de venda/);
  });

  it('NÃO pergunta quando ainda sobra outra opção ativa', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([
        { id: 'o-mal', name: 'Mal passado', is_active: true },
        { id: 'o-ponto', name: 'Ao ponto', is_active: true },
      ]),
    ]);
    vi.mocked(setOptionActive).mockResolvedValue({} as never);

    renderSecao();
    await userEvent.click(await screen.findByRole('switch', { name: /Mal passado ativa/ }));

    // Foi direto: um diálogo que confirma tudo é um diálogo que ninguém lê.
    await waitFor(() => expect(setOptionActive).toHaveBeenCalledWith('o-mal', false));
    expect(screen.queryByText(/última opção ativa/)).not.toBeInTheDocument();
  });

  it('não pergunta ao REATIVAR uma opção', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: false }]),
    ]);
    vi.mocked(setOptionActive).mockResolvedValue({} as never);

    renderSecao();
    await userEvent.click(await screen.findByRole('switch', { name: /Mal passado ativa/ }));

    await waitFor(() => expect(setOptionActive).toHaveBeenCalledWith('o-mal', true));
  });

  it('mostra a faixa de fora de venda já ao abrir um item bloqueado', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: false }]),
    ]);

    renderSecao();
    expect(await screen.findByTestId('product-blocked-warning')).toHaveTextContent(
      /Ponto da carne/,
    );
  });
});

describe('criar um grupo', () => {
  it('monta "Escolha o tamanho": obrigatório, 1 de 1', async () => {
    vi.mocked(createOptionGroup).mockResolvedValue({} as never);

    renderSecao();
    await userEvent.click(await screen.findByTestId('grupo-novo'));
    await userEvent.type(screen.getByTestId('grupo-nome'), 'Escolha o tamanho');
    await userEvent.click(screen.getByRole('switch', { name: /obrigado a escolher/ }));
    await userEvent.click(screen.getByTestId('grupo-salvar'));

    /*
     * LIGAR "OBRIGATÓRIO" SOBE O MÍNIMO PARA 1 SOZINHO, e é isso que este caso
     * prende: o backend recusa obrigatório com mínimo zero, e quem preenche não
     * pensa em `min_select` — pensa em "o cliente TEM de escolher um tamanho".
     */
    await waitFor(() =>
      expect(createOptionGroup).toHaveBeenCalledWith('prod-1', {
        name: 'Escolha o tamanho',
        description: null,
        is_required: true,
        is_active: true,
        min_select: 1,
        max_select: 1,
        sort_order: 0,
      }),
    );
  });

  /*
   * A REGRA CRUZADA QUE NÃO SAI NO /openapi.json. Sem esta conferência o
   * lojista preencheria os seis campos e levaria 422 no clique, com a mensagem
   * do Pydantic em inglês.
   */
  it('trava o salvamento quando o máximo é menor que o mínimo, e diz por quê', async () => {
    renderSecao();
    await userEvent.click(await screen.findByTestId('grupo-novo'));
    await userEvent.type(screen.getByTestId('grupo-nome'), 'Sabores');
    await userEvent.clear(screen.getByTestId('grupo-min'));
    await userEvent.type(screen.getByTestId('grupo-min'), '3');

    expect(screen.getByTestId('grupo-erro-form')).toHaveTextContent(/máximo não pode ser menor/);
    expect(screen.getByTestId('grupo-salvar')).toBeDisabled();
    expect(createOptionGroup).not.toHaveBeenCalled();
  });
});

describe('editar as regras de um grupo', () => {
  /*
   * O PATCH LEVA O FORMULÁRIO INTEIRO. O backend valida o RESULTADO DA MESCLA
   * com o banco: um corpo que mandasse só o campo mudado poderia ser recusado
   * por causa de um campo que a tela nem mostrou.
   */
  it('manda os sete campos, e não só o que mudou', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: true }]),
    ]);
    vi.mocked(updateOptionGroup).mockResolvedValue({} as never);

    renderSecao();
    await userEvent.click(await screen.findByTestId('grupo-editar-g-ponto'));

    await userEvent.clear(screen.getByTestId('grupo-max'));
    await userEvent.type(screen.getByTestId('grupo-max'), '2');
    await userEvent.click(screen.getByTestId('grupo-salvar'));

    await waitFor(() =>
      expect(updateOptionGroup).toHaveBeenCalledWith('g-ponto', {
        name: 'Ponto da carne',
        description: null,
        is_required: true,
        is_active: true,
        min_select: 1,
        max_select: 2,
        sort_order: 0,
      }),
    );
  });

  it('a linha lê a regra em português, e não em nomes de campo', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([], { is_required: false, min_select: 0, max_select: 5, name: 'Adicionais' }),
    ]);

    renderSecao();
    expect(await screen.findByTestId('grupo-g-ponto')).toHaveTextContent('Opcional · até 5');
  });
});

describe('criar uma opção', () => {
  it('a nova entra no FIM do grupo, com o preço em vírgula', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([
        { id: 'o-mal', name: 'Mal passado', is_active: true },
        { id: 'o-ponto', name: 'Ao ponto', is_active: true },
      ]),
    ]);
    vi.mocked(createOption).mockResolvedValue({} as never);

    renderSecao();
    await userEvent.click(await screen.findByTestId('opcao-nova-g-ponto'));
    await userEvent.type(screen.getByTestId('opcao-nome'), 'Bem passado');
    await userEvent.type(screen.getByTestId('opcao-preco'), '3,50');
    await userEvent.click(screen.getByTestId('opcao-salvar'));

    await waitFor(() =>
      expect(createOption).toHaveBeenCalledWith('g-ponto', {
        name: 'Bem passado',
        description: null,
        additional_price: 3.5,
        is_active: true,
        // Duas opções já existem: a nova entra depois delas.
        sort_order: 2,
      }),
    );
  });

  it('sem preço digitado, o adicional é zero — que é o caso comum', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([grupoPonto([])]);
    vi.mocked(createOption).mockResolvedValue({} as never);

    renderSecao();
    await userEvent.click(await screen.findByTestId('opcao-nova-g-ponto'));
    await userEvent.type(screen.getByTestId('opcao-nome'), 'Mal passado');
    await userEvent.click(screen.getByTestId('opcao-salvar'));

    await waitFor(() =>
      expect(createOption).toHaveBeenCalledWith(
        'g-ponto',
        expect.objectContaining({ additional_price: 0 }),
      ),
    );
  });
});

/*
 * LER É `PESSOAS`, ESCREVER É `GERÊNCIA` — e a diferença é ESCONDER, não
 * desabilitar. A razão é quem a pessoa é, e ela não muda durante o turno: um
 * botão permanentemente cinza é um convite a insistir.
 */
describe('o atendente lê e não edita', () => {
  it('vê os grupos e as opções, e não vê um só controle de escrita', async () => {
    vi.mocked(listProductOptionGroups).mockResolvedValue([
      grupoPonto([{ id: 'o-mal', name: 'Mal passado', is_active: true }]),
    ]);

    renderSecao(false);

    // O DADO fica: é ele que diz o que sai no papel.
    expect(await screen.findByTestId('grupo-g-ponto')).toHaveTextContent('Ponto da carne');
    expect(screen.getByText('Mal passado')).toBeInTheDocument();

    // O CONTROLE some.
    expect(screen.queryByTestId('grupo-novo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grupo-editar-g-ponto')).not.toBeInTheDocument();
    expect(screen.queryByTestId('opcao-nova-g-ponto')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Mal passado ativa/ })).toBeDisabled();
  });
});
