import { useEffect, useState } from 'react';

/**
 * A LARGURA EM QUE O ÍNDICE DE LOJA DEIXA DE SER NAVEGAÇÃO E VIRA PÁGINA.
 *
 * Ela precisa ser a MESMA de `@media (max-width: 720px)` em `StorePage.css`,
 * onde `.store__index` some e `.store__voltar` aparece. Consulta de mídia não
 * lê `var(--token)`, então este número não tem como sair de `tokens.css`: o que
 * dá para fazer é mantê-lo num lugar só, com o nome dito, e apontar para o
 * arquivo que precisa concordar com ele.
 *
 * 720px não é um número novo — é o ponto de quebra do sistema em que "folhas,
 * diálogos e listas viram bloco / tela cheia".
 */
const LARGURA_PAGINA = 720;

/** `(max-width: 720px)`, montado a partir da constante acima. */
export const CONSULTA_LISTA_EM_PAGINA = `(max-width: ${LARGURA_PAGINA}px)`;

/**
 * As nove seções são uma PÁGINA em vez de uma coluna?
 *
 * ELE EXISTE PARA UMA DECISÃO SÓ: o que `/loja` renderiza (ver
 * `StoreIndexPage`). No desktop a coluna de seções está sempre à vista, então
 * `/loja` sozinha não é uma tela — é o nome do grupo, e ela redireciona para
 * Operação. No telefone a coluna não cabe: a fita rolável de nove pastilhas
 * transbordava 271px numa tela de 390, e nove pastilhas de 12px numa fita é o
 * pior alvo de toque do painel (Fitts). Ali `/loja` É uma tela — a lista das
 * nove, em linhas de 44px.
 *
 * O QUE ISSO CUSTARIA, E NÃO CUSTA: um toque a mais para abrir e fechar a loja,
 * que é a coisa que se faz com o telefone na rua. Não custa porque a barra de
 * baixo passou a apontar direto para `/loja/operacao` — ver `BottomBar`.
 *
 * Ele ESCUTA a mudança em vez de medir uma vez: quem gira o aparelho de retrato
 * para paisagem atravessa os 720px, e a tela tem de acompanhar.
 */
export function useSectionListPage(): boolean {
  const [emPagina, setEmPagina] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA_LISTA_EM_PAGINA).matches,
  );

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_LISTA_EM_PAGINA);
    const aoMudar = (evento: MediaQueryListEvent) => setEmPagina(evento.matches);

    setEmPagina(consulta.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  return emPagina;
}
