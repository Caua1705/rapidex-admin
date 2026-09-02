import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOrderStream } from './useOrderStream';
import { LIMITE_DE_SILENCIO_MS, TETO_DA_CONEXAO_MS } from './stream-health';

/*
 * ============================================================================
 * A CONEXÃO ABERTA QUE PAROU DE ENTREGAR
 * ============================================================================
 *
 * O único buraco de tempo real que sobrava, e o mais difícil de descobrir:
 * proxy que bufferiza, rede que segura o socket, worker travado. O `onerror`
 * nunca dispara, a etiqueta continua dizendo "Tempo real", e o quadro para de
 * receber pedido sem que nada acuse.
 *
 * O TESTE PRECISA DE UM `EventSource` FALSO porque o relógio que se quer provar
 * mede o SILÊNCIO — e silêncio não se dubla com resposta de rede: dubla-se com
 * um objeto que abre e depois não faz absolutamente nada, que é exatamente o
 * defeito.
 */
vi.mock('../api/orders', () => ({ createStreamTicket: vi.fn() }));

const { createStreamTicket } = await import('../api/orders');
const pedirTicket = vi.mocked(createStreamTicket);

/** As conexões abertas nesta execução, na ordem. A última é a de agora. */
let abertas: FakeEventSource[] = [];

class FakeEventSource {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  fechada = false;
  readonly ouvintes = new Map<string, (event: MessageEvent<string>) => void>();

  constructor(readonly url: string) {
    abertas.push(this);
  }

  addEventListener(tipo: string, ouvinte: (event: MessageEvent<string>) => void) {
    this.ouvintes.set(tipo, ouvinte);
  }

  close() {
    this.fechada = true;
  }

  /** O servidor aceitou a conexão. */
  abrir() {
    this.onopen?.();
  }

  /** Um pedido novo chegou por esta conexão. */
  entregar(eventKey: string) {
    this.ouvintes.get('order.created')?.(
      new MessageEvent('order.created', {
        data: JSON.stringify({ type: 'order.created', event_key: eventKey, order: {} }),
      }),
    );
  }
}

const callbacks = () => ({
  onOrderEvent: vi.fn(),
  onSyncRequired: vi.fn(),
  onReconnected: vi.fn(),
});

beforeEach(() => {
  abertas = [];
  pedirTicket.mockReset();
  pedirTicket.mockResolvedValue({ ticket: 'tkt', expires_in_seconds: 30 });
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** Abre a conexão e espera o `onopen` — o ponto de partida de todos os casos. */
async function conectar() {
  const cbs = callbacks();
  const hook = renderHook(() => useOrderStream({ enabled: true, ...cbs }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    abertas[0]!.abrir();
  });

  expect(hook.result.current.status).toBe('live');
  return { hook, cbs };
}

/** Deixa o relógio andar sem que nada chegue pela conexão. */
async function silencio(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useOrderStream: o relógio do silêncio', () => {
  /*
   * O CICLO NORMAL DO BACKEND NÃO PODE ACENDER NADA. Toda conexão morre aos 15
   * minutos de propósito; se o limite fosse mais curto, TODA loja veria "sem
   * sinal" a cada quarto de hora e a etiqueta viraria papel de parede.
   */
  it('quinze minutos de silêncio ainda são o funcionamento normal', async () => {
    const { hook } = await conectar();

    await silencio(TETO_DA_CONEXAO_MS);

    expect(hook.result.current.status).toBe('live');
    expect(abertas).toHaveLength(1);
  });

  it('passado o limite, a etiqueta deixa de dizer "tempo real"', async () => {
    const { hook } = await conectar();

    await silencio(LIMITE_DE_SILENCIO_MS + 60_000);

    expect(hook.result.current.status).toBe('stale');
  });

  /*
   * A ETIQUETA NÃO BASTA. Contar ao lojista que o painel parou e não fazer nada
   * a respeito é meio conserto: o remédio de uma conexão morta é uma conexão
   * nova — e é ela que arrasta a recarga da lista.
   */
  it('o diagnóstico refaz a conexão, e não só o rótulo', async () => {
    await conectar();

    await silencio(LIMITE_DE_SILENCIO_MS + 60_000);

    expect(abertas).toHaveLength(2);
    expect(abertas[0]!.fechada).toBe(true);
  });

  /*
   * ENQUANTO A CONEXÃO NOVA NÃO ENTREGA, O DIAGNÓSTICO FICA DE PÉ. A própria
   * reabertura passa por `connecting`, e deixá-la vencer apagaria em um quadro
   * a única etiqueta que contava ao lojista por que o quadro tinha parado.
   */
  it('reabrir não apaga o aviso antes de a conexão nova abrir', async () => {
    const { hook } = await conectar();

    await silencio(LIMITE_DE_SILENCIO_MS + 60_000);
    expect(hook.result.current.status).toBe('stale');

    await act(async () => {
      abertas[1]!.abrir();
    });

    expect(hook.result.current.status).toBe('live');
  });

  /*
   * UM EVENTO É SINAL DE VIDA, e o relógio recomeça dele. Uma loja movimentada
   * nunca chega perto do limite — o que é o desenho: o aviso é para o silêncio
   * anormal, não para o intervalo entre dois pedidos.
   */
  it('pedido que chega zera o relógio', async () => {
    const { hook } = await conectar();

    await silencio(LIMITE_DE_SILENCIO_MS - 60_000);
    await act(async () => {
      abertas[0]!.entregar('evt-1');
    });
    await silencio(LIMITE_DE_SILENCIO_MS - 60_000);

    expect(hook.result.current.status).toBe('live');
    expect(abertas).toHaveLength(1);
  });
});
