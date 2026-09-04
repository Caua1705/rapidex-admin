import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import type { WhatsAppChannels } from '../api/types';
import {
  connectWhatsAppChannel,
  disconnectWhatsAppChannel,
  listWhatsAppChannels,
} from '../api/whatsapp';
import { corpoDoRascunho, type CanalDraft } from './whatsapp-model';

/**
 * Os canais do restaurante, e as duas escritas que mexem neles.
 *
 * UMA LEITURA SÓ, SEM RECORTE: a rota devolve as linhas E a herança já
 * resolvida loja a loja, e é a resposta inteira que a tela desenha. Não há
 * paginação, não há filtro, e não há segunda chamada por filial.
 *
 * ----------------------------------------------------------------------------
 * AS DUAS ESCRITAS RECARREGAM, E NENHUMA DELAS COSTURA A RESPOSTA NA LISTA
 * ----------------------------------------------------------------------------
 *
 * Conectar e desconectar devolvem O CANAL, e o canal é a metade menos
 * importante do que muda. A outra metade é `branches`: conectar a linha do
 * restaurante faz TODA loja sem número próprio passar a avisar, e desconectá-la
 * cala todas elas de uma vez. Nada disso está na resposta da escrita.
 *
 * Costurar o canal na lista e deixar `branches` como estava seria a tela
 * mostrando o mundo de antes ao lado do canal de depois — e mostrando-o
 * justamente na coluna que responde "esta loja avisa o cliente?", que é a
 * pergunta inteira desta tela. A releitura devolve o `can_send` de verdade, que
 * sai da mesma consulta que o envio usa.
 */
export function useWhatsAppChannels() {
  const [dados, setDados] = useState<WhatsAppChannels | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setDados(await listWhatsAppChannels());
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      setDados(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Conecta — ou RECONECTA, que é a mesma rota com o mesmo `phone_number_id`.
   *
   * Devolve a frase da recusa, e não um booleano: as três colisões de 409 vêm
   * com texto pronto do backend e cada uma pede uma coisa diferente do lojista
   * ("desconecte-o lá antes", "o restaurante já tem o número X"). Reduzi-las a
   * "não deu" apagaria justamente a parte que diz o que fazer.
   */
  const conectar = useCallback(
    async (draft: CanalDraft): Promise<string | null> => {
      setIsSaving(true);
      try {
        await connectWhatsAppChannel(corpoDoRascunho(draft));
        await carregar();
        return null;
      } catch (error) {
        return messageFromUnknownError(error);
      } finally {
        setIsSaving(false);
      }
    },
    [carregar],
  );

  const desconectar = useCallback(
    async (channelId: string): Promise<string | null> => {
      setIsSaving(true);
      try {
        await disconnectWhatsAppChannel(channelId);
        await carregar();
        return null;
      } catch (error) {
        return messageFromUnknownError(error);
      } finally {
        setIsSaving(false);
      }
    },
    [carregar],
  );

  return {
    canais: dados?.channels ?? [],
    lojas: dados?.branches ?? [],
    isLoading,
    isSaving,
    errorMessage,
    conectar,
    desconectar,
    recarregar: carregar,
  };
}
