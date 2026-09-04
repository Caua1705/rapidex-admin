import { describe, expect, it } from 'vitest';

import type { ProductOption, ProductOptionGroup } from '../api/types';
import {
  GRUPO_DESCRICAO_MAX,
  GRUPO_NOME_MAX,
  checkGrupo,
  checkOpcao,
  checkOpcaoEdicao,
  comOpcaoTrocada,
  comOpcoesDoGrupo,
  opcaoDraftDe,
  ordemDasOpcoes,
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

/*
 * ============================================================================
 * `comOpcaoTrocada` — a verdade que o PATCH devolveu, aplicada sem releitura
 * ============================================================================
 *
 * Ela existe para que a releitura que vem DEPOIS possa falhar sem desmentir a
 * gravação (ver `alternarOpcao`). Enquanto as duas dividiam um `catch`, a
 * releitura caída deixava o interruptor no estado antigo com a tela dizendo
 * erro — e o clique seguinte mandava o valor oposto, desfazendo o que tinha
 * gravado.
 */
describe('comOpcaoTrocada', () => {
  function opcao(overrides: Partial<ProductOption> = {}): ProductOption {
    return {
      id: 'opt-bacon',
      option_group_id: 'grp-adicionais',
      name: 'Bacon',
      description: null,
      additional_price: 5,
      sort_order: 0,
      is_active: true,
      ...overrides,
    };
  }

  const comOpcoes = (): ProductOptionGroup[] => [
    grupo({ id: 'grp-ponto', options: [opcao({ id: 'opt-mal', name: 'Mal passado' })] }),
    grupo({ id: 'grp-adicionais', options: [opcao()] }),
  ];

  it('troca a opção pela versão que voltou, e só ela', () => {
    const depois = comOpcaoTrocada(comOpcoes(), opcao({ is_active: false }));

    expect(depois?.[1]?.options?.[0]?.is_active).toBe(false);
    // O outro grupo não é tocado — nem a opção dele.
    expect(depois?.[0]?.options?.[0]?.is_active).toBe(true);
    expect(depois?.[0]?.options?.[0]?.id).toBe('opt-mal');
  });

  /*
   * `null` ENTRA E SAI `null`. Sem lista lida não há o que trocar, e inventar um
   * grupo aqui apagaria a distinção entre "não tem complemento" e "não deu para
   * ler" — que é o §6 de `ausencia.md`, e custou um e2e para existir.
   */
  it('lista não lida continua não lida', () => {
    expect(comOpcaoTrocada(null, opcao())).toBeNull();
  });

  it('opção de outro produto não entra em grupo nenhum', () => {
    const antes = comOpcoes();
    const depois = comOpcaoTrocada(antes, opcao({ id: 'opt-de-outro-item' }));

    expect(depois).toEqual(antes);
  });

  /*
   * O GRUPO SEM `options` NÃO QUEBRA: o contrato deixa o campo opcional, e um
   * grupo recém-criado volta sem nenhuma opção dentro.
   */
  it('grupo sem opções passa intacto', () => {
    const semOpcoes = [grupo({ id: 'grp-novo', options: undefined })];
    expect(comOpcaoTrocada(semOpcoes, opcao())).toEqual(semOpcoes);
  });
});

/* ==========================================================================
 * A EDIÇÃO DA OPÇÃO
 *
 * O GRUPO já era editável e a OPÇÃO não: o lojista renomeava a pergunta e não a
 * resposta — e a resposta é a que tem preço. `PATCH /admin/options/{option_id}`
 * aceitava os cinco campos desde sempre e o painel mandava um só.
 * ======================================================================= */

describe('a opção que se edita', () => {
  function opcao(overrides: Partial<ProductOption> = {}): ProductOption {
    return {
      id: 'opt-bacon',
      option_group_id: 'grp-adicionais',
      name: 'Bacon',
      description: null,
      additional_price: 5,
      sort_order: 0,
      is_active: true,
      ...overrides,
    };
  }

  it('o rascunho sai da opção gravada, com o preço no formato do campo', () => {
    expect(opcaoDraftDe(opcao({ additional_price: 3.5, description: 'Duas fatias' }))).toEqual({
      name: 'Bacon',
      description: 'Duas fatias',
      price: '3,50',
    });
  });

  /*
   * PREÇO ZERO VIRA CAMPO VAZIO, e não "0,00".
   *
   * "Em branco não cobra nada a mais" é o que o campo promete na criação. Abrir
   * a edição com "0,00" escrito faria o lojista apagar aquilo para dizer a mesma
   * coisa — e um campo que volta diferente do que foi deixado ensina a não
   * confiar nele.
   */
  it('adicional zero abre o campo VAZIO, como na criação', () => {
    expect(opcaoDraftDe(opcao({ additional_price: 0 })).price).toBe('');
  });

  /*
   * O CORPO DA EDIÇÃO TEM TRÊS CAMPOS, e as duas ausências são decisão.
   *
   * `is_active` FICA DE FORA: `checkOpcao` devolve `is_active: true` fixo (é o
   * padrão de uma opção nova), e reusá-lo na edição RELIGARIA em silêncio a
   * opção que o lojista tinha desligado — pelo interruptor logo ao lado, na
   * mesma linha.
   *
   * `sort_order` FICA DE FORA porque quem o move são as setas. O formulário não
   * mostra posição; mandá-la seria a tela reordenando por conta própria com um
   * valor que pode ter envelhecido enquanto o formulário estava aberto.
   *
   * E ISSO SÓ É SEGURO PORQUE ESTE PATCH É PARCIAL DE VERDADE:
   * `update_option` usa `exclude_unset=True` e `AdminOptionUpdate` não tem
   * `@model_validator` — o §4.9 de `rapidex-api` (o PATCH validado sobre a
   * MESCLA, que obriga o formulário inteiro) vale para o GRUPO e não para a
   * opção.
   */
  it('manda três campos — sem `is_active` e sem `sort_order`', () => {
    const check = checkOpcaoEdicao({ name: 'Bacon', description: '', price: '4,00' });

    expect(check).toEqual({
      valid: true,
      opcao: { name: 'Bacon', description: null, additional_price: 4 },
    });
  });

  it('a validação é a MESMA da criação — um só lugar decide o que é opção válida', () => {
    expect(checkOpcaoEdicao(opcaoVazia())).toEqual({ valid: false, message: null });
    expect(checkOpcaoEdicao({ ...opcaoVazia(), name: 'Bacon', price: 'grátis' }).valid).toBe(false);
    expect(checkOpcaoEdicao({ ...opcaoVazia(), name: 'Bacon', price: '-1' }).valid).toBe(false);
    expect(checkOpcaoEdicao({ ...opcaoVazia(), name: 'x'.repeat(GRUPO_NOME_MAX + 1) }).valid).toBe(
      false,
    );
  });
});

/* ==========================================================================
 * A ORDEM DAS OPÇÕES
 *
 * `sort_order` existia e era a ordem de criação, sem controle nenhum. "Pequena,
 * Média, Grande" ficava na ordem em que alguém as digitou em dias diferentes.
 *
 * NÃO HÁ ROTA DE LOTE — só `PATCH /admin/options/{option_id}`. Mover uma opção
 * é reescrever a posição de todas as que mudaram de lugar, e é por isso que
 * esta função devolve a LISTA DE ESCRITAS e não uma lista de opções.
 * ======================================================================= */

describe('ordemDasOpcoes', () => {
  function opcao(id: string, sortOrder: number): ProductOption {
    return {
      id,
      option_group_id: 'grp-tamanho',
      name: id,
      description: null,
      additional_price: 0,
      sort_order: sortOrder,
      is_active: true,
    };
  }

  /* Vizinhas trocadas: duas escritas, e não a lista inteira. */
  it('escreve só quem mudou de posição', () => {
    const depois = [opcao('b', 1), opcao('a', 0), opcao('c', 2)];

    expect(ordemDasOpcoes(depois)).toEqual([
      { id: 'b', sort_order: 0 },
      { id: 'a', sort_order: 1 },
    ]);
  });

  it('lista já na ordem certa não gera escrita nenhuma', () => {
    expect(ordemDasOpcoes([opcao('a', 0), opcao('b', 1)])).toEqual([]);
  });

  /*
   * O CARDÁPIO ANTIGO TEM TODAS AS OPÇÕES EM ZERO — `sort_order` tinha `default: 0`
   * e ninguém nunca o escreveu. O primeiro arraste renumera o grupo inteiro, e
   * é uma vez só: essa é a diferença entre a lista ficar na ordem que o lojista
   * montou e ficar na ordem que o banco devolveu.
   */
  it('grupo legado com tudo em zero é renumerado inteiro, uma vez só', () => {
    const legado = [opcao('a', 0), opcao('b', 0), opcao('c', 0)];

    expect(ordemDasOpcoes(legado)).toEqual([
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ]);
  });

  it('opção sem posição gravada conta como fora de lugar, e não como zero', () => {
    const semPosicao = [{ ...opcao('a', 0), sort_order: null }] as ProductOption[];
    expect(ordemDasOpcoes(semPosicao)).toEqual([{ id: 'a', sort_order: 0 }]);
  });
});

/* ==========================================================================
 * A TROCA LOCAL, ENQUANTO AS ESCRITAS ACONTECEM
 * ======================================================================= */

describe('comOpcoesDoGrupo', () => {
  function opcao(id: string, sortOrder: number): ProductOption {
    return {
      id,
      option_group_id: 'grp-tamanho',
      name: id,
      description: null,
      additional_price: 0,
      sort_order: sortOrder,
      is_active: true,
    };
  }

  it('troca a lista de UM grupo e não encosta nos outros', () => {
    const antes = [
      grupo({ id: 'grp-tamanho', options: [opcao('a', 0), opcao('b', 1)] }),
      grupo({ id: 'grp-ponto', options: [opcao('mal', 0)] }),
    ];

    const depois = comOpcoesDoGrupo(antes, 'grp-tamanho', [opcao('b', 1), opcao('a', 0)]);

    expect(depois?.[0]?.options?.map((o) => o.id)).toEqual(['b', 'a']);
    expect(depois?.[1]?.options?.map((o) => o.id)).toEqual(['mal']);
  });

  /* Mesma regra de `comOpcaoTrocada`: sem lista lida não há o que trocar, e
     inventar um grupo apagaria a diferença entre "não tem" e "não deu para ler". */
  it('`null` entra e sai `null`', () => {
    expect(comOpcoesDoGrupo(null, 'grp-tamanho', [])).toBeNull();
  });
});
