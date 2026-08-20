import { useEffect, useState } from 'react';

/**
 * A LARGURA EM QUE O DETALHE VIRA COLUNA PERMANENTE.
 *
 * Ela precisa ser a MESMA de `@media (max-width: 1279px)` em
 * `OrderDetailPanel.css` — abaixo dela o painel deixa de estar no fluxo e passa
 * a FLUTUAR sobre a lista, e abaixo de 720px ele é a tela inteira.
 *
 * Consulta de mídia não lê `var(--token)`, então este número não tem como sair
 * de `tokens.css`: o que dá para fazer é mantê-lo num lugar só, com o nome
 * dito, e apontar para o arquivo que precisa concordar com ele.
 */
const LARGURA_COLUNA = 1280;

/** `(min-width: 1280px)`, montado a partir da constante acima. */
export const CONSULTA_COLUNA = `(min-width: ${LARGURA_COLUNA}px)`;

/**
 * O detalhe do pedido está no fluxo, ao lado da lista?
 *
 * ELE EXISTE PARA UMA DECISÃO SÓ: se a tela pode escolher um pedido sozinha na
 * abertura (ver `OrdersPage`). Escolher sozinha só é gentileza enquanto o
 * painel é uma COLUNA — abaixo de 1280px ele flutua por cima da lista, e abaixo
 * de 720px ele é a tela inteira: abrir Pedidos e cair direto num detalhe, com a
 * lista escondida atrás, é o oposto do que a tela existe para fazer.
 *
 * Ele ESCUTA a mudança em vez de medir uma vez: quem arrasta a janela de 1100
 * para 1500 passa a ter a coluna, e a partir dali a escolha automática vale.
 */
export function useDetailColumn(): boolean {
  const [ehColuna, setEhColuna] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA_COLUNA).matches,
  );

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_COLUNA);
    const aoMudar = (evento: MediaQueryListEvent) => setEhColuna(evento.matches);

    setEhColuna(consulta.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  return ehColuna;
}
