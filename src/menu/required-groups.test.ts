import { describe, expect, it } from 'vitest';

import type { ProductOption, ProductOptionGroup } from '../api/types';
import {
  activeOptions,
  blockingRequiredGroup,
  groupEmptiedByDeactivating,
} from './required-groups';

function option(id: string, isActive: boolean): ProductOption {
  return {
    id,
    option_group_id: 'g',
    name: `Opção ${id}`,
    additional_price: 0,
    sort_order: 0,
    is_active: isActive,
  };
}

function group(
  id: string,
  overrides: Partial<ProductOptionGroup> = {},
  options: ProductOption[] = [],
): ProductOptionGroup {
  return {
    id,
    product_id: 'p',
    name: `Grupo ${id}`,
    min_select: 1,
    max_select: 1,
    is_required: true,
    sort_order: 0,
    is_active: true,
    options,
    ...overrides,
  };
}

describe('blockingRequiredGroup', () => {
  it('acusa o grupo obrigatório que ficou sem opção ativa', () => {
    const grupos = [group('ponto', {}, [option('a', false), option('b', false)])];
    expect(blockingRequiredGroup(grupos)?.id).toBe('ponto');
  });

  it('não acusa nada quando ainda sobra uma opção ativa', () => {
    const grupos = [group('ponto', {}, [option('a', false), option('b', true)])];
    expect(blockingRequiredGroup(grupos)).toBeNull();
  });

  // A parte fácil de errar, e a que o backend destaca no comentário dele.
  it('GRUPO DESATIVADO NÃO CONTA — o lojista desligou o passo inteiro', () => {
    const grupos = [group('ponto', { is_active: false }, [option('a', false)])];
    expect(blockingRequiredGroup(grupos)).toBeNull();
  });

  it('grupo opcional vazio não tira o item de venda', () => {
    const grupos = [group('extras', { is_required: false }, [option('a', false)])];
    expect(blockingRequiredGroup(grupos)).toBeNull();
  });

  it('grupo obrigatório sem nenhuma opção cadastrada também bloqueia', () => {
    expect(blockingRequiredGroup([group('ponto', {}, [])])?.id).toBe('ponto');
  });

  it('devolve o primeiro grupo bloqueador, para o aviso poder nomeá-lo', () => {
    const grupos = [
      group('ponto', {}, [option('a', true)]),
      group('molho', {}, [option('b', false)]),
    ];
    expect(blockingRequiredGroup(grupos)?.name).toBe('Grupo molho');
  });
});

describe('groupEmptiedByDeactivating', () => {
  it('avisa quando a opção é a ÚLTIMA ativa de um grupo obrigatório', () => {
    const grupos = [group('ponto', {}, [option('a', false), option('b', true)])];
    expect(groupEmptiedByDeactivating(grupos, 'b')?.id).toBe('ponto');
  });

  it('não avisa quando ainda sobra outra ativa', () => {
    const grupos = [group('ponto', {}, [option('a', true), option('b', true)])];
    expect(groupEmptiedByDeactivating(grupos, 'b')).toBeNull();
  });

  it('não avisa ao desativar opção de grupo OPCIONAL', () => {
    const grupos = [group('extras', { is_required: false }, [option('a', true)])];
    expect(groupEmptiedByDeactivating(grupos, 'a')).toBeNull();
  });

  it('não avisa ao desativar opção de grupo já desativado', () => {
    const grupos = [group('ponto', { is_active: false }, [option('a', true)])];
    expect(groupEmptiedByDeactivating(grupos, 'a')).toBeNull();
  });

  /*
   * O aviso repetido é o aviso que ninguém lê: se o item JÁ está fora de venda
   * por aquele grupo, desativar mais uma opção dele não muda o estado.
   */
  it('não repete o aviso sobre um grupo que já esvaziou o item', () => {
    const grupos = [
      group('ponto', {}, [option('a', false), option('b', false)]),
      group('molho', { is_required: false }, [option('c', true)]),
    ];
    expect(groupEmptiedByDeactivating(grupos, 'c')).toBeNull();
  });

  it('avisa sobre o SEGUNDO grupo obrigatório mesmo com o primeiro saudável', () => {
    const grupos = [
      group('ponto', {}, [option('a', true)]),
      group('molho', {}, [option('b', true)]),
    ];
    expect(groupEmptiedByDeactivating(grupos, 'b')?.id).toBe('molho');
  });

  it('desativar opção que já está inativa não muda nada', () => {
    const grupos = [group('ponto', {}, [option('a', true), option('b', false)])];
    expect(groupEmptiedByDeactivating(grupos, 'b')).toBeNull();
  });
});

describe('activeOptions', () => {
  it('conta só as ativas, e aguenta grupo sem a lista', () => {
    expect(activeOptions(group('g', {}, [option('a', true), option('b', false)]))).toHaveLength(1);
    expect(activeOptions(group('g', { options: undefined }))).toHaveLength(0);
  });
});
