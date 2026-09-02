import type { BranchOperation } from '../api/types';
import { OPERATION_TIMEZONE } from '../orders/format';

/**
 * POR QUE ESTA FILIAL NÃO ESTÁ RECEBENDO PEDIDO — a resposta em uma palavra.
 *
 * Três coisas precisam valer ao mesmo tempo para entrar pedido, e nenhuma
 * sozinha responde a pergunta do lojista: a chave ligada, a agenda de hoje
 * aberta, e alguma forma de comprar. A tela já mostrou duas versões erradas
 * disso — o ponto verde ao lado de "aberta" numa loja fora do horário, e depois
 * o mesmo ponto numa loja sem entrega e sem retirada.
 *
 * A REGRA MORA AQUI, uma vez só, porque quem a lê são duas telas: a linha da
 * filial em Operação e o interruptor do cabeçalho das outras seções. Duas
 * cópias divergiriam no primeiro estado novo.
 *
 * Cada uma escreve a frase DELA — a linha é curta, o cabeçalho é prosa —, e é
 * por isso que o que sai daqui é a situação, não o texto.
 */
export type SituacaoOperacao =
  /** Entra pedido agora. */
  | 'no-ar'
  /** A chave está desligada: o lojista fechou. */
  | 'fechada'
  /** A chave está ligada e o horário de hoje já fechou. */
  | 'fora-do-horario'
  /** Aberta, dentro do horário, e sem entrega nem retirada. */
  | 'sem-forma-de-comprar'
  /** A leitura ainda não chegou: a tela não afirma nem uma coisa nem outra. */
  | 'desconhecida';

/**
 * A ORDEM É A DA AÇÃO QUE FALTA, e ela não é a do backend.
 *
 * Primeiro a chave, que é o que o próprio controle já responde. Depois "sem
 * forma de comprar", que só passa quando alguém religar uma das duas — enquanto
 * "fora do horário" passa sozinho quando o relógio virar. Valendo os dois, quem
 * fala é o que precisa de gente.
 */
export function situacaoDaFilial(linha: BranchOperation | null): SituacaoOperacao {
  if (!linha) return 'desconhecida';
  if (!linha.is_open) return 'fechada';
  /*
   * `accepts_delivery_now`, E NÃO `accepts_delivery`. Os dois campos existem
   * porque respondem perguntas diferentes: o primeiro é "esta loja faz
   * entrega?" (estrutural), o segundo é "está entrando pedido de entrega
   * AGORA?" — a chave já descontada a pausa temporária. Quem decide se alguém
   * consegue comprar é sempre o segundo; ler o primeiro deixaria o ponto verde
   * aceso numa loja que pausou a entrega às 19h por causa de chuva.
   */
  if (!linha.accepts_delivery_now && !linha.accepts_pickup) return 'sem-forma-de-comprar';
  if (!linha.is_open_now) return 'fora-do-horario';
  return 'no-ar';
}

/**
 * A PAUSA DA ENTREGA — ativa quando o prazo dela ainda não venceu.
 *
 * Ela é comparada com o RELÓGIO, e não lida de um booleano, porque é assim que
 * o backend a resolve: a pausa se desfaz sozinha, e uma tela que guardasse
 * "pausado: sim" continuaria afirmando isso depois de o prazo passar.
 *
 * `agora` entra como parâmetro para o teste não depender do relógio da máquina.
 */
/**
 * A hora no fuso da OPERAÇÃO, como todo o resto do painel — ver `notaDaPausa`.
 *
 * Fora da função de propósito: `Intl.DateTimeFormat` é caro de construir, e
 * esta frase é desenhada uma vez por filial em cada repintura da lista.
 */
const horaDaOperacao = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: OPERATION_TIMEZONE,
});

export function pausaAtiva(linha: BranchOperation | null, agora = new Date()): Date | null {
  if (!linha?.delivery_paused_until) return null;
  const ate = new Date(linha.delivery_paused_until);
  if (Number.isNaN(ate.getTime()) || ate <= agora) return null;
  return ate;
}

/**
 * "Pausada até 20:30 · chuva forte" — a frase da linha.
 *
 * SEM A PALAVRA "ENTREGA", e ela estava lá: a nota mora encostada na coluna que
 * se chama Entrega, e as oito letras a mais faziam a frase quebrar em duas
 * linhas na coluna de 190px — com o "·" pendurado no fim da primeira, e a linha
 * inteira com o dobro da altura das vizinhas numa lista que existe para ser
 * escaneada.
 *
 * ELA É ANUNCIADA MESMO QUANDO A LOJA JÁ TEM OUTRO PROBLEMA, e é a única nota
 * desta tela com essa prioridade: a pausa é o único estado que se desfaz
 * SOZINHO, e é justamente por isso que ninguém lembra dela. Quem pausou às 19h
 * por causa de chuva não volta ao painel para conferir — o único sintoma de uma
 * pausa esquecida é a ausência de pedido, que não acende alarme nenhum.
 *
 * O motivo entra só quando existe: "Entrega pausada até 20:30 ·" com o rabo
 * solto é pior que a frase curta.
 *
 * ============================================================================
 * A HORA É A DA OPERAÇÃO, E ELA NÃO ERA
 * ============================================================================
 *
 * Esta linha era `toLocaleTimeString('pt-BR', { hour, minute })` — **sem
 * `timeZone`**, ou seja, no fuso do NAVEGADOR. Era o único formatador de hora
 * do painel sem fuso fixado; todos os outros passam `OPERATION_TIMEZONE`.
 *
 * O QUE ISSO ERA NA LOJA: o lojista pausa a entrega até as 20:30. Num aparelho
 * com o fuso errado — o tablet de balcão em modo quiosque que ninguém
 * configurou, o notebook trazido de outro estado —, a linha dizia "Pausada até
 * 23:30". Três horas de mentira sobre quando a entrega volta, no único estado
 * que se desfaz sozinho e cujo único sintoma é a ausência de pedido.
 *
 * O TESTE ESCONDIA. Ele injetava o `agora` (certo) mas não o fuso, e na máquina
 * de quem o escreveu (UTC-3) o código errado produzia a string certa. Quem
 * achou foi a varredura do fuso: com o relógio do teste apontado para UTC —
 * que é o do runner do CI — ele ficou vermelho.
 */
export function notaDaPausa(linha: BranchOperation | null, agora = new Date()): string | null {
  const ate = pausaAtiva(linha, agora);
  if (!ate) return null;

  const hora = horaDaOperacao.format(ate);
  const motivo = linha?.delivery_pause_reason?.trim();
  return motivo ? `Pausada até ${hora} · ${motivo}` : `Pausada até ${hora}`;
}

/**
 * Se o ponto de cor acende.
 *
 * "No ar" é o único estado em que entra pedido. `desconhecida` não acende: um
 * ponto verde enquanto a leitura não chegou afirmaria o que ninguém conferiu.
 */
export function estaNoAr(linha: BranchOperation | null): boolean {
  return situacaoDaFilial(linha) === 'no-ar';
}
