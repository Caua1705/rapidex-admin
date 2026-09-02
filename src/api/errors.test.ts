import { describe, expect, it } from 'vitest';

import { buildApiError, messageFromUnknownError, networkError, readDetailMessage } from './errors';

describe('readDetailMessage', () => {
  it('lê o detail de texto do HTTPException', () => {
    expect(readDetailMessage({ detail: "Nao e possivel ir de 'pending' para 'ready'." })).toBe(
      "Nao e possivel ir de 'pending' para 'ready'.",
    );
  });

  it('junta as mensagens do erro de validação', () => {
    const body = {
      detail: [
        { loc: ['body', 'status'], msg: 'field required' },
        { loc: ['body', 'note'], msg: 'string too long' },
      ],
    };
    expect(readDetailMessage(body)).toBe('field required; string too long');
  });

  /*
   * O CASO QUE FALTAVA, e ele custava o cancelamento do pedido em produção.
   *
   * O 428 de `PATCH /admin/orders/{id}/cancel` traz `detail` como OBJETO
   * (`{ code, message, order_status }`), e a mensagem dentro dele é descrita
   * pelo backend como "pronta para ser mostrada no diálogo de confirmação do
   * painel". Sem esta leitura, o objeto caía fora dos dois formatos conhecidos
   * e o lojista recebia "A requisição falhou (428)" — um número HTTP no lugar
   * da frase em português que o backend já tinha mandado.
   */
  it('lê o detail que é OBJETO com message — o 428 do cancelamento', () => {
    const body = {
      detail: {
        code: 'confirmation_required',
        message: 'Este pedido já está em produção. Confirme para continuar.',
        order_status: 'preparing',
      },
    };
    expect(readDetailMessage(body)).toBe(
      'Este pedido já está em produção. Confirme para continuar.',
    );
  });

  it('ignora o detail objeto sem message aproveitável', () => {
    expect(readDetailMessage({ detail: { code: 'seja_o_que_for' } })).toBeNull();
    expect(readDetailMessage({ detail: { message: '   ' } })).toBeNull();
    expect(readDetailMessage({ detail: { message: 42 } })).toBeNull();
  });

  it('lê o formato de erro de pagamento', () => {
    expect(readDetailMessage({ error: { message: 'Pix expirado' } })).toBe('Pix expirado');
  });

  it('devolve null quando não há mensagem aproveitável', () => {
    expect(readDetailMessage(null)).toBeNull();
    expect(readDetailMessage({})).toBeNull();
    expect(readDetailMessage({ detail: '   ' })).toBeNull();
    expect(readDetailMessage('texto solto')).toBeNull();
  });
});

describe('buildApiError', () => {
  // As mensagens de 409 já vêm prontas e em português do backend.
  it('prefere a mensagem do backend', () => {
    const error = buildApiError(409, { detail: 'Pedido de retirada nao sai para entrega.' });
    expect(error.status).toBe(409);
    expect(error.message).toBe('Pedido de retirada nao sai para entrega.');
  });

  it('usa frase própria quando o backend não explicou', () => {
    expect(buildApiError(401, null).message).toBe('Sessão expirada. Entre novamente.');
    expect(buildApiError(500, null).message).toContain('servidor falhou (500)');
    expect(buildApiError(418, null).message).toBe('A requisição falhou (418).');
  });

  /* O 428 inteiro, como ele chega: o que a tela mostra é a frase, não o número. */
  it('mostra a frase do 428 do cancelamento, e não "A requisição falhou (428)"', () => {
    const error = buildApiError(428, {
      detail: {
        code: 'confirmation_required',
        message: 'Este pedido já está em produção. Confirme para continuar.',
        order_status: 'ready',
      },
    });
    expect(error.message).toBe('Este pedido já está em produção. Confirme para continuar.');
    expect(error.message).not.toContain('428');
  });
});

describe('messageFromUnknownError', () => {
  it('cobre ApiError, Error comum e qualquer outra coisa', () => {
    expect(messageFromUnknownError(networkError())).toContain('Sem conexão');
    expect(messageFromUnknownError(new Error('quebrou'))).toBe('quebrou');
    expect(messageFromUnknownError('string solta')).toBe('Erro inesperado.');
  });
});
