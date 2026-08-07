import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '../api/client';
import { createStreamTicket } from '../api/orders';
import type { OrderStreamEvent } from '../api/types';
import { AppliedEventKeys } from './stream-events';

export type StreamStatus = 'connecting' | 'live' | 'offline';

type StreamCallbacks = {
  /** Pedido novo ou mudança de status. `event.order` já vem no formato da lista. */
  onOrderEvent: (event: OrderStreamEvent) => void;
  /** O painel ficou offline tempo demais para o replay. Recarregue a lista. */
  onSyncRequired: () => void;
  /** Reabrimos a conexão do zero — veja o comentário sobre o cursor perdido. */
  onReconnected: () => void;
};

const MAX_RETRY_DELAY_MS = 30_000;

/**
 * Consome `GET /admin/orders/stream` (SSE).
 *
 * Como funciona, e por que assim:
 *
 * 1. TICKET. O EventSource do navegador não manda cabeçalho, então o token de
 *    12h não pode ir na URL (ele acabaria no log do proxy, no Referer e no
 *    histórico). Pedimos um ticket de 30s por POST autenticado e é ele que vai
 *    na querystring.
 *
 * 2. RECONEXÃO É NOSSA, NÃO DO NAVEGADOR. O EventSource reconecta sozinho
 *    reusando a MESMA URL — com o ticket já vencido. Essa retentativa sempre
 *    falha. Por isso, a cada erro, fechamos, pedimos ticket novo e abrimos de
 *    novo, com espera crescente (1s, 2s, 4s… até 30s) para não martelar a API
 *    quando ela estiver fora do ar.
 *
 * 3. O CURSOR SE PERDE NA REABERTURA. O `Last-Event-ID` só é reenviado quando
 *    é o próprio EventSource que reconecta; abrindo um novo, ele se perde — e
 *    não dá para mandá-lo na URL, porque a rota só aceita o parâmetro
 *    `ticket`. A compensação é `onReconnected`: depois de toda reabertura a
 *    tela recarrega a lista inteira, que é o que o replay faria. Só o
 *    caminho é outro.
 *
 * 4. A conexão morre sozinha aos 15 min no backend (para não acumular conexão
 *    zumbi). Para nós isso é só mais um `onerror` seguido de reabertura.
 */
export function useOrderStream(options: { enabled: boolean } & StreamCallbacks): {
  status: StreamStatus;
} {
  const [status, setStatus] = useState<StreamStatus>('connecting');

  // Os callbacks mudam de identidade a cada render do componente pai. Se
  // entrassem nas dependências do efeito, o stream fecharia e reabriria a cada
  // render. Guardados num ref, o efeito só depende de `enabled`.
  const callbacksRef = useRef<StreamCallbacks>(options);
  callbacksRef.current = options;

  const { enabled } = options;

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let retryAttempt = 0;
    let hasConnectedBefore = false;
    const applied = new AppliedEventKeys();

    function closeSource() {
      source?.close();
      source = null;
    }

    function scheduleReopen() {
      if (disposed) return;
      const delay = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** retryAttempt);
      retryAttempt += 1;
      setStatus(navigator.onLine ? 'connecting' : 'offline');
      retryTimer = window.setTimeout(() => void openStream(), delay);
    }

    function handleStreamEvent(event: MessageEvent<string>) {
      let parsed: OrderStreamEvent;
      try {
        parsed = JSON.parse(event.data) as OrderStreamEvent;
      } catch {
        // Linha quebrada no meio do stream. Ignorar é melhor que derrubar a
        // conexão: o próximo poll reenvia o mesmo fato.
        return;
      }

      // Entrega é ao menos uma vez; descartar repetido é obrigação do cliente.
      if (!applied.markIfNew(parsed.event_key)) return;

      if (parsed.type === 'sync_required') {
        callbacksRef.current.onSyncRequired();
        return;
      }
      callbacksRef.current.onOrderEvent(parsed);
    }

    async function openStream() {
      if (disposed) return;

      if (!navigator.onLine) {
        // Sem rede não adianta gastar tentativa: o listener de 'online' reabre.
        setStatus('offline');
        return;
      }

      setStatus('connecting');

      let ticket: string;
      try {
        ticket = (await createStreamTicket()).ticket;
      } catch {
        scheduleReopen();
        return;
      }
      if (disposed) return;

      const url = `${API_BASE_URL}/admin/orders/stream?ticket=${encodeURIComponent(ticket)}`;
      const eventSource = new EventSource(url);
      source = eventSource;

      eventSource.onopen = () => {
        retryAttempt = 0;
        setStatus('live');
        if (hasConnectedBefore) {
          // Ver ponto 3 do comentário do hook: sem cursor, recarregamos tudo.
          callbacksRef.current.onReconnected();
        }
        hasConnectedBefore = true;
      };

      eventSource.onerror = () => {
        closeSource();
        scheduleReopen();
      };

      eventSource.addEventListener('order.created', handleStreamEvent);
      eventSource.addEventListener('order.status_changed', handleStreamEvent);
      eventSource.addEventListener('sync_required', handleStreamEvent);
    }

    function handleOnline() {
      // Voltou a rede: não espera o backoff, reconecta agora.
      window.clearTimeout(retryTimer);
      retryAttempt = 0;
      closeSource();
      void openStream();
    }

    function handleOffline() {
      window.clearTimeout(retryTimer);
      closeSource();
      setStatus('offline');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void openStream();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      closeSource();
    };
  }, [enabled]);

  return { status };
}
