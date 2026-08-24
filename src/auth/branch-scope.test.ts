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
   * O cardápio é 'single' sem ter `{branch_id}` no path, e é a única família de
   * rotas assim: `POST /admin/categories` e `PATCH /admin/categories/reorder`
   * exigem a filial no CORPO (422 sem ela), e as duas leituras respondem o
   * cardápio de todas as lojas somado quando ninguém recorta.
   */
  it('trata o cardápio como rota de uma filial, mesmo sem filial no path', () => {
    expect(ROUTE_BRANCH_SCOPE['/admin/categories']).toBe('single');
    expect(ROUTE_BRANCH_SCOPE['/admin/products']).toBe('single');
  });

  /*
   * A regra escrita por extenso, conferida contra a tabela INTEIRA: 'single' é
   * "não há chamada possível sem a filial" — por path, ou por corpo. Uma rota
   * nova classificada errado cai aqui em vez de cair na tela.
   *
   * A lista de exceção é curta de propósito. Ela não é um escape para
   * classificar à mão: quem acrescentar um nome aqui está afirmando que o
   * contrato daquela rota EXIGE a filial, e é isso que a revisão confere.
   */
  it('classifica pelo contrato: filial no path, ou filial obrigatória no corpo', () => {
    const filialNoCorpo = ['/admin/categories', '/admin/products'];

    Object.entries(ROUTE_BRANCH_SCOPE).forEach(([rota, escopo]) => {
      const exigeFilial = rota.includes('{branch_id}') || filialNoCorpo.includes(rota);
      expect([rota, escopo]).toEqual([rota, exigeFilial ? 'single' : 'multi']);
    });
  });
});

describe('branchScopeForPath', () => {
  /*
   * O Cardápio entrou nesta lista quando o cardápio virou da filial. Sem ele
   * aqui, o seletor do topo volta a oferecer "Todas as filiais" na tela — e
   * ali "todas" não é um recorte mais largo, é o cardápio das lojas somado,
   * que é o defeito com que esta rodada começou.
   */
  it('marca o Cardápio e as seções de filial de Loja como tela de uma filial', () => {
    expect(branchScopeForPath('/cardapio')).toBe('single');
    expect(branchScopeForPath('/loja/horarios')).toBe('single');
    expect(branchScopeForPath('/loja/entrega')).toBe('single');
    expect(branchScopeForPath('/loja/pagamento')).toBe('single');
    expect(branchScopeForPath('/loja/filial')).toBe('single');
    expect(branchScopeForPath('/loja/impressao')).toBe('single');
  });

  it('deixa Geral e o resto do painel em leitura multi-filial', () => {
    // Geral é do restaurante inteiro: "todas as filiais" continua válido lá.
    expect(branchScopeForPath('/loja/geral')).toBe('multi');
    expect(branchScopeForPath('/pedidos')).toBe('multi');
    expect(branchScopeForPath('/clientes')).toBe('multi');
  });

  it('ignora a barra final', () => {
    expect(branchScopeForPath('/loja/horarios/')).toBe('single');
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
