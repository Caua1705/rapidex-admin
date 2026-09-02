import { useEffect, useRef, useState } from 'react';

import { fetchPrintAgentStatus } from '../api/print-agent';
import type { PrintAgentStatus } from '../api/types';
import { INTERVALO_DO_AGENTE_MS } from './print-agent';

/**
 * ============================================================================
 * O ESTADO DO PROGRAMA DE IMPRESSÃO DE VÁRIAS FILIAIS DE UMA VEZ
 * ============================================================================
 *
 * Irmão de `usePrintAgent`, e não uma cópia dele: aquele é de UMA filial e lê
 * três coisas (estado, impressoras e o teste) porque a tela de Impressão mostra
 * as três juntas. Este lê UMA coisa de VÁRIAS filiais, porque quem pergunta é a
 * faixa de Pedidos e de Cozinha — e lá "todas as filiais" é um escopo normal,
 * não um estado a resolver.
 *
 * A cadência é a mesma, e ela é a MESMA CONSTANTE (`INTERVALO_DO_AGENTE_MS`),
 * importada em vez de recopiada: dois trinta-segundos escritos em dois arquivos
 * divergiriam no dia em que a janela do backend mudasse.
 *
 * ----------------------------------------------------------------------------
 * FALHA DE LEITURA NÃO APAGA O QUE JÁ SE SABE, E NÃO INVENTA O QUE NÃO SE SABE
 * ----------------------------------------------------------------------------
 *
 * Uma resposta que não veio deixa a filial com o valor anterior, e uma filial
 * que nunca respondeu simplesmente não entra no mapa. As duas coisas dizem o
 * mesmo: o painel não passa a AFIRMAR nada por causa de uma queda de rede. É a
 * regra que a faixa depende para não gritar "nenhuma comanda está saindo" toda
 * vez que o wi-fi do balcão pisca.
 *
 * ELE PARA COM A ABA ESCONDIDA, como o vizinho: uma aba esquecida aberta a
 * noite inteira faria 2.880 requisições por filial para responder uma pergunta
 * que ninguém está lendo. Ao voltar, relê na hora.
 */
export function useAgentesDasFiliais(
  branchIds: readonly string[],
): ReadonlyMap<string, PrintAgentStatus> {
  const [porFilial, setPorFilial] = useState<ReadonlyMap<string, PrintAgentStatus>>(new Map());

  /**
   * A LISTA VIRA TEXTO PARA SER DEPENDÊNCIA DE EFEITO.
   *
   * `branchIds` é um array novo a cada render do componente pai; usá-lo direto
   * reabriria o intervalo a cada render, e o balcão faria uma requisição por
   * quadro de animação. O texto só muda quando as filiais mudam de verdade.
   */
  const chave = branchIds.join(',');

  /** Descarta a resposta de um escopo que já não é o da tela. */
  const requestRef = useRef(0);

  useEffect(() => {
    const ids = chave ? chave.split(',') : [];
    if (ids.length === 0) {
      setPorFilial(new Map());
      return;
    }

    const requestId = ++requestRef.current;
    let cancelled = false;

    async function ler() {
      const lidos = await Promise.all(
        ids.map(async (branchId) => {
          try {
            return [branchId, await fetchPrintAgentStatus(branchId)] as const;
          } catch {
            // Ver o cabeçalho: sem resposta, esta filial fica com o que já
            // havia — e sem nada, ela fica de fora do mapa e da faixa.
            return null;
          }
        }),
      );
      if (cancelled || requestId !== requestRef.current) return;

      setPorFilial((atual) => {
        const proximo = new Map(atual);
        for (const lido of lidos) if (lido) proximo.set(lido[0], lido[1]);
        // O escopo encolheu: filial que saiu de vista não fica no mapa
        // afirmando o estado de uma loja que a tela não está mostrando.
        for (const conhecido of proximo.keys()) {
          if (!ids.includes(conhecido)) proximo.delete(conhecido);
        }
        return proximo;
      });
    }

    void ler();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void ler();
    }, INTERVALO_DO_AGENTE_MS);

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void ler();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [chave]);

  return porFilial;
}
