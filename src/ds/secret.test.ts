import { describe, expect, it } from 'vitest';

import { blocosDe } from './secret';

describe('blocosDe', () => {
  it('parte a senha de 20 caracteres em quatro blocos de cinco', () => {
    // O tamanho real do backend: `_TEMPORARY_PASSWORD_LENGTH = 20`.
    expect(blocosDe('ABCDEFGHJKMNPQRSTUVW')).toEqual(['ABCDE', 'FGHJK', 'MNPQR', 'STUVW']);
  });

  it('o resto entra inteiro no último bloco, sem sobrar bloco vazio', () => {
    /*
     * Hoje a conta fecha redonda, mas o backend pode mudar o tamanho da senha
     * sem avisar a tela — e um bloco vazio no fim seria um espaço que quem está
     * ditando leria como parte do valor.
     */
    expect(blocosDe('ABCDEFG')).toEqual(['ABCDE', 'FG']);
    expect(blocosDe('AB')).toEqual(['AB']);
  });

  it('valor vazio não vira um bloco vazio', () => {
    expect(blocosDe('')).toEqual([]);
  });

  it('não acrescenta nem come caractere: os blocos remontam o valor', () => {
    const senha = 'K7MNP2QRST4UVWXY9ZAB';
    expect(blocosDe(senha).join('')).toBe(senha);
  });
});
