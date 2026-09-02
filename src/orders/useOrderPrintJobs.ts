import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchOrderPrintJobs } from '../api/orders';
import { fetchPrintAgentStatus } from '../api/print-agent';
import type { OrderPrintJobs, PrintAgentStatus } from '../api/types';

/**
 * ============================================================================
 * AS VIAS DE UM PEDIDO — carregadas SÓ QUANDO O LOJISTA PEDE
 * ============================================================================
 *
 * POR QUE SOB DEMANDA, e não junto do detalhe:
 *
 * O detalhe do pedido abre a cada clique na lista, e no pico o lojista percorre
 * dezenas deles em minutos. Carregar as vias junto seria uma segunda requisição
 * por pedido aberto — para um dado que ele consulta quando a impressora deu
 * problema, que é uma vez por turno no dia ruim e nenhuma no dia bom.
 *
 * É a mesma economia que fez o histórico do cliente não piscar "carregando…":
 * o painel do pedido é lido com pressa, e o que não é da decisão do momento não
 * pode disputar rede nem atenção com o que é.
 *
 * O ERRO AQUI **NÃO É SILENCIOSO**, e é a diferença para `useCustomerHistory`.
 * Lá o dado é de apoio e a linha some sem avisar; aqui o lojista APERTOU um
 * botão, e um botão que não faz nada é o defeito que ele veio investigar. A
 * mensagem aparece.
 *
 * O ESTADO DO PROGRAMA VEM JUNTO, e vem no MESMO clique.
 *
 * A pergunta que traz alguém até aqui é "a comanda saiu?", e a resposta tem
 * duas metades: o que o sistema mandou (as vias) e se a máquina que imprime
 * estava de pé (o agente). O bloco só sabia a primeira, e por isso terminava
 * mandando conferir a segunda em Loja › Impressão — um endereço no lugar de
 * uma resposta, escrito na tela onde a resposta cabia.
 *
 * AS DUAS NÃO FALHAM JUNTAS, ao contrário do que `usePrintAgent` faz com as
 * dela. Lá meia leitura não é um estado desenhável; aqui é: sem o estado do
 * programa, a comanda continua valendo, e a linha volta a ser a frase neutra —
 * `linhaDaComanda(undefined)`. O contrário é que seria ruim, e é o defeito que
 * esta rodada varreu: afirmar "nada sai no papel" porque uma leitura caiu.
 *
 * TROCAR DE PEDIDO FECHA O BLOCO. O estado carregado é do pedido anterior, e
 * mostrar a comanda do #1041 sob o cabeçalho do #1042 é pior do que não mostrar
 * nenhuma — ainda mais numa tela cuja razão de existir é conferir o que saiu no
 * papel daquele pedido.
 */
export type OrderPrintJobsState = {
  vias: OrderPrintJobs | null;
  /**
   * O programa de impressão daquela filial, ou `undefined` enquanto não se
   * sabe — antes do clique, e também quando a leitura falhou. Ver o cabeçalho:
   * "não perguntei" e "está desligado" não podem virar a mesma frase.
   */
  agente: PrintAgentStatus | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  /** Já foi pedido nesta abertura? É o que decide o bloco abrir ou não. */
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
};

export function useOrderPrintJobs(
  orderId: string | null,
  /** A filial DO PEDIDO (`detail.branch_id`) — a máquina é a daquela loja. */
  branchId: string | null,
): OrderPrintJobsState {
  const [vias, setVias] = useState<OrderPrintJobs | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agente, setAgente] = useState<PrintAgentStatus | undefined>(undefined);
  const [aberto, setAberto] = useState(false);

  /*
   * DE QUAL PEDIDO É A RESPOSTA QUE ESTÁ CHEGANDO.
   *
   * Sem isto existe uma corrida com consequência ruim: o lojista abre a comanda
   * do #1041, a rede demora, ele clica no #1042 — e a resposta atrasada do
   * #1041 cai na tela sob o cabeçalho do #1042. Limpar o estado na troca (o
   * efeito abaixo) não resolve, porque a promessa em voo grava DEPOIS da
   * limpeza. O `ref` é lido no momento de gravar, e é a única leitura que
   * enxerga o pedido de agora.
   */
  const pedidoEmVoo = useRef<string | null>(orderId);

  // Pedido novo, bloco fechado e memória limpa. Ver o comentário do módulo.
  useEffect(() => {
    pedidoEmVoo.current = orderId;
    setVias(null);
    setAgente(undefined);
    setErrorMessage(null);
    setIsLoading(false);
    setAberto(false);
  }, [orderId]);

  /*
   * ABRIR SEMPRE RELÊ, e isso é de propósito.
   *
   * A rota é um GET repetível por desenho do backend (ela não marca nada como
   * impresso justamente para que reimprimir seja um GET a mais). E o conteúdo
   * MUDA durante a vida do pedido: o pagamento confirma e a via de produção
   * passa a existir. Um cache aqui mostraria "sai só a via do cliente" depois
   * de o Pix ter caído — que é exatamente o momento em que o lojista abre isto.
   */
  const abrir = useCallback(() => {
    if (!orderId) return;

    setAberto(true);
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      /*
       * O ESTADO DO PROGRAMA VAI EM PARALELO E CAI SOZINHO.
       *
       * `catch` próprio, e não um `Promise.all`: uma falha aqui não pode
       * levar junto a comanda, que é o que o lojista veio ver. Sem resposta,
       * `agente` fica `undefined` e a linha não afirma nada.
       */
      if (branchId) {
        void fetchPrintAgentStatus(branchId)
          .then((lido) => {
            if (pedidoEmVoo.current === orderId) setAgente(lido);
          })
          .catch(() => {});
      }

      try {
        const carregadas = await fetchOrderPrintJobs(orderId);
        if (pedidoEmVoo.current !== orderId) return;
        setVias(carregadas);
      } catch (error) {
        if (pedidoEmVoo.current !== orderId) return;
        setVias(null);
        setErrorMessage(messageFromUnknownError(error));
      } finally {
        if (pedidoEmVoo.current === orderId) setIsLoading(false);
      }
    })();
  }, [orderId, branchId]);

  const fechar = useCallback(() => setAberto(false), []);

  return { vias, agente, isLoading, errorMessage, aberto, abrir, fechar };
}
