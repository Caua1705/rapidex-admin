import type { BranchOperation } from '../api/types';

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
  if (!linha.accepts_delivery && !linha.accepts_pickup) return 'sem-forma-de-comprar';
  if (!linha.is_open_now) return 'fora-do-horario';
  return 'no-ar';
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
