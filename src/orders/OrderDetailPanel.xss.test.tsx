/**
 * O texto que o CLIENTE FINAL escreve, na tela do lojista.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * A observação do item, a nota do pedido, o nome e o endereço do cliente são o
 * único conteúdo do painel escrito por um ESTRANHO. É o caminho mais curto
 * entre alguém de fora e a tela de quem tem, no `localStorage`, um token de
 * 12h que abre o restaurante inteiro (pedidos, faturamento, cardápio, telefone
 * dos clientes).
 *
 * React escapa filho de JSX por padrão, então hoje o caminho é seguro — mas
 * ele é seguro por uma ESCOLHA de uma linha, e a linha que o quebra
 * (`dangerouslySetInnerHTML`, para renderizar uma quebra de linha, por
 * exemplo) é a mesma que alguém escreveria de boa-fé um ano depois. Este teste
 * é o que transforma essa escolha em erro de build.
 *
 * Ele NÃO testa o React. Testa que o painel continua entregando esse texto
 * como TEXTO.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrderDetail } from '../api/types';

vi.mock('../api/orders', () => ({
  fetchOrderDetail: vi.fn(),
}));

/*
 * O painel também lê o histórico do cliente (`useCustomerHistory`), e essa
 * leitura é de APOIO: ela não pode aparecer neste teste nem como rede, nem como
 * ruído. Uma lista vazia é a resposta honesta para "não existe esse cliente".
 */
vi.mock('../api/customers', () => ({
  listCustomers: vi.fn(async () => ({ items: [], total: 0, limit: 5, offset: 0 })),
}));

import { fetchOrderDetail } from '../api/orders';
import { OrderDetailPanel } from './OrderDetailPanel';

/** A carga: se algum dia virar HTML, cada uma vira um nó que dá para achar. */
const CARGA_OBSERVACAO = '<img src=x onerror="alert(1)">sem cebola';
const CARGA_NOTA = '<script>alert(2)</script>tocar a campainha';
const CARGA_NOME = '<svg onload="alert(3)">Maria';
const CARGA_RUA = '<iframe src="javascript:alert(4)"></iframe>Rua das Flores';

function detalheFixture(): OrderDetail {
  return {
    id: 'ordem-1',
    order_number: 137,
    restaurant_id: 'rest-1',
    branch_id: 'filial-1',
    customer_name_snapshot: CARGA_NOME,
    customer_phone_snapshot: '85999990000',
    order_type: 'delivery',
    status: 'pending',
    payment_method: 'pix',
    payment_status: 'paid',
    subtotal: 40,
    delivery_fee: 2.5,
    service_fee: 0,
    coupon_discount_amount: '0.00',
    cashback_redeemed_amount: '0.00',
    discount_total: '0.00',
    total: 42.5,
    address_street: CARGA_RUA,
    address_number: '10',
    notes: CARGA_NOTA,
    created_at: '2026-08-07T18:00:00Z',
    items: [
      {
        id: 'item-1',
        product_name_snapshot: 'X-Salada',
        unit_price_snapshot: 40,
        quantity: 1,
        total: 40,
        observation: CARGA_OBSERVACAO,
        option_groups: [],
      },
    ],
    status_history: [],
  };
}

async function renderizarPainel() {
  vi.mocked(fetchOrderDetail).mockResolvedValue(detalheFixture());

  const { container } = render(
    <OrderDetailPanel
      orderId="ordem-1"
      branchId=""
      onClose={() => {}}
      onChangeStatus={async () => true}
      /*
        Ligado: estes testes cobrem o texto escrito pelo cliente final, e o
        rodapé completo é o que dá mais superfície para um
        `dangerouslySetInnerHTML` esquecido aparecer.
      */
      podeCancelar
      onCancelOrder={async () => ({ kind: 'cancelado' })}
      actionErrorMessage={null}
    />,
  );

  await waitFor(() => expect(screen.getByText(/X-Salada/)).toBeInTheDocument());
  return container;
}

describe('OrderDetailPanel · texto escrito pelo cliente final', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra a observação do item como texto, não como HTML', async () => {
    const container = await renderizarPainel();

    // O texto chega inteiro na tela, com as aspas e os sinais de menor/maior
    // visíveis — que é exatamente o sintoma de ter sido escapado.
    expect(screen.getByText(new RegExp(CARGA_OBSERVACAO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))) //
      .toBeInTheDocument();

    // E nenhum nó nasceu dele.
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg[onload]')).toBeNull();
  });

  it('não cria nó nenhum a partir da nota, do nome ou do endereço', async () => {
    const container = await renderizarPainel();

    // Se qualquer um dos quatro campos passasse por innerHTML, um destes
    // seletores acharia o elemento correspondente.
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror], [onload]')).toBeNull();
  });

  it('mantém o texto legível para o lojista, com a carga à vista', async () => {
    await renderizarPainel();

    // O lojista PRECISA ler "sem cebola" e "tocar a campainha": escapar não
    // pode virar esconder. Se um dia alguém sanitizar removendo o conteúdo,
    // este teste é o que reclama.
    expect(screen.getByText(/sem cebola/)).toBeInTheDocument();
    expect(screen.getByText(/tocar a campainha/)).toBeInTheDocument();
    expect(screen.getByText(/Maria/)).toBeInTheDocument();
    expect(screen.getByText(/Rua das Flores/)).toBeInTheDocument();
  });
});
