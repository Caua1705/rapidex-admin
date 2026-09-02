/**
 * ============================================================================
 * AS VIAS DE UM PEDIDO — o que sai no papel, lido pelo painel
 * ============================================================================
 *
 * ESTE ARQUIVO EXISTE PARA UMA PERGUNTA QUE O SUPORTE RESPONDE POR TELEFONE
 * HOJE: "a comanda deste pedido saiu?" — e para a única resposta honesta que o
 * painel pode dar a ela.
 *
 * `GET /admin/orders/{order_id}/print-jobs` devolve as vias **já formatadas em
 * texto de largura fixa**, prontas para a bobina. E é preciso ler o contrato
 * com cuidado, porque a rota parece dizer mais do que diz:
 *
 *   - ela **NÃO marca nada como impresso**, e nem tem como: reimprimir é a
 *     operação mais comum do balcão (papel picotou, comanda molhou) e por isso
 *     ela é um GET repetível;
 *   - logo, **não existe histórico de impressão** em lugar nenhum da API. O
 *     agente grava log num arquivo local, ao lado do próprio `.exe`, e nada
 *     disso sobe.
 *
 * **A tela então NÃO PODE dizer "a comanda saiu".** Ela diz O QUE SAI — e essa
 * é a pergunta que resolve os três chamados que chegam de verdade:
 *
 *   1. "não saiu nada"          → `jobs` vazia: a filial zerou as contagens
 *   2. "saiu só a do cliente"   → pagamento online ainda não confirmado
 *   3. "saiu errado / faltou o adicional" → o texto está aqui, do jeito que a
 *      impressora recebeu
 *
 * Escrever "a comanda saiu" a partir desta rota seria a pior forma do defeito
 * que a tela existe para acabar: o lojista para de procurar o problema no
 * momento em que o painel afirma que está tudo bem.
 *
 * ----------------------------------------------------------------------------
 * A ARMADILHA: CÓPIA É ENTRADA REPETIDA, NÃO UM CAMPO `copies`
 * ----------------------------------------------------------------------------
 *
 * A filial que pediu DUAS vias do cliente recebe **dois itens idênticos, um
 * atrás do outro** na lista. Não há campo de contagem, e a razão está escrita
 * no contrato: **não existe atualização remota do agente** — ele é um `.exe`
 * instalado à mão, e uma versão nova é uma visita por loja. Repetindo a
 * entrada, a mudança vale hoje em toda instalação já em campo.
 *
 * Isso obriga a tela a duas coisas opostas ao mesmo tempo:
 *
 *   - **agrupar para EXIBIR** — três blocos de texto idênticos empilhados são
 *     lidos como defeito do painel, não como "saem três vias";
 *   - **NUNCA deduplicar a CONTAGEM** — "2 vias" é a informação, e é a única
 *     resposta ao lojista que ligou perguntando por que gastou o dobro de
 *     bobina.
 *
 * `agruparVias()` faz as duas: uma entrada por bloco distinto, com `copias`.
 */
import type { PrintJob } from '../api/types';
import { isAwaitingOnlinePayment } from './order-status';

/**
 * Um bloco de texto a imprimir, com quantas vezes ele sai.
 *
 * `copias` nunca é zero: um grupo só existe porque havia pelo menos uma via.
 */
export type ViaAgrupada = {
  /** Chave estável para a lista do React. Índice do primeiro item do grupo. */
  key: string;
  /** `'customer'` ou `'production'`, como o backend manda. */
  type: string;
  /** O nome do setor, que o backend já resolve ("Cliente", "Chapa", "Bar"). */
  sectorName: string;
  /** Para qual impressora, quando o setor aponta uma. */
  printerName: string | null;
  /** A largura em caracteres na qual `content` já veio quebrado. */
  columns: number;
  /** `'normal'` ou `'large'` — o agente só seleciona, não decide. */
  fontSize: string;
  content: string;
  copias: number;
};

/**
 * Junta vias CONSECUTIVAS e idênticas num bloco só, contando as cópias.
 *
 * **Consecutivas, e não "todas as iguais".** O contrato diz que as vias vêm "na
 * ordem em que devem sair" e que a cópia é a entrada repetida logo atrás. Juntar
 * duas iguais separadas por uma terceira diferente reordenaria a bobina na tela
 * — e a ordem é justamente o que o lojista está conferindo quando abre isto.
 *
 * A igualdade é pelo CONTEÚDO e pelo DESTINO juntos: o mesmo texto mandado para
 * duas impressoras diferentes são duas vias, não duas cópias de uma.
 */
export function agruparVias(jobs: readonly PrintJob[]): ViaAgrupada[] {
  const grupos: ViaAgrupada[] = [];

  jobs.forEach((job, indice) => {
    const anterior = grupos.at(-1);

    if (
      anterior &&
      anterior.content === job.content &&
      anterior.type === job.type &&
      anterior.sectorName === job.sector_name &&
      anterior.printerName === (job.printer_name ?? null)
    ) {
      anterior.copias += 1;
      return;
    }

    grupos.push({
      key: String(indice),
      type: job.type,
      sectorName: job.sector_name,
      printerName: job.printer_name ?? null,
      columns: job.columns,
      fontSize: job.font_size,
      content: job.content,
      copias: 1,
    });
  });

  return grupos;
}

/** "2 vias" / "1 via". A contagem NUNCA sai da lista deduplicada. */
export function rotuloDeCopias(copias: number): string {
  return copias === 1 ? '1 via' : `${copias} vias`;
}

/**
 * Para onde este bloco vai, em uma linha.
 *
 * A impressora entra quando o setor aponta uma; sem ela, o agente usa a padrão
 * da máquina, e dizer "impressora padrão" seria o painel afirmando uma
 * resolução que acontece do outro lado — o agente pode ter outra.
 */
export function destinoDaVia(via: ViaAgrupada): string {
  const partes = [via.sectorName, via.printerName].filter(
    (parte): parte is string => typeof parte === 'string' && parte.trim() !== '',
  );
  return partes.join(' · ');
}

/**
 * O QUE A AUSÊNCIA DE VIA SIGNIFICA — e nenhum dos dois casos é erro.
 *
 * Esta é a metade da tela que mais importa, porque é a que responde ao chamado
 * "não saiu nada". Sem ela, uma lista vazia lê como falha de carregamento, e o
 * lojista vai procurar defeito na impressora que está funcionando.
 *
 * `null` quando há vias de produção: aí não há nada a explicar.
 */
export function avisoDeVias(
  jobs: readonly PrintJob[],
  /**
   * O `payment_status` do pedido, cru. A pergunta "o pagamento liberou?" tem
   * UMA resposta no painel — `isAwaitingOnlinePayment`, em `order-status.ts` —,
   * e ela é a mesma que decide se a Cozinha mostra o pedido. Receber um
   * booleano aqui deixaria cada chamador reescrever a regra, e a segunda
   * escrita divergiria da primeira no dia em que um `payment_status` novo
   * entrasse no contrato.
   */
  paymentStatus: string,
): { tom: 'warn' | 'info'; texto: string } | null {
  if (jobs.length === 0) {
    return {
      tom: 'warn',
      texto:
        'Este pedido não imprime nada: esta filial está com as duas contagens de via em zero. ' +
        'Para mudar isso, vá em Loja › Impressão.',
    };
  }

  const temProducao = jobs.some((job) => job.type === 'production');
  if (temProducao) return null;

  /*
   * SÓ A VIA DO CLIENTE. São duas causas com a mesma aparência, e a tela só
   * pode afirmar a que ela consegue conferir:
   *
   *   - o pagamento online não confirmou — o backend não gera via de produção,
   *     que é a mesma regra do "aguardando pagamento, não preparar" que já
   *     barra o pedido de entrar na cozinha;
   *   - a filial zerou só a contagem da produção.
   *
   * Quando o pagamento está confirmado, a primeira está descartada e sobra a
   * segunda. Quando não está, ela é a explicação provável e é a que se diz —
   * mas sem "por isso": afirmar a causa que não se conferiu é como o painel
   * manda o lojista mexer na configuração errada.
   */
  return isAwaitingOnlinePayment(paymentStatus)
    ? {
        tom: 'info',
        texto:
          'Sai só a via do cliente. A comanda de produção é ordem de preparo, e ela só é gerada ' +
          'depois que o pagamento confirma.',
      }
    : {
        tom: 'info',
        texto:
          'Sai só a via do cliente: esta filial está com a contagem da via de produção em zero.',
      };
}
