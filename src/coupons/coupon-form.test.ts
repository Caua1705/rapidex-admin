import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/errors';
import type { CouponTemplate } from '../api/types';
import { errosDaResposta, temErro, validarRascunho } from './coupon-form';
import { rascunhoNovo, type CouponDraft } from './coupon-model';

function arte(overrides: Partial<CouponTemplate> = {}): CouponTemplate {
  return {
    id: 'arte-10',
    name: '10% OFF',
    image_path: null,
    image_url: null,
    discount_type: 'percent',
    discount_value: '10.00',
    sort_order: 1,
    ...overrides,
  };
}

function rascunho(overrides: Partial<CouponDraft> = {}): CouponDraft {
  return {
    ...rascunhoNovo('2026-09-01'),
    templateId: 'arte-10',
    title: 'Setembro',
    code: 'SETEMBRO',
    validFrom: '2026-09-01',
    validUntil: '2026-09-30',
    ...overrides,
  };
}

/* ==========================================================================
 * O QUE A TELA CONFERE ANTES DE MANDAR
 * ======================================================================= */

describe('a validação do formulário', () => {
  it('deixa passar o rascunho completo', () => {
    expect(temErro(validarRascunho(rascunho(), arte()))).toBe(false);
  });

  it('cobra a arte, que é quem fixa o desconto', () => {
    const erros = validarRascunho(rascunho({ templateId: '' }), null);
    expect(erros.campos.templateId).toBeTruthy();
  });

  /*
   * O CÓDIGO DEIXOU DE SER COBRADO em 28/08/2026, e o vazio passou a ter
   * significado: o cupom aplica sozinho no checkout. A tela que continuasse
   * cobrando o campo estaria proibindo a campanha automática inteira.
   */
  it('deixa passar sem código — o vazio é o cupom que aplica sozinho', () => {
    expect(temErro(validarRascunho(rascunho({ code: '' }), arte()))).toBe(false);
    expect(temErro(validarRascunho(rascunho({ code: '   ' }), arte()))).toBe(false);
  });

  /*
   * PRIVADO SEM CÓDIGO É A ÚNICA REGRA DESTE ARQUIVO SEM PAR NO BACKEND, e por
   * isso ela precisa existir aqui: as duas metades são válidas separadamente e
   * a combinação grava, responde 201 e some. O resgate procura a campanha PELO
   * CÓDIGO, e `_can_see` só libera um cupom privado que tenha resgate gravado —
   * sem código não há como resgatar, e o automático não salva porque passa pelo
   * mesmo `evaluate`.
   */
  it('recusa privado sem código, que é a campanha que não chega a ninguém', () => {
    const erros = validarRascunho(rascunho({ visibility: 'private', code: '' }), arte());
    expect(erros.campos.code).toContain('só chega a quem digita');
  });

  it('privado COM código passa, e público sem código também', () => {
    expect(
      temErro(validarRascunho(rascunho({ visibility: 'private', code: 'NATAL10' }), arte())),
    ).toBe(false);
    expect(temErro(validarRascunho(rascunho({ visibility: 'public', code: '' }), arte()))).toBe(
      false,
    );
  });

  /* Espelha o CHECK `ck_restaurant_coupons_segment_needs_target`. O sentido
     contrário (alvo fora de segmento) não é conferido porque a tela o torna
     impossível: o seletor some e `bodyFrom` zera o campo. */
  it('cobra a classe quando a visibilidade é por segmento', () => {
    const erros = validarRascunho(rascunho({ visibility: 'segment', targetSegment: '' }), arte());
    expect(erros.campos.targetSegment).toBeTruthy();

    const completo = rascunho({ visibility: 'segment', targetSegment: 'fiel' });
    expect(temErro(validarRascunho(completo, arte()))).toBe(false);
  });

  it('recusa a data final anterior à inicial', () => {
    const erros = validarRascunho(rascunho({ validUntil: '2026-08-31' }), arte());
    expect(erros.campos.validUntil).toBeTruthy();
  });

  /*
   * O DETALHE QUE QUASE VIROU BUG: o backend compara INSTANTES, e uma campanha
   * de um dia só vai de 00:00:00 a 23:59:59 do mesmo dia — `valid_until`
   * continua maior. Recusar aqui proibiria uma campanha legítima.
   */
  it('aceita a campanha de um dia só', () => {
    const erros = validarRascunho(rascunho({ validUntil: '2026-09-01' }), arte());
    expect(erros.campos.validUntil).toBeUndefined();
  });

  it('recusa limite zero, que o backend recusaria com ge=1', () => {
    expect(
      validarRascunho(rascunho({ totalUsageLimit: '0' }), arte()).campos.totalUsageLimit,
    ).toBeTruthy();
  });

  it('vazio é sem limite, e não erro', () => {
    const erros = validarRascunho(
      rascunho({ totalUsageLimit: '', usageLimitPerCustomer: '', cooldownDays: '' }),
      arte(),
    );
    expect(temErro(erros)).toBe(false);
  });

  /*
   * Espelha o CHECK `restaurant_coupons_reuse_rules_valid`. Quem usa uma vez na
   * vida não tem segunda vez a esperar — e o banco recusava sem dizer qual dos
   * dois campos estava sobrando.
   */
  it('recusa intervalo entre usos com um uso por cliente', () => {
    const erros = validarRascunho(
      rascunho({ cooldownDays: '7', usageLimitPerCustomer: '1' }),
      arte(),
    );
    expect(erros.campos.cooldownDays).toBeTruthy();
  });

  it('o mesmo intervalo passa com dois usos por cliente', () => {
    const erros = validarRascunho(
      rascunho({ cooldownDays: '7', usageLimitPerCustomer: '2' }),
      arte(),
    );
    expect(erros.campos.cooldownDays).toBeUndefined();
  });

  /*
   * O CAMPO DE TETO NÃO EXISTE FORA DE PERCENTUAL, então validá-lo ali travaria
   * o salvamento por um campo invisível — não há nada na tela para consertar.
   * Quem limpa o valor é `bodyFrom`.
   */
  it('não valida o teto quando a arte não é percentual', () => {
    const erros = validarRascunho(
      rascunho({ maxDiscountAmount: 'nem número é' }),
      arte({ discount_type: 'fixed', discount_value: '5.00' }),
    );
    expect(erros.campos.maxDiscountAmount).toBeUndefined();
  });
});

/* ==========================================================================
 * O QUE VOLTA DO BACKEND
 * ======================================================================= */

describe('a tradução da recusa da API', () => {
  /*
   * OS DOIS 409 TÊM CAMPOS DIFERENTES, e separá-los é a razão de
   * `_raise_conflict` existir no backend: quem esbarrava na arte repetida lia
   * "código já existe", trocava o código, tomava o mesmo erro de novo e não
   * tinha como sair do lugar.
   */
  it('409 de código destaca o código', () => {
    const erro = new ApiError(409, 'x', { detail: 'Codigo de cupom ja existe neste restaurante' });
    const erros = errosDaResposta(erro);

    expect(erros.campos.code).toBeTruthy();
    expect(erros.campos.templateId).toBeUndefined();
  });

  it('409 de arte destaca a ARTE, e diz que mexer no código não resolve', () => {
    const erro = new ApiError(409, 'x', {
      detail: 'Esta arte ja esta em uso por outra campanha deste restaurante',
    });
    const erros = errosDaResposta(erro);

    expect(erros.campos.templateId).toContain('código não resolve');
    expect(erros.campos.code).toBeUndefined();
  });

  /* O 400 da arte desativada vem ANTES do 422 de tipo, de propósito: não
     adianta conferir a concordância de uma arte que saiu do catálogo. */
  it('400 de template inválido manda escolher outra arte', () => {
    const erro = new ApiError(400, 'x', { detail: 'Template de cupom invalido' });
    expect(errosDaResposta(erro).campos.templateId).toBeTruthy();
  });

  it('422 aponta o campo pelo loc[1]', () => {
    const erro = new ApiError(422, 'x', {
      detail: [{ loc: ['body', 'code'], msg: 'String should have at most 100 characters' }],
    });

    expect(errosDaResposta(erro).campos.code).toBe('String should have at most 100 characters');
  });

  /*
   * OS DOIS SENTIDOS DO CHECK DE SEGMENTO APONTAM CAMPOS DIFERENTES, e é a
   * razão de haver duas regras em vez de uma: o que sobra num cupom público não
   * é a classe, é a visibilidade que deixou de ser "por segmento". Mandar o
   * lojista apagar a classe seria mandá-lo desfazer a metade errada.
   */
  it('422 de segmento sem alvo destaca a CLASSE', () => {
    const erro = new ApiError(422, 'x', {
      detail: [{ loc: ['body'], msg: 'Value error, cupom de segmento precisa de target_segment' }],
    });

    expect(errosDaResposta(erro).campos.targetSegment).toBeTruthy();
    expect(errosDaResposta(erro).campos.visibility).toBeUndefined();
  });

  it('422 de alvo sobrando destaca a VISIBILIDADE', () => {
    const erro = new ApiError(422, 'x', {
      detail: [
        { loc: ['body'], msg: 'Value error, target_segment só vale com visibility = segment' },
      ],
    });

    expect(errosDaResposta(erro).campos.visibility).toBeTruthy();
    expect(errosDaResposta(erro).campos.targetSegment).toBeUndefined();
  });

  /*
   * `discount_type` APONTA PARA A ARTE. O 422 de `_ensure_template_agrees` fala
   * de um campo que esta tela não tem — mandar o lojista procurá-lo seria o
   * mesmo defeito dos dois 409 antes de eles serem separados.
   */
  it('422 de tipo de desconto destaca a arte, não um campo inexistente', () => {
    const erro = new ApiError(422, 'x', {
      detail: [
        {
          loc: ['body', 'discount_type'],
          msg: 'Tipo de desconto do cupom (percent) nao confere com o do template (fixed)',
        },
      ],
    });

    expect(errosDaResposta(erro).campos.templateId).toBeTruthy();
  });

  /*
   * As quatro regras do `model_validator` chegam com `loc: ["body"]` e mais
   * nada — sem esta tradução elas cairiam no rodapé, escritas no vocabulário do
   * contrato ("valid_until deve ser posterior a valid_from") em vez do de quem
   * está olhando dois campos chamados "Começa em" e "Termina em".
   */
  it('regra do objeto inteiro vira erro do campo certo', () => {
    const erro = new ApiError(422, 'x', {
      detail: [{ loc: ['body'], msg: 'valid_until deve ser posterior a valid_from' }],
    });
    const erros = errosDaResposta(erro);

    expect(erros.campos.validUntil).toBe('A data final precisa ser depois da inicial.');
    expect(erros.geral).toBeNull();
  });

  it('o intervalo com um uso por cliente também acha o campo', () => {
    const erro = new ApiError(422, 'x', {
      detail: [
        { loc: ['body'], msg: 'cooldown_days nao faz sentido com usage_limit_per_customer = 1' },
      ],
    });

    expect(errosDaResposta(erro).campos.cooldownDays).toBeTruthy();
  });

  it('o que não se sabe apontar vai para o aviso geral, e não some', () => {
    const erro = new ApiError(500, 'O servidor falhou (500). Tente de novo em instantes.', null);
    const erros = errosDaResposta(erro);

    expect(erros.campos).toEqual({});
    expect(erros.geral).toContain('500');
  });
});
