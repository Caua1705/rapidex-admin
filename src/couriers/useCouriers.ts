import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { createCourier, deleteCourier, listCouriers, updateCourier } from '../api/couriers';
import type { Courier, CourierCreate, CourierUpdate } from '../api/types';

/**
 * ============================================================================
 * A LISTA DE ENTREGADORES DA FILIAL
 * ============================================================================
 *
 * A ORDEM É A DO BACKEND, e a tela não reordena — ver `api/couriers.ts`. O que
 * este hook faz com a resposta de uma escrita é ATUALIZAR A LINHA no lugar, e
 * não reinserir: mexer na posição depois de um PATCH de nome faria a linha
 * saltar debaixo do dedo de quem acabou de editá-la.
 *
 * Isso aceita uma dessincronia pequena e conhecida: renomear "Jorge" para
 * "Ana" deixa a linha fora de ordem até a próxima leitura. É a troca certa —
 * a alternativa é uma lista que se reorganiza sozinha no instante em que a
 * pessoa está olhando para o que mudou.
 *
 * EXCLUIR RECARREGA. É a única escrita cujo efeito passa da própria linha: o
 * contrato diz que os pedidos abertos do excluído voltam para a fila, e uma
 * lista remendada localmente esconderia que o mundo mudou em volta.
 */
export function useCouriers(branchId: string) {
  const [couriers, setCouriers] = useState<readonly Courier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Descarta a resposta de uma filial que já não é a da tela. */
  const requestRef = useRef(0);

  const carregar = useCallback(async () => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const lista = await listCouriers(branchId || undefined);
      if (requestId !== requestRef.current) return;
      setCouriers(lista);
      setErrorMessage(null);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      /*
       * A LISTA NÃO É ZERADA NA FALHA. Lista vazia é uma AFIRMAÇÃO ("esta
       * filial não tem entregador") e é a tela que o lojista vê antes de
       * cadastrar o primeiro — dizê-la por causa de uma queda de rede o faria
       * cadastrar de novo quem já existe.
       */
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * As três escritas devolvem o ERRO em vez de o guardarem em estado.
   *
   * Quem chama é o diálogo, e é lá que o erro tem lugar — no campo do telefone,
   * quando é o 409. Um `errorMessage` de hook compartilhado entre a lista e o
   * formulário acabaria mostrando o conflito de telefone no topo da tela,
   * longe do campo que o resolve.
   */
  const criar = useCallback(async (body: CourierCreate): Promise<unknown | null> => {
    try {
      const criado = await createCourier(body);
      setCouriers((atual) => [...atual, criado]);
      return null;
    } catch (error) {
      return error;
    }
  }, []);

  const editar = useCallback(
    async (courierId: string, body: CourierUpdate): Promise<unknown | null> => {
      try {
        const salvo = await updateCourier(courierId, body);
        // No lugar, e não reinserido: ver o cabeçalho.
        setCouriers((atual) => atual.map((linha) => (linha.id === salvo.id ? salvo : linha)));
        return null;
      } catch (error) {
        return error;
      }
    },
    [],
  );

  const excluir = useCallback(
    async (courierId: string): Promise<unknown | null> => {
      try {
        await deleteCourier(courierId);
        await carregar();
        return null;
      } catch (error) {
        return error;
      }
    },
    [carregar],
  );

  return { couriers, isLoading, errorMessage, recarregar: carregar, criar, editar, excluir };
}
