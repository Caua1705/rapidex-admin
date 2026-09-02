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

/**
 * ============================================================================
 * O MESMO ESTADO, DITO ONDE O LOJISTA ESTÁ
 * ============================================================================
 *
 * Tudo acima é a tela de Loja › Impressão. O que vem abaixo existe porque essa
 * tela é a que só abre quem JÁ desconfia: o programa caía às dezenove horas, a
 * comanda parava de sair, e Pedidos e Cozinha continuavam idênticos até um
 * cliente ligar. O dado sempre esteve na mão do painel — faltava dizê-lo na
 * tela onde o lojista passa o turno.
 */

/**
 * De quanto em quanto tempo o painel repergunta pelo agente.
 *
 * O agente bate ponto a cada 30 segundos e o backend o considera no ar por 90
 * (três batidas perdidas). Reler no mesmo passo da batida é o que mantém a
 * linha honesta: no pior caso a tela afirma "Rodando agora" por até 30 segundos
 * depois de o programa cair, e nunca por mais que isso.
 *
 * MAIS RÁPIDO NÃO SERVIRIA PARA NADA — a resposta não muda entre duas batidas —
 * e mais devagar traz de volta o defeito que este bloco existe para não ter:
 * uma tela de balcão afirmando um estado velho, que é pior do que não afirmar
 * estado nenhum.
 *
 * Mora aqui, e não no hook, porque agora são DOIS hooks lendo a mesma rota. Uma
 * segunda constante de 30 segundos escrita ao lado divergiria da primeira no
 * dia em que a janela do backend mudasse.
 */
export const INTERVALO_DO_AGENTE_MS = 30_000;

/**
 * O agente de uma filial, com o nome que a tela usa para ela.
 *
 * `status` é `undefined` enquanto a resposta não chegou (ou quando a leitura
 * falhou), e essa distinção é o coração do aviso: `null`/`is_online: false`
 * são fatos sobre a máquina, `undefined` é ausência de fato. Ver
 * `avisoDeAgenteParado`.
 */
export type AgenteDaFilial = {
  branchId: string;
  /** Como a tela chama esta filial — `branchName()`, não o nome cru. */
  nome: string;
  status: PrintAgentStatus | undefined;
};

/** "sem sinal há 1 hora", ou só "sem sinal" quando o backend não mandou o número. */
function semSinalDesde(status: PrintAgentStatus | undefined): string {
  const quando = formatAgo(status?.seconds_since_last_seen);
  return quando === '—' ? 'sem sinal' : `sem sinal ${quando}`;
}

/** "A e B", "A, B e C" — a vírgula até a penúltima. */
function emLista(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/**
 * A FAIXA DE PEDIDOS E COZINHA — ou `null`, que é o caso normal e silencioso.
 *
 * Três decisões, e cada uma é a diferença entre um aviso que se lê e um que
 * vira papel de parede:
 *
 * 1. SÓ 'offline' ACENDE. "Nunca instalado" é configuração, não incidente: uma
 *    loja que não comprou impressora térmica veria esta faixa todo dia, o turno
 *    inteiro, e no dia em que o programa da outra loja caísse ninguém mais
 *    estaria lendo. Quem nunca instalou descobre isso em Loja › Impressão, que
 *    é onde se instala.
 *
 * 2. LEITURA QUE NÃO VOLTOU NÃO VIRA AFIRMAÇÃO. Filial com `status: undefined`
 *    fica de fora. Sem resposta o painel não sabe se a comanda está saindo, e
 *    "Nenhuma comanda está saindo" numa queda de rede de três segundos manda o
 *    lojista até o balcão à toa — o mesmo defeito de devolver o valor de "não
 *    há" para dizer "não consegui ler".
 *
 * 3. NOMEAR A FILIAL DEPENDE DE QUANTAS ESTÃO EM VISTA, não de quantas
 *    pararam. Com uma só, o cabeçalho já disse qual é. Com várias, a faixa
 *    precisa dizer em qual balcão está o computador a conferir — é a diferença
 *    entre um recado útil e um susto.
 */
export function avisoDeAgenteParado(agentes: readonly AgenteDaFilial[]): string | null {
  const parados = agentes.filter((agente) => {
    if (!agente.status) return false;
    return agentState(agente.status) === 'offline';
  });
  if (parados.length === 0) return null;

  if (parados.length === 1) {
    const parado = parados[0]!;
    const onde = agentes.length > 1 ? ` na ${parado.nome}` : '';
    return (
      `Nenhuma comanda está saindo${onde}: o programa de impressão está ` +
      `${semSinalDesde(parado.status)}. Confira o computador do balcão.`
    );
  }

  const lista = emLista(parados.map((p) => `${p.nome} (${semSinalDesde(p.status)})`));
  return (
    `Nenhuma comanda está saindo em ${parados.length} filiais: ${lista}. ` +
    'Confira os computadores do balcão.'
  );
}

/**
 * A LINHA DE APOIO DA COMANDA, dentro do pedido.
 *
 * O que estava aqui antes era _"Se o papel não saiu, confira o programa em Loja
 * › Impressão"_: um recado para ir buscar a resposta em outra tela, escrito na
 * tela onde a resposta cabia. Quem está com o pedido aberto procurando "a
 * comanda saiu?" não quer um endereço — quer o estado.
 *
 * `undefined` é "ainda não perguntei" e não afirma nada. As outras três
 * afirmam, e nenhuma manda o lojista a lugar nenhum.
 */
export function linhaDaComanda(status: PrintAgentStatus | undefined): string {
  const base = 'O painel mostra o que o sistema mandou imprimir.';
  if (!status) return base;

  switch (agentState(status)) {
    case 'live':
      return `${base} O programa de impressão está rodando agora, no computador do balcão.`;
    case 'offline':
      return `${base} O programa de impressão está ${semSinalDesde(status)}: nada sai no papel enquanto ele não voltar.`;
    case 'never':
      return `${base} Esta loja não tem o programa de impressão instalado, então nada sai no papel aqui.`;
  }
}
