import { describe, expect, it } from 'vitest';

import type { Branch } from '../api/types';
import { ROUTE_BRANCH_SCOPE, branchScopeForPath, resolveBranch } from './branch-scope';

function branch(id: string, extra: Partial<Branch> = {}): Branch {
  return {
    id,
    name: id,
    display_name: null,
    is_main: false,
    is_active: true,
    ...extra,
  } as Branch;
}

describe('ROUTE_BRANCH_SCOPE', () => {
  /*
   * A tabela é a única fonte da regra. Estes dois casos são as duas metades
   * dela: se alguém mover uma rota de lado, uma tela passa a bloquear (ou a
   * gravar na filial errada) sem que nada mais no projeto reclame.
   */
  it('trata as rotas com {branch_id} no path como escrita por filial', () => {
    expect(ROUTE_BRANCH_SCOPE['/admin/branches/{branch_id}/business-hours']).toBe('single');
    expect(ROUTE_BRANCH_SCOPE['/admin/branches/{branch_id}/prep-time']).toBe('single');
    expect(ROUTE_BRANCH_SCOPE['/admin/branches/{branch_id}/printing-sectors']).toBe('single');
  });

  it('trata as rotas que filtram por query como leitura multi-filial', () => {
    expect(ROUTE_BRANCH_SCOPE['/admin/orders']).toBe('multi');
    expect(ROUTE_BRANCH_SCOPE['/admin/orders/status-counts']).toBe('multi');
    expect(ROUTE_BRANCH_SCOPE['/admin/settings']).toBe('multi');
  });

  /*
   * Toda rota com `{branch_id}` no path é 'single' e nenhuma outra é. É a
   * regra do §4.3 da skill de API conferida contra a tabela inteira, então uma
   * rota nova classificada errado cai aqui em vez de cair na tela.
   */
  it('classifica pelo formato da rota, sem exceção escrita à mão', () => {
    Object.entries(ROUTE_BRANCH_SCOPE).forEach(([rota, escopo]) => {
      expect([rota, escopo]).toEqual([rota, rota.includes('{branch_id}') ? 'single' : 'multi']);
    });
  });
});

describe('branchScopeForPath', () => {
  it('marca as seções de filial de Minha loja como escrita por filial', () => {
    expect(branchScopeForPath('/minha-loja/horarios')).toBe('single');
    expect(branchScopeForPath('/minha-loja/entrega')).toBe('single');
    expect(branchScopeForPath('/minha-loja/pagamento')).toBe('single');
    expect(branchScopeForPath('/minha-loja/filial')).toBe('single');
    expect(branchScopeForPath('/minha-loja/impressao')).toBe('single');
  });

  it('deixa Geral e o resto do painel em leitura multi-filial', () => {
    // Geral é do restaurante inteiro: "todas as filiais" continua válido lá.
    expect(branchScopeForPath('/minha-loja/geral')).toBe('multi');
    expect(branchScopeForPath('/pedidos')).toBe('multi');
    expect(branchScopeForPath('/cardapio')).toBe('multi');
  });

  it('ignora a barra final', () => {
    expect(branchScopeForPath('/minha-loja/horarios/')).toBe('single');
  });
});

describe('resolveBranch', () => {
  it('devolve a filial escolhida quando há uma', () => {
    const branches = [branch('a', { is_main: true }), branch('b')];
    expect(resolveBranch(branches, 'b')?.id).toBe('b');
  });

  /* O caso que existe para matar a parede: sem escolha, o painel decide. */
  it('cai na principal quando ninguém escolheu', () => {
    const branches = [branch('a'), branch('b', { is_main: true })];
    expect(resolveBranch(branches, '')?.id).toBe('b');
  });

  it('cai na primeira quando nenhuma é principal', () => {
    expect(resolveBranch([branch('a'), branch('b')], '')?.id).toBe('a');
  });

  /*
   * Id que não está mais na lista (filial desativada com o painel aberto):
   * resolve como se ninguém tivesse escolhido, em vez de devolver nada e
   * deixar a tela sem filial para gravar.
   */
  it('resolve um id que saiu da lista como se não houvesse escolha', () => {
    const branches = [branch('a'), branch('b', { is_main: true })];
    expect(resolveBranch(branches, 'sumida')?.id).toBe('b');
  });

  it('devolve nulo quando o lojista não enxerga filial nenhuma', () => {
    expect(resolveBranch([], '')).toBeNull();
  });
});
