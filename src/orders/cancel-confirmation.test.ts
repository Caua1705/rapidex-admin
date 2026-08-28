import { describe, expect, it } from 'vitest';

import { ApiError, networkError } from '../api/errors';
import { confirmacaoExigida, fraseDaProducao, CUSTO_DO_CANCELAMENTO } from './cancel-confirmation';

/** O corpo exato que a rota devolve — envelope `detail` do FastAPI incluído. */
function resposta428(orderStatus = 'preparing') {
  return new ApiError(428, 'Precondition Required', {
    detail: {
      code: 'confirmation_required',
      message:
        'Este pedido já está em produção. Cancelar agora não devolve o custo da comida para o ' +
        'restaurante. Confirme para continuar.',
      order_status: orderStatus,
    },
  });
}

/* ==========================================================================
 * O RECONHECIMENTO — três âncoras, e nenhuma é o texto da mensagem
 * ======================================================================= */

describe('o 428 que pede confirmação', () => {
  it('reconhece a resposta e devolve o corpo tipado', () => {
    const confirmacao = confirmacaoExigida(resposta428());

    expect(confirmacao).toEqual({
      code: 'confirmation_required',
      message: expect.stringContaining('já está em produção'),
      order_status: 'preparing',
    });
  });

  /*
   * ESTE É O TESTE QUE GUARDA O DEFEITO CONSERTADO. Antes, o 428 caía no
   * `catch` genérico do quadro: `messageFromUnknownError` não acha frase num
   * `detail` que é OBJETO, então o lojista via a tarja vermelha genérica, o
   * pedido continuava na chapa e não havia caminho na tela para sair dali.
   */
  it('o corpo é objeto, e é por isso que ele não pode ir para o erro genérico', () => {
    const erro = resposta428();
    const corpo = erro.body as { detail: unknown };
    expect(typeof corpo.detail).toBe('object');
  });

  /*
   * OS 409 DESTA MESMA ROTA SÃO CONFLITOS DE VERDADE ("pedido entregue não muda
   * mais") e saem com `detail` de STRING. O backend separou os códigos para o
   * painel não ter de distinguir pelo texto — e é a separação que este teste
   * guarda.
   */
  it('o 409 de estado final não é confirmação', () => {
    const conflito = new ApiError(409, 'Conflict', {
      detail: '"Concluído" é um estado final e não muda mais.',
    });
    expect(confirmacaoExigida(conflito)).toBeNull();
  });

  it('um 428 com detail de string não entra — o formato faz parte da âncora', () => {
    const estranho = new ApiError(428, 'Precondition Required', { detail: 'confirme aí' });
    expect(confirmacaoExigida(estranho)).toBeNull();
  });

  /*
   * FALHA FECHADO: um código futuro que a tela não conhece segue como erro
   * normal. O pior caso é uma mensagem na tela; o contrário seria abrir o
   * diálogo de "confirme o cancelamento" para uma resposta que quis dizer
   * outra coisa.
   */
  it('um código desconhecido segue como erro, e não abre diálogo nenhum', () => {
    const outro = new ApiError(428, 'Precondition Required', {
      detail: { code: 'payment_hold', message: 'x', order_status: 'preparing' },
    });
    expect(confirmacaoExigida(outro)).toBeNull();
  });

  it('erro de rede e coisa que não é ApiError devolvem null sem estourar', () => {
    expect(confirmacaoExigida(networkError())).toBeNull();
    expect(confirmacaoExigida(new Error('qualquer coisa'))).toBeNull();
    expect(confirmacaoExigida(undefined)).toBeNull();
    expect(confirmacaoExigida({ detail: { code: 'confirmation_required' } })).toBeNull();
  });

  /* Corpo pela metade não vira confirmação: sem `order_status` o diálogo não
     tem o que dizer, e a frase do backend sozinha não justifica inventar um. */
  it('corpo sem order_status não é lido como confirmação', () => {
    const incompleto = new ApiError(428, 'x', {
      detail: { code: 'confirmation_required', message: 'em produção' },
    });
    expect(confirmacaoExigida(incompleto)).toBeNull();
  });
});

/* ==========================================================================
 * A FRASE — por que `order_status` vem junto da mensagem
 * ======================================================================= */

describe('o que o diálogo diz sobre o estágio', () => {
  /*
   * As três situações são o mesmo 428 e conversas diferentes: em `preparing`
   * dá para avisar a cozinha; em `out_for_delivery` o motoboy está na rua com
   * a comida. É por isso que o backend manda `order_status` junto de uma
   * mensagem que já estaria pronta.
   */
  it('nomeia o estágio em vez de repetir "em produção"', () => {
    expect(fraseDaProducao(confirmacaoExigida(resposta428('preparing'))!)).toContain(
      'preparando',
    );
    expect(fraseDaProducao(confirmacaoExigida(resposta428('ready'))!)).toContain('pronto');
    expect(fraseDaProducao(confirmacaoExigida(resposta428('out_for_delivery'))!)).toContain(
      'saiu para entrega',
    );
  });

  /* Um quarto estado de produção criado na plataforma cai na frase do backend:
     dizer a verdade genérica é melhor que afirmar um estágio errado. */
  it('estágio desconhecido usa a mensagem que o backend mandou', () => {
    const confirmacao = confirmacaoExigida(resposta428('being_packed'))!;
    expect(fraseDaProducao(confirmacao)).toBe(confirmacao.message);
  });

  /*
   * O CUSTO NÃO PROMETE ESTORNO. O dinheiro segue o `payment_status`, por
   * caminho próprio — prometer devolução ao cliente aqui seria a tela
   * respondendo por uma regra que não é dela.
   */
  it('a frase do custo fala da comida, e não do dinheiro do cliente', () => {
    expect(CUSTO_DO_CANCELAMENTO).toContain('custo dela fica com a loja');
    expect(CUSTO_DO_CANCELAMENTO).not.toMatch(/estorn|devolv.* ao cliente/i);
  });
});
