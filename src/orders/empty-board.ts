/**
 * O QUADRO VAZIO — dizer o que está acontecendo, não só que não há nada.
 *
 * O quadro sem nenhum pedido mostrava três faixas com zero e mais nada: três
 * fios finos e um "0" em cada, no meio de uma tela em branco. Não é um estado
 * vazio, é a ausência de um — o lojista fica sem saber se a loja está fechada,
 * se o filtro está num dia sem movimento, ou se o painel travou.
 *
 * As três perguntas que o estado precisa responder, nesta ordem:
 *
 *   1. está entrando pedido? (a loja está aberta?)
 *   2. estou olhando o período certo?
 *   3. o que eu faço agora?
 *
 * A ORDEM DOS CASOS É A ORDEM DAS CAUSAS, da mais acionável para a menos: uma
 * busca ativa explica o vazio melhor que qualquer outra coisa, e uma loja
 * fechada explica melhor que "nenhum movimento hoje". Invertida, a tela diria
 * "ainda não entrou pedido" para quem está com a loja fechada — verdade
 * inútil, e a que faz o lojista esperar em vez de agir.
 */
import type { PeriodPreset } from './order-filters';

export type EmptyBoardState = {
  title: string;
  hint: string;
  /** O que dá para fazer daqui. Ausente quando não há ação: só esperar. */
  action?: { label: string; to: string };
};

const PERIOD_LABEL: Record<PeriodPreset, string> = {
  today: 'hoje',
  yesterday: 'ontem',
  last7: 'nos últimos 7 dias',
  custom: 'no período escolhido',
};

export function emptyBoardState(input: {
  /** `null` enquanto as configurações não chegaram: não afirma nem uma coisa nem outra. */
  isOpen: boolean | null;
  period: PeriodPreset;
  search: string;
}): EmptyBoardState {
  const periodo = PERIOD_LABEL[input.period];

  // 1. A busca é a causa mais provável e a mais fácil de desfazer.
  if (input.search.trim() !== '') {
    return {
      title: `Nenhum pedido ${periodo} com “${input.search.trim()}”.`,
      hint: 'A busca procura por número do pedido e por nome do cliente. Limpe o campo para ver o quadro inteiro.',
    };
  }

  // 2. Loja fechada é a resposta completa: não é falta de movimento, é que não
  //    entra pedido nenhum enquanto ela estiver assim.
  if (input.isOpen === false) {
    return {
      title: 'A loja está fechada.',
      hint: 'Nenhum pedido novo entra enquanto ela estiver fechada. Os pedidos já em andamento continuam aparecendo aqui.',
      action: { label: 'Abrir a loja', to: '/minha-loja/geral' },
    };
  }

  // 3. Período passado: o quadro é de trabalho, e o que acabou está em outro
  //    lugar. Sem isto, o lojista conclui que perdeu os pedidos de ontem.
  if (input.period !== 'today') {
    return {
      title: `Nenhum pedido em andamento ${periodo}.`,
      hint: 'O quadro mostra só o que ainda está em andamento. O que já foi concluído ou cancelado está no Histórico, na aba ao lado.',
    };
  }

  // 4. Loja aberta, hoje, sem movimento: o único caso em que não há o que
  //    fazer — e dizer que a tela se atualiza sozinha é o que evita o F5.
  return {
    title: 'Tudo em dia: nenhum pedido em aberto.',
    hint: 'A loja está aberta e o painel está ligado ao tempo real. Pedido novo aparece aqui sozinho, com alerta sonoro.',
  };
}
