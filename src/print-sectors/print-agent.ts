/**
 * ============================================================================
 * COMO SE LÊ O ESTADO DO PROGRAMA DE IMPRESSÃO
 * ============================================================================
 *
 * A tela de Impressão precisa dizer, em uma linha, se a comanda vai sair. Este
 * arquivo é a tradução do que `GET /admin/branches/{id}/print-agent` devolve
 * para essa linha — e mora fora do `.tsx` porque é a parte que erra em
 * silêncio: um estado trocado aqui faz o painel afirmar que está tudo bem
 * enquanto a cozinha não recebe nada.
 *
 * SÃO TRÊS ESTADOS, E O TERCEIRO NÃO É UM CASO DO SEGUNDO:
 *
 *   'live'     bateu ponto há menos de 90s. A comanda sai.
 *   'offline'  já bateu alguma vez, e não bate agora. O computador está
 *              desligado, ou o programa foi fechado.
 *   'never'    esta filial nunca teve agente nenhum. Não é "está desligado":
 *              é "não foi instalado", e as duas se resolvem de jeitos
 *              diferentes — uma indo ligar o computador, a outra indo instalar.
 *
 * A JANELA DE 90 SEGUNDOS NÃO É RECALCULADA AQUI. `is_online` vem pronto do
 * backend, que compara com o relógio DELE. Refazer a conta a partir de
 * `last_seen_at` com o relógio do navegador daria uma segunda resposta para a
 * mesma pergunta — e um computador com a hora errada (que é comum num balcão)
 * veria o programa como offline para sempre.
 */
import type { PrintAgentStatus } from '../api/types';

export type AgentState = 'live' | 'offline' | 'never';

export function agentState(status: PrintAgentStatus | null): AgentState {
  if (!status || !status.last_seen_at) return 'never';
  return status.is_online ? 'live' : 'offline';
}

/**
 * "agora mesmo", "há 2 minutos", "há 3 horas", "há 2 dias".
 *
 * A ENTRADA É `seconds_since_last_seen`, o número que o BACKEND calculou, e não
 * a diferença entre `last_seen_at` e o relógio local — ver o cabeçalho. Entre
 * duas leituras o texto fica parado, e isso é aceitável: o hook relê a cada 30
 * segundos e os degraus abaixo são de minuto para cima.
 *
 * Abaixo de um minuto não vira "há 0 minutos": um agente que bateu ponto há 12
 * segundos está batendo ponto agora, e é isso que a frase precisa dizer.
 */
export function formatAgo(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';

  const inteiros = Math.max(0, Math.floor(seconds));
  if (inteiros < 60) return 'agora mesmo';

  const minutos = Math.floor(inteiros / 60);
  if (minutos < 60) return minutos === 1 ? 'há 1 minuto' : `há ${minutos} minutos`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return horas === 1 ? 'há 1 hora' : `há ${horas} horas`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/**
 * A LINHA DE ESTADO — o texto do ponto colorido, e nada além dele.
 *
 * Curta de propósito: ela vive na régua do bloco, ao lado do título, e é a
 * primeira coisa que alguém no balcão lê. O que ela NÃO diz (o que fazer a
 * respeito) fica na frase abaixo, escrita uma vez.
 */
export function agentLabel(status: PrintAgentStatus | null): string {
  switch (agentState(status)) {
    case 'live':
      return 'Rodando agora';
    case 'offline':
      return `Sem sinal ${formatAgo(status?.seconds_since_last_seen)}`;
    case 'never':
      return 'Nunca instalado nesta loja';
  }
}

/**
 * A FRASE QUE DIZ O QUE FAZER — uma por estado, e nenhuma com mais de uma
 * ideia.
 *
 * O texto que estava aqui antes eram três parágrafos explicando que o navegador
 * não fala com impressora térmica, que o programa mora no computador do balcão
 * e que o painel ainda não sabia dizer se ele estava rodando. Estava certo e
 * era longo demais para uma tela de configuração: quem abre isto no balcão, no
 * sábado, precisa de uma linha.
 *
 * O QUE SOBROU DA EXPLICAÇÃO É A CONSEQUÊNCIA, não o mecanismo. "Com ele
 * fechado, nenhuma comanda sai" diz na prática tudo o que "o navegador não fala
 * com impressora térmica" dizia em teoria — e diz para quem tem uma pizzaria,
 * não para quem escreveu o agente.
 */
export function agentHint(status: PrintAgentStatus | null): string {
  switch (agentState(status)) {
    case 'live':
      return 'A comanda sai do computador do balcão. Com ele desligado, nada é impresso — nem com o painel aberto no celular.';
    case 'offline':
      return 'Nenhuma comanda está saindo. Confira se o computador do balcão está ligado e se o programa de impressão está aberto nele.';
    case 'never':
      return 'A comanda não sai do navegador: quem imprime é um programa instalado no computador do balcão. Enquanto ele não for instalado nesta loja, nenhuma comanda é impressa aqui.';
  }
}
