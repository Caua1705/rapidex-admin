import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchCourierReport } from '../api/couriers';
import type { CourierReport } from '../api/types';
import { problemaDoPeriodo } from './courier-report';

export type PeriodoDoRelatorio = { startDate: string; endDate: string };

/**
 * O relatório de quanto a loja deve a cada entregador.
 *
 * ELE NÃO BUSCA COM PERÍODO INVÁLIDO. O teto de 92 dias e a data invertida são
 * recusados antes da rede (`problemaDoPeriodo`): o backend responde 400 com uma
 * frase que não diz qual campo mexer, e uma ida à rede para saber uma regra que
 * já se sabia é uma ida a menos que o dono espera no dia de pagar.
 *
 * A FILIAL VAI SÓ SE ESCOLHIDA. `branch_id` omitido soma o restaurante inteiro
 * — ele só restringe. Quem não é dono precisa mandá-lo (403 sem ele), e quem
 * sabe disso do lado da tela é `podeLerDinheiro`.
 *
 * E QUANDO A TELA JÁ SABE QUE A RESPOSTA É 403, ELA NÃO PERGUNTA: `habilitado`
 * é falso para o gerente sem recorte, e o hook não sai. É a mesma regra do teto
 * de 92 dias — ir à rede para ser informado de uma recusa que já se sabia gasta
 * a espera do dono e devolve uma frase que não diz qual controle mexer. Sem
 * isso, "Todas as filiais" no topo faria a tela do gerente pedir a filial e
 * mandar a consulta proibida no mesmo instante.
 */
export function useCourierReport(
  periodo: PeriodoDoRelatorio,
  branchId: string,
  habilitado: boolean,
) {
  const [relatorio, setRelatorio] = useState<CourierReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Descarta a resposta de um período que já não é o da tela. */
  const requestRef = useRef(0);

  const problema = problemaDoPeriodo(periodo);

  const carregar = useCallback(async () => {
    /*
     * SEM PERMISSÃO DE LEITURA, NÃO HÁ CONSULTA — e o que está na tela fica,
     * pelo mesmo motivo do período inválido logo abaixo.
     */
    if (!habilitado) {
      setIsLoading(false);
      return;
    }

    if (problema) {
      /*
       * PERÍODO INVÁLIDO NÃO ZERA O RELATÓRIO NA TELA. O que estava lá continua
       * lá, com o aviso ao lado: quem está digitando a data final passa por
       * estados inválidos no meio da digitação, e apagar a tabela a cada tecla
       * faria a tela piscar enquanto o dono escreve.
       */
      setIsLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const lido = await fetchCourierReport({
        startDate: periodo.startDate,
        endDate: periodo.endDate,
        branchId: branchId || undefined,
      });
      if (requestId !== requestRef.current) return;
      setRelatorio(lido);
      setErrorMessage(null);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      /*
       * A LEITURA QUE FALHOU NÃO VIRA "NADA A PAGAR". O relatório fica como
       * estava e o erro aparece — zerar a tabela por causa de uma queda de rede
       * é a tela dizendo ao dono que ele não deve nada a ninguém, no dia em que
       * ele abriu justamente para pagar.
       */
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, [periodo.startDate, periodo.endDate, branchId, problema, habilitado]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { relatorio, isLoading, errorMessage, problema, recarregar: carregar };
}
