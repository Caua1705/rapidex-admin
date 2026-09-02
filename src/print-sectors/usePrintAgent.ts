import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import {
  fetchPrintAgentStatus,
  listPrintAgentPrinters,
  requestPrintTest,
} from '../api/print-agent';
import type { PrintAgentPrinter, PrintAgentStatus, PrintTestRequest } from '../api/types';
import { INTERVALO_DO_AGENTE_MS } from './print-agent';

/*
 * A CADÊNCIA MORA EM `print-agent.ts`, e não mais aqui.
 *
 * Ela deixou de ser de uma tela quando a faixa de Pedidos e de Cozinha passou a
 * ler a mesma rota (`useAgentesDasFiliais`): duas constantes de 30 segundos em
 * dois arquivos divergiriam no dia em que a janela do backend mudasse, e a
 * divergência apareceria como uma tela avisando antes da outra.
 */

export type PrintTestOutcome = {
  /** O que foi escolhido, escrito, para a frase de retorno nomear o destino. */
  destino: string;
  /** O comando foi gravado — mas a via só sai se o agente estiver no ar. */
  agentIsOnline: boolean;
};

/**
 * ============================================================================
 * O PROGRAMA DE IMPRESSÃO DAQUELA FILIAL: como está, o que enxerga, e a ordem
 * ============================================================================
 *
 * Um hook para as três rotas porque as três falam da MESMA máquina e são lidas
 * na mesma respiração: "o programa está rodando?", "quais impressoras ele
 * enxerga?" e "manda uma via de teste". Separá-las daria três estados de
 * carregamento para um bloco só de tela, e a lista de impressoras precisaria
 * saber do estado do agente para dizer por que está vazia.
 *
 * ELE RELÊ SOZINHO, e essa é a diferença entre esta tela e as outras de Minha
 * loja. As demais mostram o que o lojista gravou — não muda sem ele. Esta
 * mostra o estado de um computador em outra sala, que cai sem avisar. Uma tela
 * de balcão que fica aberta o turno inteiro afirmando "Rodando agora" desde as
 * dezenove horas é exatamente o defeito que o bloco antigo se recusava a ter
 * quando preferia dizer "o painel ainda não mostra se o programa está rodando".
 *
 * ELE PARA COM A ABA ESCONDIDA. Sem isso, uma aba aberta e esquecida faria
 * 2.880 requisições por noite para responder uma pergunta que ninguém está
 * lendo. Ao voltar, relê na hora — quem volta para a aba quer o estado de
 * agora, não o de quando saiu.
 *
 * ERRO AQUI NÃO DERRUBA A TELA: os setores continuam listados e editáveis ao
 * lado, como na contagem de itens. Um bloco que não conseguiu falar diz isso no
 * lugar do estado, e é só.
 */
export function usePrintAgent(branchId: string) {
  const [status, setStatus] = useState<PrintAgentStatus | null>(null);
  const [printers, setPrinters] = useState<readonly PrintAgentPrinter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testOutcome, setTestOutcome] = useState<PrintTestOutcome | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  /** Descarta a resposta de uma filial que já não é a que está na tela. */
  const requestRef = useRef(0);

  useEffect(() => {
    if (!branchId) {
      setStatus(null);
      setPrinters([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    const requestId = ++requestRef.current;
    let cancelled = false;
    setIsLoading(true);

    async function ler() {
      try {
        /*
         * As duas em paralelo: são leituras independentes da mesma máquina, e
         * em série a segunda esperaria a primeira para nada. O `Promise.all`
         * também faz as duas falharem juntas, que é o certo — meia leitura
         * (estado sem impressoras) não é um estado que a tela saiba desenhar.
         */
        const [proximoStatus, proximasImpressoras] = await Promise.all([
          fetchPrintAgentStatus(branchId),
          listPrintAgentPrinters(branchId),
        ]);
        if (cancelled || requestId !== requestRef.current) return;
        setStatus(proximoStatus);
        setPrinters(proximasImpressoras);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled || requestId !== requestRef.current) return;
        setErrorMessage(messageFromUnknownError(error));
      } finally {
        if (!cancelled && requestId === requestRef.current) setIsLoading(false);
      }
    }

    void ler();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void ler();
    }, INTERVALO_DO_AGENTE_MS);

    // Voltar para a aba relê na hora: o intervalo sozinho deixaria até 30
    // segundos de estado velho na tela justamente no instante em que alguém
    // voltou para olhá-lo.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void ler();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [branchId]);

  /**
   * Enfileira a via de teste.
   *
   * `destino` é só para a frase de retorno: o backend não devolve o nome do que
   * resolveu, e "Teste enviado" sem dizer para onde não confere nada — o
   * lojista precisa saber qual impressora olhar.
   */
  const sendTest = useCallback(
    async (body: PrintTestRequest, destino: string): Promise<boolean> => {
      if (!branchId) return false;
      setIsTesting(true);
      setTestError(null);
      setTestOutcome(null);
      try {
        const result = await requestPrintTest(branchId, body);
        setTestOutcome({ destino, agentIsOnline: result.agent_is_online });
        return true;
      } catch (error) {
        setTestError(messageFromUnknownError(error));
        return false;
      } finally {
        setIsTesting(false);
      }
    },
    [branchId],
  );

  return {
    status,
    printers,
    isLoading,
    errorMessage,
    isTesting,
    testOutcome,
    testError,
    sendTest,
  };
}
