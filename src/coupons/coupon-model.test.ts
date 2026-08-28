import { describe, expect, it } from 'vitest';

import type { Coupon, CouponTemplate } from '../api/types';
import {
  arteDesativada,
  artesDisponiveis,
  bodyFrom,
  contarArtes,
  descontoDoCupom,
  diaDaOperacao,
  fimDoDia,
  inicioDoDia,
  rascunhoDe,
  rascunhoNovo,
  situacaoDoCupom,
  textoDeQuemVe,
  textoDeUso,
  textoDoCodigo,
  tipoDaArte,
} from './coupon-model';

function arte(overrides: Partial<CouponTemplate> = {}): CouponTemplate {
  return {
    id: 'arte-10',
    name: '10% OFF',
    image_path: 'coupon-10-percent-off.png',
    image_url: 'https://bucket/coupon-10-percent-off.png',
    discount_type: 'percent',
    discount_value: '10.00',
    sort_order: 1,
    ...overrides,
  };
}

function cupom(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'cupom-1',
    restaurant_id: 'rest-1',
    coupon_template_id: 'arte-10',
    code: 'PROMO10',
    title: 'Dez por cento',
    description: null,
    discount_type: 'percent',
    discount_value: '10.00',
    max_discount_amount: null,
    min_order_value: '0.00',
    valid_from: '2026-08-01T03:00:00Z',
    valid_until: '2026-09-01T02:59:59Z',
    total_usage_limit: null,
    usage_limit_per_customer: null,
    cooldown_days: null,
    first_order_only: false,
    visibility: 'public',
    target_segment: null,
    is_active: true,
    total_usage_count: 0,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

const RASCUNHO = {
  ...rascunhoNovo('2026-09-01'),
  templateId: 'arte-10',
  title: 'Setembro',
  code: 'setembro',
  validUntil: '2026-09-30',
};

/* ==========================================================================
 * A TRAVA — a razão de a tela existir
 * ======================================================================= */

describe('o desconto vem da arte, nunca do rascunho', () => {
  /*
   * ESTE É O TESTE MAIS IMPORTANTE DO ARQUIVO.
   *
   * O backend confere o TIPO contra o template e NÃO confere o valor
   * (`_ensure_template_agrees` só olha `discount_type`). Um corpo com a arte de
   * 10% e `discount_value: 7` grava, anuncia 10% na vitrine e desconta 7% no
   * checkout — "nada falha, nada é logado, e quem descobre é o cliente na tela
   * de pagamento".
   */
  it('copia tipo e valor do template escolhido', () => {
    const body = bodyFrom(RASCUNHO, arte({ discount_value: '10.00' }));

    expect(body).toMatchObject({
      coupon_template_id: 'arte-10',
      discount_type: 'percent',
      discount_value: '10.00',
    });
  });

  it('frete grátis vai com valor zero, e não com o nulo do template', () => {
    const body = bodyFrom(
      { ...RASCUNHO, templateId: 'arte-frete' },
      arte({ id: 'arte-frete', discount_type: 'free_delivery', discount_value: null }),
    );

    expect(body).toMatchObject({ discount_type: 'free_delivery', discount_value: '0.00' });
  });

  it('recusa arte de tipo desconhecido em vez de mandar um corpo torto', () => {
    expect(bodyFrom(RASCUNHO, arte({ discount_type: 'cashback_turbo' }))).toBeNull();
    expect(tipoDaArte(arte({ discount_type: 'cashback_turbo' }))).toBeNull();
  });
});

describe('o teto de desconto', () => {
  it('atravessa em arte percentual', () => {
    const body = bodyFrom({ ...RASCUNHO, maxDiscountAmount: '15,00' }, arte());
    expect(body?.max_discount_amount).toBe('15.00');
  });

  /*
   * O CAMPO SOME DA TELA FORA DE PERCENTUAL, mas o rascunho pode carregar o
   * texto de antes: trocar a arte de 20% por uma de R$ 5 mandaria o teto junto
   * e o backend responderia 422 sobre um campo que o lojista não vê mais. A
   * limpeza mora no corpo, e não só na tela.
   */
  it('é zerado fora de percentual, mesmo com o rascunho preenchido', () => {
    const body = bodyFrom(
      { ...RASCUNHO, maxDiscountAmount: '15,00' },
      arte({ discount_type: 'fixed', discount_value: '5.00' }),
    );

    expect(body?.max_discount_amount).toBeNull();
  });
});

describe('o corpo', () => {
  it('manda dinheiro como string de duas casas', () => {
    const body = bodyFrom({ ...RASCUNHO, minOrderValue: '60,1' }, arte());
    expect(body?.min_order_value).toBe('60.10');
  });

  it('normaliza o código para maiúsculas e sem espaço', () => {
    const body = bodyFrom({ ...RASCUNHO, code: '  setembro  ' }, arte());
    expect(body?.code).toBe('SETEMBRO');
  });

  it('manda null explícito no que ficou vazio, em vez de omitir o campo', () => {
    const body = bodyFrom({ ...RASCUNHO, totalUsageLimit: '', cooldownDays: '' }, arte());

    /* Omitir faria o PATCH manter o limite antigo: o lojista apagaria "100" na
       tela e continuaria com 100 gravado. */
    expect(body).toMatchObject({ total_usage_limit: null, cooldown_days: null });
    expect('total_usage_limit' in (body ?? {})).toBe(true);
  });

  /*
   * O CÓDIGO VAZIO SOBE COMO `null`, e não como `""`.
   *
   * É o que liga o desconto automático: `auto_apply_for_order` procura os
   * cupons `code IS NULL`. Uma string vazia não é nenhum dos dois — o backend
   * a recusa de propósito ("code não pode ser só espaços; omita o campo"),
   * porque a diferença decide comportamento de produto.
   */
  it('código vazio vira null, que é o que faz o cupom aplicar sozinho', () => {
    expect(bodyFrom({ ...RASCUNHO, code: '' }, arte())?.code).toBeNull();
    expect(bodyFrom({ ...RASCUNHO, code: '   ' }, arte())?.code).toBeNull();
  });

  /*
   * No PATCH, `null` EXPLÍCITO é o que TIRA o código de uma campanha que tinha
   * um. `exclude_unset=True` do outro lado: campo ausente preserva o gravado, e
   * o lojista apagaria "SETEMBRO" na tela para continuar com SETEMBRO no banco.
   */
  it('o código nulo vai no corpo em vez de sumir dele', () => {
    const body = bodyFrom({ ...RASCUNHO, code: '' }, arte());
    expect('code' in (body ?? {})).toBe(true);
  });

  it('manda a visibilidade escolhida, e o alvo junto quando é por segmento', () => {
    const body = bodyFrom(
      { ...RASCUNHO, visibility: 'segment', targetSegment: 'em_risco' },
      arte(),
    );
    expect(body).toMatchObject({ visibility: 'segment', target_segment: 'em_risco' });
  });

  /*
   * O CHECK do banco vale nos DOIS sentidos — `(visibility = 'segment') =
   * (target_segment IS NOT NULL)` —, e o Pydantic o espelha. O rascunho pode
   * carregar a classe de uma escolha anterior: sem esta zeragem, voltar para
   * "Público" mandaria `target_segment` junto e o 422 apontaria um seletor que
   * a tela parou de mostrar.
   */
  it('zera o alvo fora de "por segmento", mesmo com a classe no rascunho', () => {
    const publico = bodyFrom(
      { ...RASCUNHO, visibility: 'public', targetSegment: 'fiel' },
      arte(),
    );
    const privado = bodyFrom(
      { ...RASCUNHO, visibility: 'private', targetSegment: 'fiel' },
      arte(),
    );

    expect(publico?.target_segment).toBeNull();
    expect(privado?.target_segment).toBeNull();
  });
});

/* ==========================================================================
 * DATA: o lojista pensa em dia, o contrato pede instante
 * ======================================================================= */

describe('a conversão de dia para instante', () => {
  it('abre o dia à meia-noite da operação, não do UTC', () => {
    expect(inicioDoDia('2026-09-01')).toBe('2026-09-01T00:00:00-03:00');
  });

  /*
   * A ARMADILHA CARA: `valid_until` é comparado com `>` no backend, então
   * `2026-09-30T00:00:00` faz o cupom "até 30/09" morrer à meia-noite que ABRE
   * o dia 30 — perde-se o último dia inteiro da campanha.
   */
  it('fecha o dia no último segundo dele', () => {
    expect(fimDoDia('2026-09-30')).toBe('2026-09-30T23:59:59-03:00');
  });

  it('a volta lê o dia da operação, e não o do navegador', () => {
    /* 02:59:59Z é 23:59:59 do dia ANTERIOR em Fortaleza. Lido no fuso errado,
       o painel mostraria a campanha durando um dia a mais. */
    expect(diaDaOperacao('2026-10-01T02:59:59Z')).toBe('2026-09-30');
  });

  it('o rascunho de edição volta com os dias que o lojista escolheu', () => {
    const draft = rascunhoDe(
      cupom({ valid_from: '2026-09-01T03:00:00Z', valid_until: '2026-10-01T02:59:59Z' }),
    );

    expect(draft.validFrom).toBe('2026-09-01');
    expect(draft.validUntil).toBe('2026-09-30');
  });

  it('mínimo zero abre o campo vazio, e não com "0,00" escrito', () => {
    expect(rascunhoDe(cupom({ min_order_value: '0.00' })).minOrderValue).toBe('');
    expect(rascunhoDe(cupom({ min_order_value: '60.00' })).minOrderValue).toBe('60,00');
  });
});

/* ==========================================================================
 * QUEM VÊ, E COMO O CLIENTE CHEGA
 * ======================================================================= */

describe('a coluna "Quem vê"', () => {
  it('nomeia as visibilidades sem alvo pelo rótulo delas', () => {
    expect(textoDeQuemVe(cupom({ visibility: 'public' }))).toBe('Público');
    expect(textoDeQuemVe(cupom({ visibility: 'private' }))).toBe('Privado');
  });

  /*
   * "Por segmento" sozinho não responde à pergunta que a coluna existe para
   * responder: duas campanhas segmentadas lado a lado, uma para "Fiel" e outra
   * para "Perdido", apareceriam idênticas.
   */
  it('a campanha por segmento mostra a CLASSE, e não o rótulo genérico', () => {
    const alvo = cupom({ visibility: 'segment', target_segment: 'em_risco' });
    expect(textoDeQuemVe(alvo)).toBe('Em risco');
  });

  /* Uma sexta classe RFV na plataforma chegaria sem par em `SEGMENT_LABEL`.
     Sobra o rótulo da visibilidade, que continua verdadeiro — nunca `undefined`
     escrito na célula. */
  it('classe desconhecida cai para o rótulo da visibilidade, e não inventa nada', () => {
    const estranho = cupom({ visibility: 'segment', target_segment: null });
    expect(textoDeQuemVe(estranho)).toBe('Por segmento');
  });
});

describe('a linha do código na lista', () => {
  it('mostra o código quando ele existe', () => {
    expect(textoDoCodigo(cupom({ code: 'PROMO10' }))).toBe('PROMO10');
  });

  /*
   * Célula vazia leria como dado faltando, e o lojista procuraria o código que
   * o cupom não tem — em vez de entender que este desconto entra no pedido sem
   * ninguém digitar nada.
   */
  it('sem código ela DIZ o que o nulo significa, em vez de ficar vazia', () => {
    expect(textoDoCodigo(cupom({ code: null }))).toBe('aplica sozinho');
  });
});

/* ==========================================================================
 * A SITUAÇÃO — cinco estados, na ordem do backend
 * ======================================================================= */

describe('a situação da campanha', () => {
  const dentro = new Date('2026-08-15T12:00:00Z');

  it('ativo dentro do prazo, ligado e com vaga', () => {
    expect(situacaoDoCupom(cupom(), dentro)).toBe('ativo');
  });

  it('programado quando ainda não começou', () => {
    const antes = new Date('2026-07-01T12:00:00Z');
    expect(situacaoDoCupom(cupom(), antes)).toBe('programado');
  });

  it('expirado depois do prazo', () => {
    const depois = new Date('2026-10-01T12:00:00Z');
    expect(situacaoDoCupom(cupom(), depois)).toBe('expirado');
  });

  it('esgotado quando a contagem alcança o limite', () => {
    const cheio = cupom({ total_usage_limit: 100, total_usage_count: 100 });
    expect(situacaoDoCupom(cheio, dentro)).toBe('esgotado');
  });

  it('desligado quando o lojista desativou', () => {
    expect(situacaoDoCupom(cupom({ is_active: false }), dentro)).toBe('desligado');
  });

  /*
   * A VISIBILIDADE NÃO DESLIGA CAMPANHA NENHUMA, e este teste guarda a virada
   * de `20260828_0043`.
   *
   * Com `is_public`, o `false` caía em DESLIGADO — e caía com razão: `evaluate`
   * recusava `not_public` na prévia E no fechamento, então o cupom era inusável
   * por caminho nenhum. As três visibilidades de hoje são todas usáveis; o que
   * muda é por onde o cliente chega. Marcar "Desligado" um cupom privado diria
   * que a campanha está fora do ar quando ela está valendo para quem tem o
   * código.
   */
  it('privado e por segmento continuam ATIVOS — quem vê não é o interruptor', () => {
    expect(situacaoDoCupom(cupom({ visibility: 'private' }), dentro)).toBe('ativo');
    expect(
      situacaoDoCupom(cupom({ visibility: 'segment', target_segment: 'fiel' }), dentro),
    ).toBe('ativo');
  });

  /*
   * A ORDEM É A DE `CouponService.evaluate`. Um cupom que estourou o limite em
   * julho e venceu em agosto precisa dizer o mesmo que o checkout diria.
   */
  it('expirado vence esgotado, como no backend', () => {
    const ambos = cupom({ total_usage_limit: 10, total_usage_count: 10 });
    expect(situacaoDoCupom(ambos, new Date('2026-10-01T12:00:00Z'))).toBe('expirado');
  });

  it('desligado vence tudo', () => {
    const tudo = cupom({ is_active: false, total_usage_limit: 1, total_usage_count: 5 });
    expect(situacaoDoCupom(tudo, new Date('2026-10-01T12:00:00Z'))).toBe('desligado');
  });
});

describe('a contagem de uso', () => {
  it('pareia contagem e limite', () => {
    expect(textoDeUso(cupom({ total_usage_count: 37, total_usage_limit: 100 }))).toBe('37 de 100');
  });

  it('sem limite mostra só quantos usaram', () => {
    expect(textoDeUso(cupom({ total_usage_count: 37, total_usage_limit: null }))).toBe('37 usos');
  });

  /* O contador é opcional no contrato (o service o preenche por fora). Nulo é
     "ninguém usou" — "— de 100" faria o lojista achar que a conta quebrou. */
  it('trata contagem nula como zero', () => {
    expect(textoDeUso(cupom({ total_usage_count: null, total_usage_limit: 100 }))).toBe('0 de 100');
  });
});

describe('o texto do desconto na lista', () => {
  it('mostra o teto junto do percentual', () => {
    expect(descontoDoCupom(cupom({ discount_value: '20.00', max_discount_amount: '15.00' }))).toBe(
      '20% (até R$ 15,00)',
    );
  });

  it('enxuga o centavo inútil do percentual', () => {
    expect(descontoDoCupom(cupom({ discount_value: '10.00' }))).toBe('10%');
  });

  it('valor fixo sai como dinheiro', () => {
    expect(descontoDoCupom(cupom({ discount_type: 'fixed', discount_value: '5.00' }))).toBe(
      'R$ 5,00',
    );
  });
});

/* ==========================================================================
 * O SELETOR DE ARTE
 * ======================================================================= */

describe('as artes que sobram', () => {
  const catalogo = [
    arte({ id: 'a1', discount_type: 'percent', sort_order: 2, name: '20% OFF' }),
    arte({ id: 'a2', discount_type: 'percent', sort_order: 1, name: '10% OFF' }),
    arte({ id: 'a3', discount_type: 'fixed', name: 'R$ 5 OFF' }),
    arte({ id: 'a4', discount_type: 'free_delivery', name: 'FRETE GRÁTIS' }),
  ];

  /*
   * Existe `UNIQUE (restaurant_id, coupon_template_id)`: uma arte, uma
   * campanha. Sem este corte o lojista preenche o formulário inteiro e leva
   * 409 — e a mensagem do 409 manda mexer na ARTE, não no código.
   */
  it('esconde a arte já usada por outra campanha', () => {
    const grupos = artesDisponiveis(catalogo, [cupom({ coupon_template_id: 'a2' })]);
    const ids = grupos.flatMap((grupo) => grupo.artes.map((item) => item.id));

    expect(ids).not.toContain('a2');
    expect(ids).toEqual(expect.arrayContaining(['a1', 'a3', 'a4']));
  });

  /* A exceção da edição: sem ela o campo abriria vazio e o lojista teria de
     reescolher arte para corrigir uma data. */
  it('mantém a arte da própria campanha em edição', () => {
    const grupos = artesDisponiveis(catalogo, [cupom({ coupon_template_id: 'a2' })], 'a2');
    const ids = grupos.flatMap((grupo) => grupo.artes.map((item) => item.id));

    expect(ids).toContain('a2');
  });

  it('agrupa por tipo, na ordem percentual → fixo → frete', () => {
    const grupos = artesDisponiveis(catalogo, []);
    expect(grupos.map((grupo) => grupo.tipo)).toEqual(['percent', 'fixed', 'free_delivery']);
  });

  it('ordena por sort_order dentro do grupo', () => {
    const grupos = artesDisponiveis(catalogo, []);
    expect(grupos[0]?.artes.map((item) => item.id)).toEqual(['a2', 'a1']);
  });

  /* Um cabeçalho "Frete grátis" sem imagem embaixo anuncia o nada — a mesma
     regra do agrupamento vazio no quadro de pedidos. */
  it('não devolve grupo vazio', () => {
    const grupos = artesDisponiveis(catalogo, [cupom({ coupon_template_id: 'a4' })]);
    expect(grupos.map((grupo) => grupo.tipo)).not.toContain('free_delivery');
  });

  it('ignora arte de tipo que o painel não conhece', () => {
    const comEstranha = [...catalogo, arte({ id: 'a5', discount_type: 'cashback_turbo' })];
    expect(contarArtes(artesDisponiveis(comEstranha, []))).toBe(4);
  });
});

describe('a arte que saiu do catálogo', () => {
  /*
   * `GET /admin/coupon-templates` devolve só as ativas. Sem par na lista, a
   * campanha está pendurada numa arte desativada — e enquanto ela não trocar,
   * o backend responde 400 a QUALQUER patch, inclusive a um que só a desligue.
   */
  it('reconhece o cupom sem arte casada', () => {
    expect(arteDesativada(cupom({ coupon_template_id: 'sumiu' }), [arte()])).toBe(true);
    expect(arteDesativada(cupom({ coupon_template_id: 'arte-10' }), [arte()])).toBe(false);
  });
});
