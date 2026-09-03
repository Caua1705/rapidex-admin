import { useEffect, useState } from 'react';

import { fetchSettings } from '../api/store';

export type DeliveryEstimate = { min: number; max: number };

/**
 * O tempo estimado de ENTREGA, só leitura, para a barra de pedidos.
 *
 * ELE É DO RESTAURANTE, NÃO DA FILIAL — e isso não é escolha nossa:
 * `estimated_delivery_time_min` e `_max` moram em `AdminRestaurantSettings`,
 * que o contrato descreve como "configuração do restaurante inteiro, não da
 * filial". Não existe rota que devolva esse par por filial. Por isso este hook
 * não recebe `branchId`: fingir um recorte que a API não tem daria um número
 * que muda de filial na tela e não muda no backend.
 *
 * Ele fica ao lado do prazo de PREPARO porque os dois juntos são a promessa
 * que o cliente vê — preparo é o que a cozinha controla, entrega é o que a
 * rua acrescenta. Separados em telas diferentes, ninguém confere a soma.
 *
 * Falhar aqui NÃO vira erro de tela, pelo mesmo motivo de `usePrepRange`: é
 * número de apoio, e um alerta por causa dele roubaria a tela de quem veio ver
 * pedido.
 *
 * MAS FALHAR TAMBÉM NÃO É "SEM FAIXA". Os dois desenhavam a mesma tela, e são
 * coisas diferentes: "sem faixa" é uma AFIRMAÇÃO sobre a configuração da loja,
 * e a leitura que caiu não sabe nada sobre ela. A diferença importa porque este
 * número vira a promessa que o lojista repete ao cliente no telefone — dizer
 * que não há prazo configurado, quando o que houve foi uma queda de rede, é a
 * tela mentindo sobre a operação em vez de admitir que não leu.
 */
export function useDeliveryEstimate(): { estimate: DeliveryEstimate | null; falhou: boolean } {
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const settings = await fetchSettings();
        if (cancelled) return;
        const min = settings.estimated_delivery_time_min;
        const max = settings.estimated_delivery_time_max;
        // Meia faixa não é faixa: mostrar só o mínimo faria o lojista ler
        // "30 min" como promessa fechada. É a mesma regra do prazo de preparo.
        setEstimate(typeof min === 'number' && typeof max === 'number' ? { min, max } : null);
        setFalhou(false);
      } catch {
        if (!cancelled) setFalhou(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { estimate, falhou };
}
