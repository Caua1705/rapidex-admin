import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { assignOrders, fetchOrderCourier, unassignOrder } from '../api/couriers';
import type { Courier, OrderCourier } from '../api/types';
import { fraseDaRecusa, quemEstaCom, resumoDoLote } from './assignment-model';

/**
 * ============================================================================
 * QUEM ESTÁ COM ESTE PEDIDO — no detalhe, e sob demanda nenhuma
 * ============================================================================
 *
 * ELE CARREGA JUNTO COM O DETALHE, e não ao clique — a diferença para a comanda
 * (`useOrderPrintJobs`) é o que a informação decide. A comanda se consulta
 * quando a impressora deu problema, uma vez por turno no dia ruim; "quem está
 * com o pedido" é a pergunta que o lojista faz olhando a tela, no meio do
 * telefonema com o cliente que ligou perguntando da entrega.
 *
 * O DETALHE NÃO TRAZ O ENTREGADOR (conferido no contrato: `OrderDetailResponse`
 * não tem os campos), então é uma requisição a mais por pedido aberto. É o
 * mesmo custo que o histórico do cliente paga, e pela mesma razão.
 *
 * ----------------------------------------------------------------------------
 * TRÊS ESTADOS, E NENHUM SE CONFUNDE COM OS OUTROS
 * ----------------------------------------------------------------------------
 *
 *   `undefined`  a leitura não voltou — a tela não afirma nada;
 *   `null`       ninguém pegou. É 200 com os dois campos nulos, estado NORMAL;
 *   o entregador quem está com ele agora.
 *
 * O 404 é o pedido fora do escopo deste lojista, e vira `errorMessage` — nunca
 * "ninguém ainda".
 */
export function useOrderCourier(orderId: string | null, habilitado: boolean) {
  const [resposta, setResposta] = useState<OrderCourier | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  /** De qual pedido é a resposta que está chegando. Ver `useOrderPrintJobs`. */
  const pedidoEmVoo = useRef<string | null>(orderId);

  useEffect(() => {
    pedidoEmVoo.current = orderId;
    setResposta(undefined);
    setErrorMessage(null);
    setProblema(null);

    if (!orderId || !habilitado) return;

    void (async () => {
      try {
        const lida = await fetchOrderCourier(orderId);
        if (pedidoEmVoo.current !== orderId) return;
        setResposta(lida);
      } catch (error) {
        if (pedidoEmVoo.current !== orderId) return;
        setErrorMessage(messageFromUnknownError(error));
      }
    })();
  }, [orderId, habilitado]);

  /**
   * Atribui ESTE pedido, pela rota de LOTE com um item só.
   *
   * A rota de lote é a única que existe, e usá-la com um item mantém o caminho
   * por-item exercitado desde o primeiro dia: a resposta vem 200 mesmo com o
   * pedido recusado, e é o `ok` do item que decide. Um atalho que lesse o 200
   * como sucesso mentiria exatamente no caso que importa.
   *
   * REATRIBUIR É A MESMA CHAMADA com outro entregador — não há rota de troca, e
   * atribuir ao mesmo de novo é no-op no backend, então o clique duplo é
   * inofensivo.
   */
  const atribuir = useCallback(
    async (courier: Courier, filialDoEntregador: string): Promise<boolean> => {
      if (!orderId) return false;

      setIsSaving(true);
      setProblema(null);
      try {
        const lote = await assignOrders(courier.id, [orderId]);
        const resumo = resumoDoLote(lote.items);

        if (!resumo.tudoCerto) {
          const recusa = resumo.recusados[0]!;
          setProblema(
            fraseDaRecusa(recusa.motivo, { entregador: courier.name, filialDoEntregador }),
          );
          return false;
        }

        /*
         * O ESTADO VEM DA RESPOSTA, e não de uma releitura: a rota já disse que
         * gravou, e reler seria uma segunda ida à rede para confirmar o que
         * acabou de ser afirmado. O `assignment` do item traz o vínculo; o
         * entregador é o que a tela já tem na mão.
         */
        setResposta({ courier, assignment: lote.items[0]?.assignment ?? null });
        return true;
      } catch (error) {
        setProblema(messageFromUnknownError(error));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [orderId],
  );

  /**
   * Tira o pedido de quem estiver com ele.
   *
   * O 409 AQUI TEM SIGNIFICADO PRÓPRIO e o contrato o descreve: ninguém está
   * com o pedido, o que é clique repetido ou tela velha. A frase do backend já
   * diz isso; o que a tela acrescenta é o que fazer — recarregar —, porque a
   * segunda leitura é o que desfaz a tela velha.
   */
  const desatribuir = useCallback(async (): Promise<boolean> => {
    if (!orderId) return false;

    setIsSaving(true);
    setProblema(null);
    try {
      await unassignOrder(orderId);
      setResposta({ courier: null, assignment: null });
      return true;
    } catch (error) {
      setProblema(messageFromUnknownError(error));
      /*
       * DEPOIS DE UM 409, A TELA ESTÁ VELHA POR DEFINIÇÃO — releia. Sem isto, o
       * lojista fica olhando um entregador que já não está com o pedido e o
       * botão continua dizendo que dá para tirá-lo.
       */
      try {
        const lida = await fetchOrderCourier(orderId);
        if (pedidoEmVoo.current === orderId) setResposta(lida);
      } catch {
        // A releitura é conforto, não obrigação: se ela também falhar, o que
        // vale é a mensagem da recusa, que já está na tela.
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [orderId]);

  return {
    entregador: quemEstaCom(resposta),
    errorMessage,
    problema,
    isSaving,
    atribuir,
    desatribuir,
  };
}
