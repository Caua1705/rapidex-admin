import { describe, expect, it } from 'vitest';

import type { Branch } from '../api/types';
import {
  branchesToSearch,
  catalogKeyBody,
  catalogPairingApplies,
  pairFromProduct,
  pairWith,
  twinKeyToWrite,
  type CatalogTwin,
} from './catalog-key';

function twin(overrides: Partial<CatalogTwin> = {}): CatalogTwin {
  return {
    id: 'prod-zn-9',
    name: 'Picanha na chapa',
    branchLabel: 'Zona Norte',
    key: null,
    ...overrides,
  };
}

function branch(id: string, extra: Partial<Branch> = {}): Branch {
  return { id, name: id, display_name: null, is_main: false, is_active: true, ...extra } as Branch;
}

describe('pairWith', () => {
  /*
   * O gêmeo veio da migração: ele já tem chave, e é ELA que vale. Mintar uma
   * chave nova aqui desfaria o par que já existia com as outras lojas.
   */
  it('reaproveita a chave que o gêmeo já tem', () => {
    expect(pairWith(twin({ key: 'prod-1' })).key).toBe('prod-1');
  });

  /*
   * O caso normal depois do deploy: o gêmeo foi cadastrado pelo painel e
   * nasceu sem chave. A convenção é a da migração — o id do produto de ORIGEM,
   * que aqui é o gêmeo, único no banco inteiro e por isso incapaz de colidir
   * dentro de qualquer uma das duas filiais.
   */
  it('usa o id do gêmeo como chave quando ele ainda não tem uma', () => {
    expect(pairWith(twin({ id: 'prod-zn-9', key: null })).key).toBe('prod-zn-9');
  });

  it('guarda o gêmeo escolhido, para a tela poder nomeá-lo', () => {
    const escolhido = twin({ name: 'Picanha na chapa', branchLabel: 'Zona Norte' });
    expect(pairWith(escolhido).twin).toEqual(escolhido);
  });
});

describe('twinKeyToWrite', () => {
  /*
   * A REGRA QUE PAREIA DE VERDADE. Gravar a chave só do nosso lado deixa o
   * gêmeo sem nenhuma — e o relatório continua contando os dois separados, sem
   * erro nenhum na tela para dizer que o pareamento não pegou.
   */
  it('manda gravar a chave no gêmeo que não tinha nenhuma', () => {
    const pair = pairWith(twin({ id: 'prod-zn-9', key: null }));
    expect(twinKeyToWrite(pair)).toEqual({ productId: 'prod-zn-9', key: 'prod-zn-9' });
  });

  it('não toca no gêmeo que já tem chave', () => {
    expect(twinKeyToWrite(pairWith(twin({ key: 'prod-1' })))).toBeNull();
  });

  /*
   * Chave vinda do backend, sem gêmeo conhecido: não há em quem gravar. Sair
   * procurando um par pelo nome é o que faria o painel carimbar a chave no
   * item errado da outra loja.
   */
  it('não tem o que gravar quando a chave veio do backend', () => {
    expect(twinKeyToWrite({ key: 'prod-1', twin: null })).toBeNull();
  });

  it('não tem o que gravar sem par nenhum', () => {
    expect(twinKeyToWrite(null)).toBeNull();
  });
});

describe('catalogKeyBody', () => {
  it('manda a chave do par', () => {
    expect(catalogKeyBody({ key: 'prod-1', twin: null })).toBe('prod-1');
  });

  /*
   * `null` EXPLÍCITO, e é o ponto todo desta função existir. Se ela devolvesse
   * `undefined`, o campo sairia do corpo JSON e desfazer o pareamento viraria
   * "não mexi na chave" — o item continuaria pareado e a tela diria que não.
   */
  it('desfazer o par manda null, e não a ausência do campo', () => {
    expect(catalogKeyBody(null)).toBeNull();
    expect(catalogKeyBody(null)).not.toBeUndefined();
  });
});

describe('pairFromProduct', () => {
  /*
   * O rascunho de edição TEM que trazer a chave. Sem isto, corrigir o preço de
   * um item pareado manda `catalog_key: null` junto e desfaz o par — a forma
   * mais silenciosa possível de quebrar o relatório.
   */
  it('traz a chave que o produto já tem, para a edição não apagá-la', () => {
    expect(pairFromProduct({ catalog_key: 'prod-1' })).toEqual({ key: 'prod-1', twin: null });
  });

  it('produto sem chave abre sem par — que é o estado normal', () => {
    expect(pairFromProduct({ catalog_key: null })).toBeNull();
    expect(pairFromProduct({})).toBeNull();
  });
});

describe('branchesToSearch', () => {
  /* Parear com a própria loja é o único uso que o backend recusa (409). */
  it('nunca oferece a filial que está aberta', () => {
    const branches = [branch('a'), branch('b'), branch('c')];
    expect(branchesToSearch(branches, 'b').map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('deixa de fora a filial desativada', () => {
    const branches = [branch('a'), branch('b', { is_active: false }), branch('c')];
    expect(branchesToSearch(branches, 'a').map((item) => item.id)).toEqual(['c']);
  });

  it('devolve vazio quando só existe a filial aberta', () => {
    expect(branchesToSearch([branch('a')], 'a')).toEqual([]);
  });
});

describe('catalogPairingApplies', () => {
  it('não se aplica a restaurante de uma loja só', () => {
    expect(catalogPairingApplies([branch('a')])).toBe(false);
  });

  it('não conta filial desativada como segunda loja', () => {
    expect(catalogPairingApplies([branch('a'), branch('b', { is_active: false })])).toBe(false);
  });

  it('se aplica com duas lojas no ar', () => {
    expect(catalogPairingApplies([branch('a'), branch('b')])).toBe(true);
  });
});
