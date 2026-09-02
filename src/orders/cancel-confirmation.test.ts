import { describe, expect, it } from 'vitest';

import { ApiError, networkError } from '../api/errors';
import { readCancelConfirmation, tituloDaConfirmacao } from './cancel-confirmation';

/** O corpo exato que `AdminOrderService._ensure_cancellation_confirmed` levanta. */
function corpo428(orderStatus: string) {
  return {
    detail: {
      code: 'confirmation_required',
      message:
        'Este pedido já está em produção. Cancelar agora não devolve o custo da ' +
        'comida para o restaurante. Confirme para continuar.',
      order_status: orderStatus,
    },
  };
}

describe('readCancelConfirmation', () => {
  it('lê a mensagem e o status do 428 do backend', () => {
    const erro = new ApiError(428, 'qualquer coisa', corpo428('preparing'));
    expect(readCancelConfirmation(erro)).toEqual({
      message: corpo428('preparing').detail.message,
      orderStatus: 'preparing',
    });
  });

  it('vale para os três estados de produção', () => {
    for (const status of ['preparing', 'ready', 'out_for_delivery']) {
      const erro = new ApiError(428, '', corpo428(status));
      expect(readCancelConfirmation(erro)?.orderStatus).toBe(status);
    }
  });

  /*
   * O 409 desta MESMA rota é conflito de verdade ("pedido já entregue não muda
   * mais") e sai com `detail` de texto. Confundir os dois faria o painel abrir
   * um diálogo de confirmação para um pedido que o backend nunca vai cancelar,
   * e o segundo clique levaria ao mesmo 409.
   */
  it('não confunde com o 409 de conflito de estado', () => {
    const erro = new ApiError(409, 'Pedido já entregue não muda mais.', {
      detail: 'Pedido já entregue não muda mais.',
    });
    expect(readCancelConfirmation(erro)).toBeNull();
  });

  it('devolve null para 428 sem o código esperado, e para o que não é ApiError', () => {
    expect(readCancelConfirmation(new ApiError(428, '', { detail: 'texto solto' }))).toBeNull();
    expect(readCancelConfirmation(new ApiError(428, '', { detail: { code: 'outra_coisa' } }))).toBe(
      null,
    );
    expect(readCancelConfirmation(networkError())).toBeNull();
    expect(readCancelConfirmation(new Error('quebrou'))).toBeNull();
    expect(readCancelConfirmation(null)).toBeNull();
  });

  /*
   * Painel novo contra backend que ainda não manda `order_status`: a
   * confirmação continua valendo (é ela que destrava o cancelamento), e quem
   * some é só a palavra do título. Recusar o 428 inteiro por falta de um campo
   * de TEXTO deixaria o pedido sem poder ser cancelado.
   */
  it('aceita o 428 sem order_status, que só muda o título', () => {
    const erro = new ApiError(428, '', {
      detail: { code: 'confirmation_required', message: 'Oi' },
    });
    expect(readCancelConfirmation(erro)).toEqual({ message: 'Oi', orderStatus: '' });
  });
});

describe('tituloDaConfirmacao', () => {
  /*
   * É O ÚNICO USO DE `order_status`, e é o motivo de o backend mandá-lo: a
   * mensagem dele é a mesma para os três estados ("já está em produção"), e
   * "já saiu para entrega" é informação que muda a decisão — a comida não está
   * só feita, ela está na rua com o entregador.
   */
  it('separa a comida na chapa da comida na rua', () => {
    expect(tituloDaConfirmacao('preparing')).toBe('A comida já está sendo feita');
    expect(tituloDaConfirmacao('ready')).toBe('A comida já está pronta');
    expect(tituloDaConfirmacao('out_for_delivery')).toBe('O pedido já saiu para entrega');
  });

  it('tem uma frase de reserva para status que ainda não conhece', () => {
    expect(tituloDaConfirmacao('')).toBe('Este pedido já está em produção');
    expect(tituloDaConfirmacao('status_novo_do_backend')).toBe('Este pedido já está em produção');
  });
});
