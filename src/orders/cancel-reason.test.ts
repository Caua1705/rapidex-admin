import { describe, expect, it } from 'vitest';

import { CANCEL_REASON_MAX, CANCEL_REASON_MIN, checkCancelReason } from './cancel-reason';

describe('checkCancelReason', () => {
  it('aceita um motivo comum e devolve o texto já aparado', () => {
    const check = checkCancelReason('  Cliente desistiu por telefone.  ');

    expect(check.valid).toBe(true);
    // O que vai para o backend é o texto aparado: espaço nas pontas conta no
    // limite de 300 e viraria 422 num motivo que o lojista vê como curto.
    expect(check).toMatchObject({ reason: 'Cliente desistiu por telefone.' });
  });

  // Campo ainda vazio não é erro: é o lojista que acabou de abrir a confirmação.
  // Pintar de vermelho antes da primeira letra acusa quem não fez nada errado.
  it('campo vazio trava o botão sem mostrar erro', () => {
    expect(checkCancelReason('')).toEqual({ valid: false, message: null });
    expect(checkCancelReason('   ')).toEqual({ valid: false, message: null });
  });

  it('abaixo do mínimo diz quantos caracteres faltam alcançar', () => {
    const check = checkCancelReason('ok');

    expect(check.valid).toBe(false);
    expect(check).toMatchObject({ message: expect.stringContaining(String(CANCEL_REASON_MIN)) });
  });

  it('acima do máximo diz o limite e o tamanho atual', () => {
    const check = checkCancelReason('x'.repeat(CANCEL_REASON_MAX + 1));

    expect(check.valid).toBe(false);
    expect(check).toMatchObject({ message: expect.stringContaining(String(CANCEL_REASON_MAX)) });
    expect(check).toMatchObject({
      message: expect.stringContaining(String(CANCEL_REASON_MAX + 1)),
    });
  });

  // As bordas são exatamente as do backend. Errar por um caractere para menos
  // travaria um motivo que ele aceitaria; para mais, deixaria passar um 422.
  it('as bordas do backend valem: mínimo e máximo exatos passam', () => {
    expect(checkCancelReason('x'.repeat(CANCEL_REASON_MIN)).valid).toBe(true);
    expect(checkCancelReason('x'.repeat(CANCEL_REASON_MAX)).valid).toBe(true);
    expect(checkCancelReason('x'.repeat(CANCEL_REASON_MIN - 1)).valid).toBe(false);
  });

  // O limite é medido DEPOIS de aparar: 300 caracteres mais um espaço colado
  // no fim continua sendo um motivo de 300.
  it('espaço nas pontas não conta para o limite', () => {
    expect(checkCancelReason(` ${'x'.repeat(CANCEL_REASON_MAX)} `).valid).toBe(true);
  });
});
