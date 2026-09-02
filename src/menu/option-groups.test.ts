import { describe, expect, it } from 'vitest';

import type { ProductOptionGroup } from '../api/types';
import {
  GRUPO_DESCRICAO_MAX,
  GRUPO_NOME_MAX,
  checkGrupo,
  checkOpcao,
  corpoDoGrupo,
  grupoDraftDe,
  grupoVazio,
  opcaoVazia,
  regraDoGrupo,
} from './option-groups';

function grupo(overrides: Partial<ProductOptionGroup> = {}): ProductOptionGroup {
  return {
    id: 'grp-1',
    product_id: 'prod-1',
    name: 'Tamanho',
    description: null,
    is_required: true,
    is_active: true,
    min_select: 1,
    max_select: 1,
    sort_order: 0,
    options: [],
    ...overrides,
  } as ProductOptionGroup;
}

describe('checkGrupo', () => {
  it('o grupo em branco trava o botão sem acusar erro', () => {
    expect(checkGrupo(grupoVazio())).toEqual({ valid: false, message: null });
  });

  it('aceita o grupo opcional mais simples: 0 a 1, sem obrigatoriedade', () => {
    const check = checkGrupo({ ...grupoVazio(), name: 'Adicionais', maxSelect: '5' });
    expect(check).toEqual({
      valid: true,
      grupo: {
        name: 'Adicionais',
        description: null,
        is_required: false,
        is_active: true,
        min_select: 0,
        max_select: 5,
        sort_order: 0,
      },
    });
  });

  /*
   * AS DUAS REGRAS CRUZADAS DO BACKEND, e NENHUMA DAS DUAS SAI NO /openapi.json:
   * o contrato publica `min_select` e `max_select` como inteiros soltos. Elas
   * estão no `model_validator` de `AdminOptionGroupFields`, e sem elas o lojista
   * levaria 422 depois de preencher o formulário inteiro.
   */
  it('recusa máximo menor que o mínimo', () => {
    const check = checkGrupo({
      ...grupoVazio(),
      name: 'Sabores',
      minSelect: '3',
      maxSelect: '2',
    });
    expect(check.valid).toBe(false);
    expect(check.valid === false && check.message).toContain('máximo');
  });

  it('recusa grupo obrigatório com mínimo zero, e explica o que fazer', () => {
    const check = checkGrupo({
      ...grupoVazio(),
      name: 'Tamanho',
      isRequired: true,
      minSelect: '0',
    });
    expect(check.valid).toBe(false);
    expect(check.valid === false && check.message).toContain('obrigatório');
  });

  it('aceita obrigatório com mínimo 1', () => {
    const check = checkGrupo({
      ...grupoVazio(),
      name: 'Tamanho',
      isRequired: true,
      minSelect: '1',
      maxSelect: '1',
    });
    expect(check.valid).toBe(true);
  });

  it('recusa máximo zero: um grupo que não deixa escolher nada não é grupo', () => {
    const check = checkGrupo({ ...grupoVazio(), name: 'Nada', maxSelect: '0' });
    expect(check.valid).toBe(false);
  });

  it('recusa número que não é número, e mínimo negativo', () => {
    expect(checkGrupo({ ...grupoVazio(), name: 'X', maxSelect: 'dois' }).valid).toBe(false);
    expect(checkGrupo({ ...grupoVazio(), name: 'X', minSelect: '-1' }).valid).toBe(false);
    expect(checkGrupo({ ...grupoVazio(), name: 'X', maxSelect: '1,5' }).valid).toBe(false);
  });

  it('cobra os tetos de texto do backend antes de o backend cobrá-los', () => {
    expect(checkGrupo({ ...grupoVazio(), name: 'x'.repeat(GRUPO_NOME_MAX + 1) }).valid).toBe(false);
    expect(
      checkGrupo({
        ...grupoVazio(),
        name: 'X',
        description: 'd'.repeat(GRUPO_DESCRICAO_MAX + 1),
      }).valid,
    ).toBe(false);
  });

  /* Descrição vazia vira `null`, não string vazia: são coisas diferentes. */
  it('descrição em branco vai como null', () => {
    const check = checkGrupo({ ...grupoVazio(), name: 'X', description: '   ' });
    expect(check.valid === true && check.grupo.description).toBeNull();
  });
});

describe('corpoDoGrupo', () => {
  /*
   * O PATCH LEVA O FORMULÁRIO INTEIRO, e isso é decisão.
   *
   * O backend valida o RESULTADO DA MESCLA com o que está no banco — um PATCH
   * que mandasse só `is_required: true` num grupo com `min_select: 0` seria 422
   * vindo de campos que a tela nem mostrou. Mandando tudo, o que o painel
   * validou é exatamente o que o backend vai validar.
   */
  it('manda os sete campos, e não só o que mudou', () => {
    const check = checkGrupo({
      ...grupoVazio(),
      name: 'Tamanho',
      isRequired: true,
      minSelect: '1',
    });
    expect(check.valid).toBe(true);
    if (!check.valid) return;
    expect(Object.keys(corpoDoGrupo(check.grupo)).sort()).toEqual([
      'description',
      'is_active',
      'is_required',
      'max_select',
      'min_select',
      'name',
      'sort_order',
    ]);
  });
});

describe('grupoDraftDe', () => {
  it('leva o grupo da API para o formulário, com os números como texto', () => {
    expect(
      grupoDraftDe(grupo({ description: 'Escolha um', min_select: 1, max_select: 2 })),
    ).toEqual({
      name: 'Tamanho',
      description: 'Escolha um',
      isRequired: true,
      isActive: true,
      minSelect: '1',
      maxSelect: '2',
      sortOrder: 0,
    });
  });

  /*
   * ESTE CASO MUDOU DE FORMA no mesmo dia em que foi escrito, e a lição é
   * minha: ele dizia "nulo vira 0, não NaN" e prendia o `?? 0` do código.
   *
   * "Não vira NaN" era a preocupação certa; ZERO era a resposta errada — zero é
   * a PRIMEIRA posição, e editar o nome de um grupo sem posição o mandava para
   * a frente do cardápio. O nulo agora atravessa intacto, e o requisito
   * original continua coberto: o que sai não é `NaN`.
   */
  it('sort_order nulo atravessa intacto — não vira 0 nem NaN', () => {
    const draft = grupoDraftDe(grupo({ sort_order: null }));
    expect(draft.sortOrder).toBeNull();
    expect(Number.isNaN(draft.sortOrder as number)).toBe(false);
  });
});

describe('checkOpcao', () => {
  it('a opção em branco trava sem acusar', () => {
    expect(checkOpcao(opcaoVazia())).toEqual({ valid: false, message: null });
  });

  it('sem preço digitado o adicional é zero — que é o caso comum', () => {
    expect(checkOpcao({ ...opcaoVazia(), name: 'Bacon' })).toEqual({
      valid: true,
      opcao: {
        name: 'Bacon',
        description: null,
        additional_price: 0,
        is_active: true,
        sort_order: 0,
      },
    });
  });

  it('aceita vírgula, como todo campo de dinheiro do painel', () => {
    const check = checkOpcao({ ...opcaoVazia(), name: 'Bacon', price: '3,50' });
    expect(check.valid === true && check.opcao.additional_price).toBe(3.5);
  });

  it('recusa preço que não é número', () => {
    const check = checkOpcao({ ...opcaoVazia(), name: 'Bacon', price: 'grátis' });
    expect(check.valid).toBe(false);
    expect(check.valid === false && check.message).toContain('preço');
  });

  /* `ge=0` no Pydantic, e também não sai no contrato. */
  it('recusa preço negativo', () => {
    expect(checkOpcao({ ...opcaoVazia(), name: 'Bacon', price: '-1' }).valid).toBe(false);
  });

  /*
   * A OPÇÃO NOVA ENTRA NO FIM DO GRUPO. Sem a posição, toda opção nasceria com
   * `sort_order: 0` e a ordem da lista viraria a do banco — e "Pequena, Média,
   * Grande" viraria a ordem em que alguém as digitou em dias diferentes.
   */
  it('entra na posição que o grupo passar', () => {
    const check = checkOpcao({ ...opcaoVazia(), name: 'Grande' }, 2);
    expect(check.valid === true && check.opcao.sort_order).toBe(2);
  });
});

describe('regraDoGrupo', () => {
  /*
   * A FRASE DA LINHA, e ela é o que o lojista lê para saber o que configurou.
   * "obrigatório · escolhe de 1 a 1" é verdade e não se entende; "Escolha 1"
   * é a mesma coisa em português.
   */
  it('o obrigatório de escolha única é "Escolha 1"', () => {
    expect(regraDoGrupo(grupo({ is_required: true, min_select: 1, max_select: 1 }))).toBe(
      'Obrigatório · escolha 1',
    );
  });

  it('o obrigatório de faixa diz a faixa', () => {
    expect(regraDoGrupo(grupo({ is_required: true, min_select: 1, max_select: 3 }))).toBe(
      'Obrigatório · escolha de 1 a 3',
    );
  });

  it('o opcional diz até quantos, porque o mínimo é zero', () => {
    expect(regraDoGrupo(grupo({ is_required: false, min_select: 0, max_select: 5 }))).toBe(
      'Opcional · até 5',
    );
  });

  it('o grupo desativado diz isso antes de tudo, porque é o que explica a tela', () => {
    expect(regraDoGrupo(grupo({ is_active: false }))).toContain('Desativado');
  });
});

/* ==========================================================================
 * `sort_order` DO GRUPO — dois defeitos meus, da mesma família do `?? 0`
 * ======================================================================= */

describe('a posição do grupo', () => {
  /*
   * O comentário dizia "nulo é o fim da lista" e o código escrevia `?? 0`, que
   * é o COMEÇO. Editar o nome de um grupo sem posição o mandava para a frente
   * da lista, sem ninguém ter arrastado nada — e o comentário garantia que a
   * próxima pessoa não olharia.
   */
  it('editar um grupo sem posição não o move para a frente', () => {
    const draft = grupoDraftDe(grupo({ sort_order: null }));
    expect(draft.sortOrder).toBeNull();

    const check = checkGrupo(draft);
    expect(check.valid).toBe(true);
    expect(check.valid === true && check.grupo.sort_order).toBeNull();
  });

  it('a posição gravada é preservada na edição', () => {
    const draft = grupoDraftDe(grupo({ sort_order: 3 }));
    const check = checkGrupo(draft);
    expect(check.valid === true && check.grupo.sort_order).toBe(3);
  });

  /*
   * E o grupo NOVO entra no fim, como a opção nova entra no fim do grupo.
   * `grupoVazio()` fixava zero, então dois grupos criados em seguida nasciam
   * empatados na primeira posição.
   */
  it('o grupo novo entra na posição que o produto passar', () => {
    expect(grupoVazio(2).sortOrder).toBe(2);
    const check = checkGrupo({ ...grupoVazio(2), name: 'Adicionais' });
    expect(check.valid === true && check.grupo.sort_order).toBe(2);
  });

  it('sem posição passada, o grupo novo é o primeiro — que é o caso do produto vazio', () => {
    expect(grupoVazio().sortOrder).toBe(0);
  });
});
