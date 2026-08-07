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
});

describe('messageFromUnknownError', () => {
  it('cobre ApiError, Error comum e qualquer outra coisa', () => {
    expect(messageFromUnknownError(networkError())).toContain('Sem conexão');
    expect(messageFromUnknownError(new Error('quebrou'))).toBe('quebrou');
    expect(messageFromUnknownError('string solta')).toBe('Erro inesperado.');
  });
});
