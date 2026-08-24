import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/errors';
import type { AdminUserDetail, Branch } from '../api/types';
import {
  bodyDeCriacao,
  bodyDeEdicao,
  donosAtivos,
  errosDoUsuario,
  filialLabel,
  motivoParaNaoDesativar,
  motivoParaNaoRebaixar,
  motivoParaNaoRedefinirSenha,
  rascunhoDe,
  rascunhoNovo,
  situacaoDe,
  TODAS_AS_FILIAIS,
  validarRascunho,
} from './users-model';

function usuario(id: string, extra: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id,
    restaurant_id: 'r1',
    branch_id: null,
    name: id,
    email: `${id}@loja.com.br`,
    role: 'attendant',
    is_active: true,
    must_change_password: false,
    password_changed_at: null,
    created_at: null,
    ...extra,
  };
}

function branch(id: string, extra: Partial<Branch> = {}): Branch {
  return { id, name: id, display_name: null, is_main: false, is_active: true, ...extra } as Branch;
}

const DONO = usuario('dono', { role: 'owner' });
const GERENTE = usuario('gerente', { role: 'manager' });

/* ==========================================================================
 * AS GUARDAS — as três do backend, antecipadas, mais uma que é só nossa
 * ======================================================================= */

describe('desativar', () => {
  it('ninguém desativa a própria conta, seja qual for o papel', () => {
    /*
     * A guarda do backend (`_ensure_not_deactivating_self`) vale para todos, e
     * não só para o dono: o atendente que se desativasse por engano também
     * precisaria de alguém para desfazer.
     */
    expect(motivoParaNaoDesativar(GERENTE, 'gerente', [DONO, GERENTE])).not.toBeNull();
    expect(motivoParaNaoDesativar(GERENTE, 'dono', [DONO, GERENTE])).toBeNull();
  });

  it('o último dono ATIVO não se desativa', () => {
    expect(motivoParaNaoDesativar(DONO, 'outro', [DONO, GERENTE])).toMatch(/único proprietário/i);
  });

  it('com dois donos ativos, um deles pode sair', () => {
    const segundo = usuario('dono2', { role: 'owner' });
    expect(motivoParaNaoDesativar(DONO, 'dono2', [DONO, segundo])).toBeNull();
  });

  it('um dono INATIVO não conta como dono ativo, e não segura o outro', () => {
    /*
     * `count_active_owners` conta os ativos. Um dono desativado no ano passado
     * não sustenta nada — e travar o painel por causa dele deixaria a conta
     * viva presa a um fantasma.
     */
    const fantasma = usuario('dono2', { role: 'owner', is_active: false });
    expect(donosAtivos([DONO, fantasma])).toBe(1);
    expect(motivoParaNaoDesativar(DONO, 'outro', [DONO, fantasma])).not.toBeNull();
  });

  it('a razão da própria conta vence a de único dono', () => {
    /*
     * O dono único que tenta se desativar cai nas duas regras. A frase certa é
     * a da própria conta: "é o único proprietário" o mandaria procurar outro
     * dono, que é justamente o que ele não teria como criar depois de sair.
     */
    expect(motivoParaNaoDesativar(DONO, 'dono', [DONO])).toMatch(/própria conta/i);
  });
});

describe('mudar o cargo', () => {
  it('o último dono ativo não é rebaixado — o buraco que não parece remoção', () => {
    expect(motivoParaNaoRebaixar(DONO, [DONO, GERENTE])).toMatch(/único proprietário/i);
  });

  it('com outro dono ativo, o cargo abre', () => {
    const segundo = usuario('dono2', { role: 'owner' });
    expect(motivoParaNaoRebaixar(DONO, [DONO, segundo])).toBeNull();
  });

  it('dono já desativado pode ser rebaixado', () => {
    const inativo = usuario('dono2', { role: 'owner', is_active: false });
    expect(motivoParaNaoRebaixar(inativo, [DONO, inativo])).toBeNull();
  });

  it('quem não é dono nunca esbarra nesta guarda', () => {
    expect(motivoParaNaoRebaixar(GERENTE, [GERENTE])).toBeNull();
  });
});

describe('redefinir senha', () => {
  /*
   * ESTA GUARDA É NOSSA — o backend aceita. Redefinir a própria senha revoga o
   * token desta aba e liga `must_change_password` em si mesmo: o painel se
   * fecha no clique seguinte, e a saída é digitar os 20 caracteres que
   * acabaram de aparecer.
   */
  it('não vale para si mesmo, e aponta o caminho certo', () => {
    expect(motivoParaNaoRedefinirSenha(DONO, 'dono')).toMatch(/Trocar minha senha/);
  });

  it('vale para qualquer outra pessoa', () => {
    expect(motivoParaNaoRedefinirSenha(GERENTE, 'dono')).toBeNull();
  });
});

/* ==========================================================================
 * A LINHA DA LISTA
 * ======================================================================= */

describe('situacaoDe', () => {
  it('desativado vence a senha pendente', () => {
    /*
     * Quem foi desativado antes de entrar pela primeira vez não está esperando
     * trocar senha nenhuma: está fora. "Senha temporária" ali faria a linha
     * parecer uma pendência a resolver.
     */
    const fora = usuario('x', { is_active: false, must_change_password: true });
    expect(situacaoDe(fora)).toBe('inativo');
  });

  it('quem nunca entrou aparece com senha temporária', () => {
    expect(situacaoDe(usuario('x', { must_change_password: true }))).toBe('senha-pendente');
  });

  it('quem já trocou aparece como ativo', () => {
    expect(situacaoDe(usuario('x'))).toBe('ativo');
  });
});

describe('filialLabel', () => {
  const filiais = [branch('b1', { display_name: 'Centro' }), branch('b2', { name: 'Aldeota' })];

  it('nulo é TODAS as filiais, e não "sem filial"', () => {
    // A regra é do `AdminScope`: nulo significa enxergar mais, não menos.
    expect(filialLabel(usuario('x', { branch_id: null }), filiais)).toBe('Todas as filiais');
  });

  it('o dono enxerga todas mesmo com filial gravada', () => {
    /*
     * `build_admin_scope` ignora a filial de quem é dono. Escrever "Centro" na
     * linha dele anunciaria um limite que o backend não aplica.
     */
    const dono = usuario('x', { role: 'owner', branch_id: 'b1' });
    expect(filialLabel(dono, filiais)).toBe('Todas as filiais');
  });

  it('usa o mesmo rótulo do seletor do topo', () => {
    expect(filialLabel(usuario('x', { branch_id: 'b1' }), filiais)).toBe('Centro');
    expect(filialLabel(usuario('x', { branch_id: 'b2' }), filiais)).toBe('Aldeota');
  });

  it('filial fora do escopo não vira UUID cru na coluna', () => {
    expect(filialLabel(usuario('x', { branch_id: 'sumiu' }), filiais)).toBe('Outra filial');
  });
});

/* ==========================================================================
 * O CORPO QUE VAI PARA A API
 * ======================================================================= */

describe('bodyDeCriacao', () => {
  it('normaliza o e-mail como o backend normaliza', () => {
    // O UNIQUE do banco é sobre `lower(email)`. Mandar normalizado faz a tela
    // comparar a mesma coisa que o índice compara.
    const draft = { ...rascunhoNovo(''), name: '  Maria  ', email: '  MARIA@Loja.com  ' };
    expect(bodyDeCriacao(draft)).toMatchObject({ name: 'Maria', email: 'maria@loja.com' });
  });

  it('o cadastro novo nasce atendente', () => {
    // É o papel de quem esta tela existe para criar. O padrão decide o que a
    // maioria dos cadastros vira.
    expect(rascunhoNovo('').role).toBe('attendant');
  });

  it('"todas as filiais" vira null, que é o que o contrato aceita', () => {
    const draft = { ...rascunhoNovo(TODAS_AS_FILIAIS), name: 'A', email: 'a@b.com' };
    expect(bodyDeCriacao(draft).branch_id).toBeNull();
  });

  it('o DONO nunca leva filial no corpo, mesmo com uma escolhida antes', () => {
    /*
     * O backend aceitaria e ignoraria. O estrago é no dia seguinte: rebaixado a
     * gerente, ele apareceria preso a uma loja que ninguém escolheu para ele.
     */
    const draft = { ...rascunhoNovo('b1'), name: 'A', email: 'a@b.com', role: 'owner' as const };
    expect(bodyDeCriacao(draft).branch_id).toBeNull();
  });
});

describe('bodyDeEdicao', () => {
  const original = usuario('x', { name: 'Maria', role: 'manager', branch_id: 'b1' });

  it('manda só o que mudou', () => {
    const draft = { ...rascunhoDe(original), name: 'Maria Souza' };
    expect(bodyDeEdicao(draft, original)).toEqual({ name: 'Maria Souza' });
  });

  it('nada mudou é null — e quem chama nem gasta a chamada', () => {
    expect(bodyDeEdicao(rascunhoDe(original), original)).toBeNull();
  });

  it('tirar a filial manda null EXPLÍCITO, e não o campo ausente', () => {
    /*
     * Ausente é "não mexe na filial"; `null` é "esta pessoa passa a enxergar
     * todas". Um corpo que omitisse o campo para dizer a segunda coisa não
     * diria nada.
     */
    const draft = { ...rascunhoDe(original), branchId: TODAS_AS_FILIAIS };
    const body = bodyDeEdicao(draft, original);
    expect(body).toEqual({ branch_id: null });
    expect('branch_id' in body!).toBe(true);
  });

  it('promover a dono limpa a filial na mesma chamada', () => {
    const draft = { ...rascunhoDe(original), role: 'owner' as const };
    expect(bodyDeEdicao(draft, original)).toEqual({ role: 'owner', branch_id: null });
  });

  it('o espaço nas pontas do nome não conta como mudança', () => {
    const draft = { ...rascunhoDe(original), name: '  Maria  ' };
    expect(bodyDeEdicao(draft, original)).toBeNull();
  });
});

/* ==========================================================================
 * O FORMULÁRIO
 * ======================================================================= */

describe('validarRascunho', () => {
  const base = { ...rascunhoNovo(''), name: 'Maria', email: 'maria@loja.com' };

  it('aceita o preenchimento normal', () => {
    expect(validarRascunho(base)).toEqual({});
  });

  it('recusa nome só de espaços', () => {
    expect(validarRascunho({ ...base, name: '   ' }).name).toBeDefined();
  });

  it('recusa e-mail sem forma de e-mail — o backend NÃO valida isso', () => {
    /*
     * `AdminUserCreate.email` é `str` com `min_length=3`, não `EmailStr`. Um
     * "joao" grava e vira uma conta que ninguém consegue usar — e não há e-mail
     * de confirmação para descobrir depois.
     */
    expect(validarRascunho({ ...base, email: 'joao' }).email).toBeDefined();
    expect(validarRascunho({ ...base, email: 'joao@casa' }).email).toBeDefined();
    expect(validarRascunho({ ...base, email: 'joao@casa.com.br' }).email).toBeUndefined();
  });

  it('recusa e-mail vazio dizendo para que ele serve', () => {
    expect(validarRascunho({ ...base, email: '' }).email).toMatch(/entra no painel/i);
  });
});

describe('errosDoUsuario', () => {
  it('o 409 aponta o campo de e-mail e repete a frase do backend', () => {
    // A mensagem passa direto, sem tradução nossa: é a regra da skill de API.
    const erro = new ApiError(409, 'Este e-mail ja esta em uso');
    expect(errosDoUsuario(erro)).toEqual({
      campos: { email: 'Este e-mail ja esta em uso' },
      geral: null,
    });
  });

  it('o resto vai para o aviso geral, com a frase que veio', () => {
    const erro = new ApiError(404, 'Filial nao encontrada');
    const traduzido = errosDoUsuario(erro);
    expect(traduzido.campos).toEqual({});
    expect(traduzido.geral).toBe('Filial nao encontrada');
  });
});
