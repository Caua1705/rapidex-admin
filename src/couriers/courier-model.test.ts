import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/errors';
import {
  corpoDeCriacao,
  corpoDeEdicao,
  errosDoEntregador,
  rascunhoDe,
  RASCUNHO_NOVO,
  textoDoAcesso,
  type CourierDraft,
} from './courier-model';
import type { Courier } from '../api/types';

const FILIAL = '22222222-2222-2222-2222-222222222222';

function entregador(overrides: Partial<Courier> = {}): Courier {
  return {
    id: 'ent-1',
    branch_id: FILIAL,
    name: 'Jorge',
    phone: '85999990000',
    is_active: true,
    has_access: false,
    access_generated_at: null,
    created_at: null,
    ...overrides,
  };
}

/*
 * ============================================================================
 * OS LIMITES QUE O /openapi.json NÃO PUBLICA
 * ============================================================================
 *
 * `Field(min_length=...)` e `field_validator` do Pydantic não saem no contrato
 * gerado — o TypeScript vê `string` e concorda com qualquer coisa. Escritos à
 * mão num lugar só, com a origem nomeada, e conferidos aqui: sem isto o lojista
 * descobre a regra por um 422 no meio do cadastro.
 */
describe('corpoDeCriacao', () => {
  it('nome e telefone limpos, com a filial que só o POST aceita', () => {
    const saida = corpoDeCriacao({ name: '  Jorge  ', phone: '(85) 99999-0000' }, FILIAL);
    expect(saida.ok && saida.body).toEqual({
      branch_id: FILIAL,
      name: 'Jorge',
      phone: '85999990000',
    });
  });

  /*
   * O TELEFONE SOBE SÓ COM DÍGITOS. O backend normaliza do mesmo jeito, e
   * mandar "(85) 99999-0000" faria a tela e o banco guardarem grafias
   * diferentes do mesmo número — que é o que quebra a conferência de repetido.
   */
  it('a máscara não sobe: o que vai são os dígitos', () => {
    const saida = corpoDeCriacao({ name: 'Jorge', phone: '+55 (85) 9 9999-0000' }, FILIAL);
    expect(saida.ok && saida.body.phone).toBe('85999990000');
  });

  it('nome vazio é recusado antes de sair, apontando o campo', () => {
    const saida = corpoDeCriacao({ name: '   ', phone: '85999990000' }, FILIAL);
    expect(saida.ok).toBe(false);
    expect(!saida.ok && saida.campo).toBe('name');
  });

  it('nome acima de 120 é recusado aqui, e não por um 422 no meio do cadastro', () => {
    const saida = corpoDeCriacao({ name: 'x'.repeat(121), phone: '85999990000' }, FILIAL);
    expect(saida.ok).toBe(false);
    expect(!saida.ok && saida.campo).toBe('name');
  });

  it('menos de oito dígitos é telefone inválido, contando DÍGITOS e não letras', () => {
    /*
     * NOVE CARACTERES, SEIS DÍGITOS. É exatamente o vão entre as duas
     * conferências do backend: passa pelo `min_length=8` da string crua e morre
     * no `_phone_digits`. Contar caracteres aqui deixaria passar o que o
     * servidor recusa — e a primeira versão deste teste usava
     * "(85) 9999-999", que tem NOVE dígitos e passa com razão.
     */
    const saida = corpoDeCriacao({ name: 'Jorge', phone: '(85) 9999' }, FILIAL);
    expect(saida.ok).toBe(false);
    expect(!saida.ok && saida.campo).toBe('phone');
  });

  it('oito dígitos passa: é o mínimo, não o comum', () => {
    const saida = corpoDeCriacao({ name: 'Jorge', phone: '3333-4444' }, FILIAL);
    expect(saida.ok && saida.body.phone).toBe('33334444');
  });
});

/*
 * ============================================================================
 * A EDIÇÃO MANDA SÓ O QUE MUDOU, E NUNCA A FILIAL
 * ============================================================================
 *
 * `branch_id` só existe no POST — "quem serve duas lojas tem dois cadastros".
 * E o `AdminCourierUpdate` é `extra="forbid"`: mandar a filial num PATCH é 422,
 * não um campo ignorado.
 */
describe('corpoDeEdicao', () => {
  it('nada mudou, corpo vazio', () => {
    const atual = entregador();
    expect(corpoDeEdicao(rascunhoDe(atual), atual).ok).toBe(true);
    const saida = corpoDeEdicao(rascunhoDe(atual), atual);
    expect(saida.ok && saida.body).toEqual({});
  });

  it('só o nome mexido entra no corpo', () => {
    const atual = entregador();
    const saida = corpoDeEdicao({ name: 'Jorge Silva', phone: rascunhoDe(atual).phone }, atual);
    expect(saida.ok && saida.body).toEqual({ name: 'Jorge Silva' });
  });

  it('a filial NUNCA entra no corpo do PATCH', () => {
    const atual = entregador();
    const saida = corpoDeEdicao({ name: 'Outro', phone: '85988887777' }, atual);
    expect(saida.ok && saida.body).not.toHaveProperty('branch_id');
  });

  /*
   * O TELEFONE COMPARA POR DÍGITO. Reescrever "(85) 99999-0000" sobre o mesmo
   * número gravado não é mudança — e mandá-lo assim mesmo faria o backend
   * conferir repetição contra a própria linha.
   */
  it('trocar só a máscara do telefone não é mudança', () => {
    const atual = entregador({ phone: '85999990000' });
    const saida = corpoDeEdicao({ name: 'Jorge', phone: '(85) 99999-0000' }, atual);
    expect(saida.ok && saida.body).toEqual({});
  });

  it('nome vazio na edição também trava, e não vira nulo', () => {
    const saida = corpoDeEdicao({ name: '', phone: '85999990000' }, entregador());
    expect(saida.ok).toBe(false);
    expect(!saida.ok && saida.campo).toBe('name');
  });
});

describe('rascunhoDe', () => {
  it('o telefone volta formatado para ler em voz alta, não em dígitos corridos', () => {
    expect(rascunhoDe(entregador({ phone: '85999990000' }))).toEqual({
      name: 'Jorge',
      phone: '(85) 99999-0000',
    });
  });

  it('o rascunho novo nasce vazio', () => {
    expect(RASCUNHO_NOVO).toEqual({ name: '', phone: '' } satisfies CourierDraft);
  });
});

/*
 * ============================================================================
 * O 409 É DO TELEFONE, E VAI PARA O CAMPO DO TELEFONE
 * ============================================================================
 *
 * O `detail` vem pronto e em português do backend. O que a tela decide é ONDE
 * mostrá-lo: um erro de campo no rodapé faz a pessoa reler o formulário inteiro
 * procurando o que está errado.
 *
 * A DECISÃO SAI DO STATUS, não do texto. Casar a frase seria um teste que passa
 * até o dia em que alguém corrigir uma vírgula no backend.
 */
describe('errosDoEntregador', () => {
  it('409 é telefone repetido, e a frase do backend vai para o campo', () => {
    const erros = errosDoEntregador(
      new ApiError(409, 'Já existe um entregador com este telefone nesta filial'),
    );
    expect(erros.campos.phone).toContain('telefone');
    expect(erros.geral).toBeNull();
  });

  it('403 não é de campo nenhum: vai para o rodapé', () => {
    const erros = errosDoEntregador(new ApiError(403, 'Você não tem permissão para isso.'));
    expect(erros.campos).toEqual({});
    expect(erros.geral).toContain('permissão');
  });

  it('erro que não é da API também tem lugar', () => {
    const erros = errosDoEntregador(new Error('falha de rede'));
    expect(erros.geral).toBeTruthy();
  });
});

describe('textoDoAcesso', () => {
  it('sem acesso é dito, e não deixado em branco', () => {
    expect(textoDoAcesso(entregador({ has_access: false }))).toContain('Sem acesso');
  });

  /*
   * COM ACESSO, A TELA NÃO PROMETE MOSTRAR O PAR. Ele saiu uma vez só; dizer
   * "acesso gerado" e não ter o que abrir é a frase certa — "ver acesso" seria
   * um botão que decepciona.
   */
  it('com acesso, diz que existe — e não oferece vê-lo', () => {
    const texto = textoDoAcesso(
      entregador({ has_access: true, access_generated_at: '2026-09-02T12:00:00Z' }),
    );
    expect(texto).toContain('Acesso gerado');
    expect(texto).not.toContain('Ver');
  });
});
