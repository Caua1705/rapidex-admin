import { useEffect, useRef, useState } from 'react';

import { listCustomers } from '../api/customers';
import { phoneDigits } from '../customers/customer-model';
import type { CustomerListItem } from '../api/types';

/**
 * QUANTOS ITENS PEDIR.
 *
 * A busca é por telefone e o backend agrupa por telefone, então a resposta certa
 * tem UM item. Pedimos alguns a mais porque o casamento pode não ser exato: se o
 * cadastro guardou o número com o código do país e o pedido guardou sem, a busca
 * por dígitos pode devolver vizinhos. Quem desempata é a comparação abaixo, e
 * cinco linhas é folga suficiente para achar a certa sem baixar uma página.
 */
const LIMITE = 5;

/**
 * ============================================================================
 * O HISTÓRICO DO CLIENTE, no detalhe do pedido
 * ============================================================================
 *
 * A PERGUNTA QUE ELE RESPONDE: "esta pessoa volta sempre?". Ela é feita antes de
 * aceitar o pedido, e até agora só existia numa outra tela — o lojista teria de
 * sair de Pedidos, abrir Clientes, procurar o telefone e voltar. Ninguém faz
 * isso no meio do turno, então na prática a informação não existia.
 *
 * NÃO EXISTE ROTA NOVA AQUI, e não foi preciso inventar nenhuma:
 * `GET /admin/customers` aceita `search` = "Telefone (só dígitos) ou parte do
 * nome" (está no contrato gerado), e é a MESMA rota que a tela de Clientes já
 * usa. O que este hook faz é perguntar por um telefone em vez de por um termo
 * digitado.
 *
 * O CASAMENTO É POR DÍGITOS, NÃO PELA STRING. O pedido guarda
 * `customer_phone_snapshot` e a lista de clientes guarda `customer_phone`; os
 * dois podem ter formatos diferentes para a mesma pessoa. `phoneDigits` reduz os
 * dois à mesma forma antes de comparar — e se nenhum item casar, o hook devolve
 * `null` em vez do primeiro da lista. Mostrar o histórico da pessoa errada ao
 * lado do endereço de entrega é pior que não mostrar histórico nenhum.
 *
 * A FILIAL É A MESMA DO QUADRO. Com "Aldeota" no cabeçalho, a lista mostra os
 * pedidos da Aldeota e o histórico conta os pedidos da Aldeota; com "todas",
 * ambos somam tudo. Os dois números que o lojista vê na tela respondem sempre ao
 * mesmo recorte — um contador de restaurante ao lado de uma lista de filial
 * seria a mesma pergunta com duas respostas.
 *
 * O ERRO É SILENCIOSO, DE PROPÓSITO. Este é um dado de APOIO: o painel existe
 * para mostrar o pedido, e uma tarja vermelha no bloco do cliente porque uma
 * leitura secundária falhou tiraria a atenção do que importa. Sem resposta, a
 * linha simplesmente não aparece.
 */
export type CustomerHistory = {
  customer: CustomerListItem | null;
  isLoading: boolean;
};

export function useCustomerHistory(
  phone: string | null | undefined,
  branchId: string,
): CustomerHistory {
  const [customer, setCustomer] = useState<CustomerListItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /*
   * A memória do que já foi perguntado nesta visita.
   *
   * O lojista clica de pedido em pedido — e no pico é o mesmo punhado de
   * clientes. Sem isto, voltar a um pedido já aberto refaz a mesma pergunta ao
   * backend. A chave é telefone + filial porque a resposta muda com o recorte.
   */
  const cache = useRef(new Map<string, CustomerListItem | null>());

  const digits = phone ? phoneDigits(phone) : '';

  useEffect(() => {
    if (digits === '') {
      setCustomer(null);
      setIsLoading(false);
      return;
    }

    const chave = `${branchId}|${digits}`;
    const guardado = cache.current.get(chave);
    if (guardado !== undefined) {
      setCustomer(guardado);
      setIsLoading(false);
      return;
    }

    let cancelado = false;
    setCustomer(null);
    setIsLoading(true);

    void (async () => {
      try {
        const pagina = await listCustomers({ branchId, search: digits }, LIMITE, 0);
        const encontrado =
          pagina.items.find((item) => phoneDigits(item.customer_phone) === digits) ?? null;
        cache.current.set(chave, encontrado);
        if (!cancelado) setCustomer(encontrado);
      } catch {
        // Leitura de apoio: sem resposta, a linha não aparece. Ver o comentário
        // do módulo. O erro NÃO entra no cache — a próxima abertura tenta de novo.
        if (!cancelado) setCustomer(null);
      } finally {
        if (!cancelado) setIsLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [digits, branchId]);

  return { customer, isLoading };
}
