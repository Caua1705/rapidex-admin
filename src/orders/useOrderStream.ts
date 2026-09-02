import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '../api/client';
import { createStreamTicket } from '../api/orders';
import type { OrderStreamEvent } from '../api/types';
import { AppliedEventKeys } from './stream-events';
import { fluxoParado, PASSO_DO_RELOGIO_MS } from './stream-health';

export type StreamStatus = 'connecting' | 'live' | 'offline' | 'stale';

/**
 * O RÓTULO DE CADA ESTADO, NUM MAPA SÓ.
 *
 * Eram dois: um em `OrdersToolbar` e outro em `KitchenPage`, com textos já
 * diferentes ("Tempo real" e "Tempo real ligado") — e o da Cozinha era
 * `Record<string, string>`, então um estado novo NÃO daria erro de compilação
 * lá: a etiqueta simplesmente ficaria vazia na tela que fica pendurada na
 * parede. É o defeito da barra de navegação outra vez, e por isso o mapa mora
 * ao lado do tipo que ele cobre.
 */
export const STREAM_LABELS: Record<StreamStatus, string> = {
  live: 'Tempo real',
  connecting: 'Reconectando…',
  offline: 'Sem conexão',
  stale: 'Sem sinal do servidor',
};

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
 *    zumbi). Para nós isso é só mais um `onerror` seguido de reabertura — e é
 *    também a GARANTIA em que o relógio de silêncio se apoia (ponto 5).
 *
 * 5. CONEXÃO ABERTA QUE PAROU DE ENTREGAR. Os quatro pontos acima cuidam da
 *    conexão que QUEBRA; nenhum deles enxerga a que fica aberta e muda. Sem o
 *    relógio abaixo, `live` era dito no `onopen` e nunca mais reavaliado: o
 *    painel afirmava tempo real enquanto o quadro parava. Ver `stream-health.ts`
 *    para por que o limite sai do teto do backend e não do movimento da loja.
 */
export function useOrderStream(options: { enabled: boolean } & StreamCallbacks): {
  status: StreamStatus;
} {
  const [status, setStatus] = useState<StreamStatus>('connecting');

  /**
   * O ÚLTIMO INSTANTE EM QUE O SERVIDOR DEU SINAL — evento ou reabertura.
   *
   * Estado, e não `ref`: o relógio abaixo precisa que a tela repinte quando
   * ele muda de lado. `null` enquanto nada chegou.
   */
  const [ultimoSinal, setUltimoSinal] = useState<number | null>(null);

  /**
   * O DIAGNÓSTICO DO RELÓGIO, separado do estado da conexão.
   *
   * São dois fatos diferentes e cada um tem um dono: `status` conta o que o
   * `EventSource` fez, `parado` conta o que o relógio concluiu. Guardar os
   * dois na mesma variável fazia a reabertura apagar o diagnóstico no primeiro
   * `setStatus('connecting')` — e a etiqueta que o lojista precisava ler
   * piscava por um quadro e sumia.
   */
  const [parado, setParado] = useState(false);

  /** Reabrir a conexão de fora do efeito que a criou. Ver o relógio, no fim. */
  const reabrirRef = useRef<(() => void) | null>(null);

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
      /*
       * O SINAL DE VIDA É ANTES DA DEDUPLICAÇÃO. Um evento repetido não muda a
       * tela, mas prova que a conexão está entregando — descartá-lo aqui faria
       * o relógio contar silêncio que não houve.
       */
      setUltimoSinal(Date.now());

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
        // A conexão nova entregou: o diagnóstico do relógio caiu por terra.
        setUltimoSinal(Date.now());
        setParado(false);
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
      /*
       * "SEM CONEXÃO" EXPLICA MELHOR QUE "SEM SINAL DO SERVIDOR", e é uma
       * explicação que o navegador ACABOU de dar. Deixar o diagnóstico do
       * relógio por cima diria ao lojista que o problema está do outro lado
       * quando ele está no wi-fi da loja.
       */
      setParado(false);
    }

    reabrirRef.current = handleOnline;

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

  /*
   * ==========================================================================
   * O RELÓGIO DO SILÊNCIO
   * ==========================================================================
   *
   * Efeito próprio, e de propósito: ele não pode morar dentro do efeito da
   * conexão, que só depende de `enabled` — lá ele nunca releria `ultimoSinal`.
   *
   * O PASSO É DE UM MINUTO para um limite de vinte: um relógio mais fino não
   * responderia nada diferente e acordaria a tela sessenta vezes mais. Ele
   * também não precisa de precisão nenhuma — a aba escondida tem os timers
   * estrangulados pelo navegador, e chegar atrasado só adia o diagnóstico, que
   * é o lado barato do erro.
   */
  useEffect(() => {
    if (!enabled || ultimoSinal === null) return;

    const timer = window.setInterval(() => {
      if (fluxoParado(ultimoSinal, Date.now())) setParado(true);
    }, PASSO_DO_RELOGIO_MS);

    return () => window.clearInterval(timer);
  }, [enabled, ultimoSinal]);

  /*
   * O DIAGNÓSTICO MUDA A ETIQUETA **E** REFAZ A CONEXÃO.
   *
   * Só mudar a etiqueta seria contar ao lojista que o painel parou e não fazer
   * nada a respeito. O remédio de uma conexão morta é uma conexão nova — e a
   * reabertura ainda arrasta a recarga da lista (`onReconnected`), que é o que
   * repõe os pedidos que entraram durante o silêncio.
   *
   * A reabertura sai daqui, e não de dentro do intervalo, para acontecer UMA
   * vez por diagnóstico em vez de uma por volta do relógio. Se a conexão nova
   * também emudecer, o ciclo recomeça vinte minutos depois — três vezes por
   * hora no pior caso, que é barato.
   */
  useEffect(() => {
    if (!parado) return;
    setUltimoSinal(Date.now());
    reabrirRef.current?.();
  }, [parado]);

  /*
   * O DIAGNÓSTICO VENCE O ESTADO DA CONEXÃO enquanto durar. Sem isto, o
   * `setStatus('connecting')` da própria reabertura apagaria em um quadro a
   * única etiqueta que contava ao lojista por que o quadro tinha parado.
   */
  return { status: parado ? 'stale' : status };
}
