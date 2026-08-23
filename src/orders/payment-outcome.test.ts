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

  it('quem não estornou não ganha aviso nenhum', () => {
    for (const payment_status of ['paid', 'pending', 'failed', 'on_delivery']) {
      expect(paymentOutcome({ payment_status, status_history: [] }).notice).toBeNull();
    }
  });

  it('os outros estados mantêm o rótulo que a tela já usava', () => {
    expect(paymentOutcome({ payment_status: 'paid', status_history: [] }).label).toBe('Pago');
    expect(paymentOutcome({ payment_status: 'pending', status_history: [] }).label).toBe(
      'Aguardando pagamento',
    );
  });
});
