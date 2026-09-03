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

/*
 * ============================================================================
 * O TAMANHO DO BLOCO É ARGUMENTO, e o caso que o obrigou é de seis dígitos
 * ============================================================================
 *
 * O código do entregador (`generate_courier_access_code`: seis dígitos) foi
 * mostrado em blocos de cinco por reuso do componente da senha, e saiu
 * "14686 0" na tela do lojista. Um grupo cheio e um dígito órfão é PIOR que
 * nenhum agrupamento: o olho conta o primeiro grupo, confia no compasso e erra
 * o resto.
 */
describe('blocosDe com tamanho próprio', () => {
  it('seis dígitos viram dois grupos de três', () => {
    expect(blocosDe('146860', 3)).toEqual(['146', '860']);
  });

  it('o padrão continua sendo cinco, para a senha não mudar de desenho', () => {
    expect(blocosDe('ABCDEFGHJK')).toEqual(['ABCDE', 'FGHJK']);
  });

  it('tamanho inválido cai no padrão em vez de laçar para sempre', () => {
    // `0` num loop de incremento seria um laço infinito na tela do lojista.
    expect(blocosDe('ABCDEFGHJK', 0)).toEqual(['ABCDE', 'FGHJK']);
    expect(blocosDe('ABCDEFGHJK', -3)).toEqual(['ABCDE', 'FGHJK']);
  });

  it('não acrescenta nem come caractere, com qualquer tamanho', () => {
    for (const tamanho of [1, 2, 3, 4, 7]) {
      expect(blocosDe('146860', tamanho).join('')).toBe('146860');
    }
  });
});
