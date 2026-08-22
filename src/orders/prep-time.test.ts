import { describe, expect, it } from 'vitest';

import { ApiError, networkError } from '../api/errors';
import { checkCancelReason } from './cancel-reason';
import {
  classifyPrepTimeFailure,
  formatDelta,
  formatPrepRange,
  promessaAoCliente,
} from './prep-time';

describe('classifyPrepTimeFailure', () => {
  it('reconhece a falta de base pelo código da máquina', () => {
    const erro = new ApiError(409, 'Sem tempo base.', { code: 'PREP_TIME_NOT_CONFIGURED' });
    expect(classifyPrepTimeFailure(erro)).toBe('base-missing');
  });

  it('reconhece filial fechada pelo código da máquina', () => {
    const erro = new ApiError(409, 'A loja está fechada.', { code: 'BRANCH_CLOSED' });
    expect(classifyPrepTimeFailure(erro)).toBe('branch-closed');
  });

  /*
   * O erro caro: abrir o campo de min/max numa filial fechada faria o lojista
   * preencher a base achando que resolveu, e levar outro 409. "Fechada" ganha
   * de "prep" sempre.
   */
  it('código que fala das duas coisas conta como fechada', () => {
    const erro = new ApiError(409, 'x', { code: 'branch_closed_prep_time_base' });
    expect(classifyPrepTimeFailure(erro)).toBe('branch-closed');
  });

  it('cai para o texto quando não veio código', () => {
    expect(
      classifyPrepTimeFailure(
        new ApiError(409, 'A filial não tem tempo de preparo base configurado.', {
          detail: 'A filial não tem tempo de preparo base configurado.',
        }),
      ),
    ).toBe('base-missing');

    expect(
      classifyPrepTimeFailure(
        new ApiError(409, 'A filial está fechada agora.', {
          detail: 'A filial está fechada agora.',
        }),
      ),
    ).toBe('branch-closed');
  });

  it('lê o código aninhado em detail e em error', () => {
    expect(
      classifyPrepTimeFailure(new ApiError(409, 'x', { detail: { code: 'BRANCH_CLOSED' } })),
    ).toBe('branch-closed');
    expect(
      classifyPrepTimeFailure(new ApiError(409, 'x', { error: { code: 'prep_time_missing' } })),
    ).toBe('base-missing');
  });

  // O padrão é o lado seguro: sem certeza, só mostra a mensagem.
  it('409 que não dá para classificar não abre o campo de base', () => {
    expect(classifyPrepTimeFailure(new ApiError(409, 'Não deu.', null))).toBe('other');
    expect(classifyPrepTimeFailure(new ApiError(409, 'x', { code: 'SOMETHING_ELSE' }))).toBe(
      'other',
    );
  });

  it('só 409 é classificado; o resto é other', () => {
    expect(classifyPrepTimeFailure(new ApiError(422, 'x', { code: 'PREP_TIME_NOT_SET' }))).toBe(
      'other',
    );
    expect(classifyPrepTimeFailure(new ApiError(500, 'x', null))).toBe('other');
    expect(classifyPrepTimeFailure(networkError())).toBe('other');
    expect(classifyPrepTimeFailure(new Error('qualquer'))).toBe('other');
    expect(classifyPrepTimeFailure(null)).toBe('other');
  });
});

describe('formatação do tempo de preparo', () => {
  it('mostra a faixa como o lojista fala', () => {
    expect(formatPrepRange({ prep_time_min: 25, prep_time_max: 35 })).toBe('25–35 min');
    expect(formatPrepRange({ prep_time_min: 30, prep_time_max: 30 })).toBe('30 min');
    expect(formatPrepRange(null)).toBe('—');
  });

  it('usa sinal de menos de verdade, não hífen', () => {
    expect(formatDelta(5)).toBe('+5');
    expect(formatDelta(-5)).toBe('−5');
  });
});

describe('checkCancelReason', () => {
  it('aceita motivo dentro dos limites e devolve já aparado', () => {
    const check = checkCancelReason('  Cliente desistiu  ');
    expect(check).toEqual({ valid: true, reason: 'Cliente desistiu' });
  });

  // Campo vazio não é erro a mostrar: é só o botão travado.
  it('campo vazio não gera mensagem', () => {
    expect(checkCancelReason('')).toEqual({ valid: false, message: null });
    expect(checkCancelReason('    ')).toEqual({ valid: false, message: null });
  });

  it('recusa abaixo de 3 e acima de 300 caracteres', () => {
    const curto = checkCancelReason('ok');
    expect(curto.valid).toBe(false);
    expect(curto.valid === false && curto.message).toContain('3 caracteres');

    const longo = checkCancelReason('a'.repeat(301));
    expect(longo.valid).toBe(false);
    expect(longo.valid === false && longo.message).toContain('300');
  });

  it('conta o motivo já aparado, não os espaços', () => {
    expect(checkCancelReason(`   ${'a'.repeat(300)}   `).valid).toBe(true);
  });
});

/*
 * A PROMESSA QUE CHEGA AO CLIENTE. Os botões de +5/+10/−5 ajustavam um prazo
 * sem nada na tela dizendo que ele é UMA das duas parcelas do que o cliente lê.
 */
describe('promessaAoCliente', () => {
  it('soma ponta com ponta: mínimo com mínimo, máximo com máximo', () => {
    expect(
      promessaAoCliente({ prep_time_min: 25, prep_time_max: 35 }, { min: 30, max: 45 }),
    ).toEqual({ prep_time_min: 55, prep_time_max: 80 });
  });

  it('acompanha o empurrão do preparo — é isso que a linha ensina', () => {
    const depoisDoMais10 = promessaAoCliente(
      { prep_time_min: 35, prep_time_max: 45 },
      { min: 30, max: 45 },
    );
    expect(formatPrepRange(depoisDoMais10)).toBe('65–90 min');
  });

  /*
   * Meia conta não é conta: sem a entrega, mostrar só o preparo prometeria o
   * tempo da cozinha como se fosse o da porta — o erro que a linha desfaz.
   */
  it('não existe sem as duas pontas', () => {
    expect(promessaAoCliente(null, { min: 30, max: 45 })).toBeNull();
    expect(promessaAoCliente({ prep_time_min: 25, prep_time_max: 35 }, null)).toBeNull();
  });
});
