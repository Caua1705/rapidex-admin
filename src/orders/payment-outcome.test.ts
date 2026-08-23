import { describe, expect, it } from 'vitest';

import type { OrderStatusHistoryEntry } from '../api/types';
import { gatewayStatusOf, isChargeback, paymentOutcome } from './payment-outcome';

function entry(over: Partial<OrderStatusHistoryEntry> = {}): OrderStatusHistoryEntry {
  return {
    id: crypto.randomUUID(),
    status: 'payment:refunded',
    changed_by: 'gateway:mercadopago',
    note: 'status do gateway: refunded',
    created_at: '2026-08-23T12:00:00Z',
    ...over,
  };
}

describe('gatewayStatusOf', () => {
  it('lê o status cru da nota que o webhook escreve', () => {
    expect(gatewayStatusOf(entry({ note: 'status do gateway: charged_back' }))).toBe(
      'charged_back',
    );
  });

  // O desfecho síncrono do cartão escreve "approved (accredited)". Ele não chega
  // em estorno, mas a leitura não pode depender de qual caminho gravou a linha.
  it('ignora o detalhe entre parênteses', () => {
    expect(gatewayStatusOf(entry({ note: 'status do gateway: approved (accredited)' }))).toBe(
      'approved',
    );
  });

  it('nota vazia, ausente ou de outro formato não vira status', () => {
    expect(gatewayStatusOf(entry({ note: null }))).toBeNull();
    expect(gatewayStatusOf(entry({ note: 'Cliente desistiu por telefone.' }))).toBeNull();
    expect(gatewayStatusOf(entry({ note: 'estornado ate agora: 12.50' }))).toBeNull();
  });
});

describe('isChargeback', () => {
  it('acha a contestação na linha de estorno do histórico', () => {
    expect(isChargeback([entry({ note: 'status do gateway: charged_back' })])).toBe(true);
  });

  it('estorno comum não é contestação', () => {
    expect(isChargeback([entry({ note: 'status do gateway: refunded' })])).toBe(false);
  });

  /*
   * O motivo de cancelamento é TEXTO LIVRE e mora na mesma tabela. Sem a âncora
   * no `status` da linha, um lojista mal-intencionado (ou só irônico) faria o
   * painel acusar uma contestação que não existiu.
   */
  it('nota de cancelamento com o texto do gateway não conta', () => {
    const forjada = entry({
      status: 'cancelled',
      changed_by: 'lojista@casa.com',
      note: 'status do gateway: charged_back',
    });

    expect(isChargeback([forjada])).toBe(false);
  });

  it('estorno parcial não conta: ele nem muda o status do pagamento', () => {
    const parcial = entry({
      status: 'payment:partially_refunded',
      note: 'estornado ate agora: 12.50',
    });

    expect(isChargeback([parcial])).toBe(false);
  });

  it('histórico vazio não afirma nada', () => {
    expect(isChargeback([])).toBe(false);
  });
});

describe('paymentOutcome', () => {
  it('a contestação tem rótulo próprio e aviso de erro', () => {
    const outcome = paymentOutcome({
      payment_status: 'refunded',
      status_history: [entry({ note: 'status do gateway: charged_back' })],
    });

    expect(outcome.label).toBe('Contestado pelo cliente');
    expect(outcome.notice?.tone).toBe('error');
  });

  it('o estorno comum continua "Estornado", e o aviso é informação', () => {
    const outcome = paymentOutcome({
      payment_status: 'refunded',
      status_history: [entry({ note: 'status do gateway: refunded' })],
    });

    expect(outcome.label).toBe('Estornado');
    expect(outcome.notice?.tone).toBe('info');
  });

  /*
   * Pedido antigo, `note` nula, gateway novo que escreva de outro jeito: o
   * painel afirma o que sabe (voltou dinheiro) e não inventa a disputa. Errar
   * para o lado da contestação seria acusar o cliente por ausência de dado.
   */
  it('estorno sem nota legível é estorno, nunca contestação', () => {
    const outcome = paymentOutcome({
      payment_status: 'refunded',
      status_history: [entry({ note: null })],
    });

    expect(outcome.label).toBe('Estornado');
  });

  /*
   * O ANTIFRAUDE. `in_review` só acontece com CARTÃO e não tinha rótulo: caía
   * no `labelFor` e o lojista lia "in_review" na linha "Situação".
   */
  it('a análise antifraude tem rótulo próprio e aviso de atenção', () => {
    const outcome = paymentOutcome({ payment_status: 'in_review', status_history: [] });

    expect(outcome.label).toBe('Em análise antifraude');
    expect(outcome.notice?.tone).toBe('warn');
  });

  /*
   * A DISTINÇÃO QUE ESTE ARQUIVO EXISTE PARA GUARDAR, do lado da espera.
   *
   * `pending` e `in_review` travam a cozinha igual, e é por isso que é fácil
   * escrevê-los com a mesma frase. Mas são LIGAÇÕES OPOSTAS: no primeiro se
   * cobra o cliente, no segundo não há o que cobrar de ninguém. Se estas duas
   * asserções passarem a bater, a separação que o backend fez foi jogada fora
   * exatamente onde ela seria usada.
   */
  it('a espera do antifraude não é a espera do pix', () => {
    const analise = paymentOutcome({ payment_status: 'in_review', status_history: [] });
    const pix = paymentOutcome({ payment_status: 'pending', status_history: [] });

    expect(analise.label).not.toBe(pix.label);
    expect(analise.notice?.text).not.toBe(pix.notice?.text);

    // O que a frase do antifraude precisa dizer, e a do pix não diz.
    expect(analise.notice?.text).toContain('48 horas úteis');
    expect(analise.notice?.text).toContain('Mercado Pago');
    // Que a cozinha está travada continua sendo dito nas duas.
    expect(analise.notice?.text).toContain('cozinha não pode preparar');
    expect(pix.notice?.text).toContain('cozinha não pode preparar');
  });

  it('a espera comum nomeia a situação dentro da frase', () => {
    expect(paymentOutcome({ payment_status: 'pending', status_history: [] }).notice?.text).toBe(
      'Pagamento online ainda não confirmado (Aguardando pagamento). A cozinha não pode ' +
        'preparar este pedido.',
    );
    expect(paymentOutcome({ payment_status: 'failed', status_history: [] }).notice?.text).toContain(
      '(Pagamento recusado)',
    );
  });

  /* Dinheiro no lugar certo não pede aviso nenhum. */
  it('pago e a pagar na entrega não ganham aviso', () => {
    for (const payment_status of ['paid', 'on_delivery']) {
      expect(paymentOutcome({ payment_status, status_history: [] }).notice).toBeNull();
    }
  });

  it('os outros estados mantêm o rótulo que a tela já usava', () => {
    expect(paymentOutcome({ payment_status: 'paid', status_history: [] }).label).toBe('Pago');
    expect(paymentOutcome({ payment_status: 'pending', status_history: [] }).label).toBe(
      'Aguardando pagamento',
    );
  });

  /*
   * Status que o painel não conhece continua caindo no próprio nome — o que é
   * feio, mas honesto. O defeito de `in_review` era ser um estado REAL do
   * backend caindo aí; um valor que ninguém nunca viu não tem tradução a ter.
   */
  it('estado desconhecido não inventa rótulo', () => {
    expect(paymentOutcome({ payment_status: 'algo_novo', status_history: [] }).label).toBe(
      'algo_novo',
    );
  });
});
