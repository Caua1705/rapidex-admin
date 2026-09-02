import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrderPrintJobs, PrintAgentStatus, PrintJob } from '../api/types';
import { ComandaDoPedido } from './ComandaDoPedido';

/*
 * A chamada é dublada no módulo de API, e não no `fetch`: é o mesmo limite que
 * o resto do painel usa para separar "a tela" de "o contrato". O que este
 * arquivo cobre é o COMPORTAMENTO do bloco — o que ele carrega, quando, e o que
 * ele nunca escreve. As regras de agrupamento e de aviso têm teste próprio em
 * `print-jobs.test.ts`.
 */
vi.mock('../api/orders', () => ({ fetchOrderPrintJobs: vi.fn() }));
vi.mock('../api/print-agent', () => ({ fetchPrintAgentStatus: vi.fn() }));

const { fetchOrderPrintJobs } = await import('../api/orders');
const buscar = vi.mocked(fetchOrderPrintJobs);

const { fetchPrintAgentStatus } = await import('../api/print-agent');
const buscarAgente = vi.mocked(fetchPrintAgentStatus);

function agente(over: Partial<PrintAgentStatus> = {}): PrintAgentStatus {
  return {
    branch_id: 'fil-1',
    is_online: true,
    last_seen_at: '2026-09-02T20:00:00Z',
    seconds_since_last_seen: 12,
    agent_version: '1.4.2',
    ...over,
  };
}

function via(over: Partial<PrintJob> = {}): PrintJob {
  return {
    type: 'production',
    sector_name: 'Chapa',
    columns: 48,
    font_size: 'normal',
    content: 'PEDIDO #1042\n2x PICANHA',
    printer_name: null,
    sector_id: null,
    ...over,
  };
}

function resposta(jobs: PrintJob[]): OrderPrintJobs {
  return { order_id: 'ped-1', order_number: 1042, branch_id: 'fil-1', jobs };
}

beforeEach(() => {
  buscar.mockReset();
  buscar.mockResolvedValue(resposta([via()]));
  buscarAgente.mockReset();
  buscarAgente.mockResolvedValue(agente());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ComandaDoPedido', () => {
  /*
   * A REGRA QUE PAGA O BLOCO: no pico o lojista percorre dezenas de pedidos em
   * minutos, e uma requisição por abertura sairia cara para um dado que ele
   * consulta uma vez por turno no dia ruim.
   */
  it('não chama o backend enquanto o lojista não pede', () => {
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    expect(buscar).not.toHaveBeenCalled();
    expect(screen.getByTestId('comanda-abrir')).toBeInTheDocument();
  });

  it('carrega e mostra o texto da via ao clicar', async () => {
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    await userEvent.click(screen.getByTestId('comanda-abrir'));

    expect(buscar).toHaveBeenCalledWith('ped-1');
    expect(await screen.findByTestId('comanda-via')).toHaveTextContent('2x PICANHA');
  });

  it('escreve a contagem de cópias, que é entrada repetida no contrato', async () => {
    buscar.mockResolvedValue(resposta([via(), via()]));
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    await userEvent.click(screen.getByTestId('comanda-abrir'));

    const vias = await screen.findAllByTestId('comanda-via');
    expect(vias).toHaveLength(1);
    expect(vias[0]).toHaveTextContent('2 vias');
  });

  /*
   * O LIMITE DA ROTA, VIRADO EM TESTE. Ela não marca nada como impresso e não
   * existe histórico de impressão em lugar nenhum da API. Uma palavra no
   * passado aqui faria o lojista parar de procurar o defeito no momento em que
   * a comanda não saiu — que é justamente quando ele abre este bloco.
   */
  it('nunca afirma que a comanda foi impressa', async () => {
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);
    await userEvent.click(screen.getByTestId('comanda-abrir'));
    await screen.findByTestId('comanda-via');

    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/impress[ao]\b|foi impressa|comanda saiu/i);
  });

  it('lista vazia vira explicação, não tela em branco', async () => {
    buscar.mockResolvedValue(resposta([]));
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    await userEvent.click(screen.getByTestId('comanda-abrir'));

    expect(await screen.findByTestId('comanda-aviso')).toHaveTextContent('não imprime nada');
    expect(screen.queryByTestId('comanda-via')).not.toBeInTheDocument();
  });

  /*
   * AO CONTRÁRIO DO HISTÓRICO DO CLIENTE, o erro aqui aparece: o lojista
   * apertou um botão, e um botão que não faz nada é o defeito que ele veio
   * investigar.
   */
  it('mostra o erro quando a leitura falha', async () => {
    buscar.mockRejectedValue(new Error('rede fora'));
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    await userEvent.click(screen.getByTestId('comanda-abrir'));

    expect(await screen.findByTestId('comanda-erro')).toBeInTheDocument();
  });

  /*
   * TROCAR DE PEDIDO FECHA O BLOCO. A comanda do #1041 sob o cabeçalho do #1042
   * é pior do que nenhuma comanda, ainda mais numa tela cuja razão de existir é
   * conferir o papel daquele pedido.
   */
  it('fecha e esquece a comanda quando o pedido troca', async () => {
    const { rerender } = render(
      <ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />,
    );
    await userEvent.click(screen.getByTestId('comanda-abrir'));
    await screen.findByTestId('comanda-via');

    rerender(<ComandaDoPedido orderId="ped-2" branchId="fil-1" paymentStatus="paid" />);

    expect(screen.queryByTestId('comanda-via')).not.toBeInTheDocument();
    expect(screen.getByTestId('comanda-abrir')).toBeInTheDocument();
  });

  /*
   * REABRIR RELÊ. O conteúdo MUDA durante a vida do pedido: o Pix cai e a via
   * de produção passa a existir. Um cache mostraria "sai só a via do cliente"
   * depois de o dinheiro ter entrado.
   */
  it('reabrir pergunta de novo, em vez de repetir a resposta velha', async () => {
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    await userEvent.click(screen.getByTestId('comanda-abrir'));
    await screen.findByTestId('comanda-via');
    await userEvent.click(screen.getByRole('button', { name: 'Esconder a comanda' }));
    await userEvent.click(screen.getByTestId('comanda-abrir'));
    await screen.findByTestId('comanda-via');

    expect(buscar).toHaveBeenCalledTimes(2);
  });
});

/*
 * ============================================================================
 * A METADE DA RESPOSTA QUE FALTAVA
 * ============================================================================
 *
 * A linha de apoio mandava conferir o programa em Loja › Impressão — uma tela
 * de configuração, que só abre quem já desconfia. Quem está aqui já desconfia,
 * e já está na tela onde a resposta cabia.
 */
describe('ComandaDoPedido: o estado do programa que imprime', () => {
  it('a linha fechada não manda mais o lojista para outra tela', () => {
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    expect(screen.getByTestId('comanda-abrir')).toBeInTheDocument();
    expect(screen.queryByText(/Loja . Impressão/)).not.toBeInTheDocument();
  });

  it('perguntar o estado do programa também custa o clique, e nem um a mais', () => {
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    expect(buscarAgente).not.toHaveBeenCalled();
  });

  it('aberto com o programa parado, diz desde quando — em vez de um endereço', async () => {
    buscarAgente.mockResolvedValue(agente({ is_online: false, seconds_since_last_seen: 3600 }));
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    await userEvent.click(screen.getByTestId('comanda-abrir'));

    expect(await screen.findByTestId('comanda-programa')).toHaveTextContent('sem sinal há 1 hora');
    expect(buscarAgente).toHaveBeenCalledWith('fil-1');
  });

  it('aberto com o programa rodando, afirma que há máquina do outro lado', async () => {
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    await userEvent.click(screen.getByTestId('comanda-abrir'));

    expect(await screen.findByTestId('comanda-programa')).toHaveTextContent('rodando agora');
  });

  /*
   * A LEITURA DO AGENTE CAI SOZINHA. Ela é a segunda metade da resposta, não a
   * primeira: quem clicou veio ver a comanda, e perder o texto do papel porque
   * uma leitura de apoio falhou seria trocar um defeito por outro maior.
   */
  it('se o estado do programa não vem, a comanda aparece do mesmo jeito', async () => {
    buscarAgente.mockRejectedValue(new Error('sem rede'));
    render(<ComandaDoPedido orderId="ped-1" branchId="fil-1" paymentStatus="paid" />);

    await userEvent.click(screen.getByTestId('comanda-abrir'));

    expect(await screen.findByText(/PICANHA/)).toBeInTheDocument();
    const linha = screen.getByTestId('comanda-programa');
    expect(linha).not.toHaveTextContent('rodando');
    expect(linha).not.toHaveTextContent('sem sinal');
  });
});
