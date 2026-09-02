import { describe, expect, it } from 'vitest';

import {
  DESCRICAO_MAX,
  LOG_MAX,
  TELA_MAX,
  checkDescricao,
  montarLog,
  nomeDaTela,
} from './error-report';

describe('checkDescricao', () => {
  it('campo vazio trava o botão sem acusar erro', () => {
    expect(checkDescricao('')).toEqual({ valid: false, message: null });
    expect(checkDescricao('    ')).toEqual({ valid: false, message: null });
  });

  it('uma letra já basta: o backend pede min_length=1', () => {
    expect(checkDescricao('a')).toEqual({ valid: true, descricao: 'a' });
    expect(checkDescricao('  travou ao salvar  ')).toEqual({
      valid: true,
      descricao: 'travou ao salvar',
    });
  });

  it('acusa o teto antes de o backend responder 422', () => {
    const check = checkDescricao('x'.repeat(DESCRICAO_MAX + 1));
    expect(check.valid).toBe(false);
    expect(check.valid === false && check.message).toContain(String(DESCRICAO_MAX));
  });
});

describe('montarLog', () => {
  it('leva o nome, a mensagem e a pilha do componente', () => {
    const erro = new TypeError('Cannot read properties of undefined');
    const log = montarLog(erro, '\n    at MenuPage\n    at AppShell');
    expect(log).toContain('TypeError');
    expect(log).toContain('Cannot read properties of undefined');
    expect(log).toContain('at MenuPage');
  });

  /*
   * Nem tudo que o React entrega ao boundary é um Error: um `throw 'texto'` em
   * qualquer dependência chega aqui como string. Perder o relato inteiro por
   * causa disso seria perder justamente o caso mais estranho.
   */
  it('aguenta o que não é Error', () => {
    expect(montarLog('quebrou feio', null)).toContain('quebrou feio');
    expect(montarLog(null, null)).toContain('sem detalhe');
    expect(montarLog({ oi: 1 }, null)).toContain('oi');
  });

  /*
   * O TETO É O DO BACKEND, E ELE NÃO ESTÁ NO SCHEMA GERADO.
   *
   * `error_log` é `str | None` com `max_length=20000` no Pydantic, e o
   * /openapi.json publica só `string`. Uma pilha de componente grande estourar
   * o limite significaria 422 NA TELA DE RELATAR O ERRO — a falha mais cruel
   * possível, porque é a última porta que restava.
   */
  it('corta no teto do backend, e diz que cortou', () => {
    const log = montarLog(new Error('x'.repeat(LOG_MAX * 2)), null);
    expect(log.length).toBeLessThanOrEqual(LOG_MAX);
    expect(log).toContain('[cortado]');
  });

  it('corta a CAUDA e preserva a cabeça, que é onde está a causa', () => {
    const erro = new Error('a mensagem que importa');
    erro.stack = `Error: a mensagem que importa\n${'   at ruido\n'.repeat(4000)}`;
    const log = montarLog(erro, null);
    expect(log.startsWith('Error: a mensagem que importa')).toBe(true);
  });
});

describe('nomeDaTela', () => {
  it('é o caminho da URL, que é o que o suporte procura', () => {
    expect(nomeDaTela('/loja/impressao')).toBe('/loja/impressao');
  });

  /* `screen` é `max_length=200` no backend, e também não sai no schema. */
  it('corta no teto do backend', () => {
    expect(nomeDaTela('/' + 'a'.repeat(TELA_MAX * 2)).length).toBe(TELA_MAX);
  });
});
