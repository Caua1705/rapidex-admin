/**
 * ============================================================================
 * O RELATÓRIO DO DIA DE PAGAR — quanto a loja deve a cada entregador
 * ============================================================================
 *
 * É a tela que o dono abre no dia do acerto, e o contrato diz uma coisa que
 * manda no desenho inteiro: **os números batem com o que o motoboy vê no link
 * dele** (`GET /courier/{link}/history`), porque a definição de entrega é a
 * mesma dos dois lados. Uma conta refeita aqui — somar, arredondar, filtrar —
 * seria uma segunda resposta para a mesma pergunta, e a divergência apareceria
 * no balcão, com o motoboy mostrando o celular.
 *
 * Por isso este arquivo não CALCULA quase nada: ele lê, converte texto em
 * número com cuidado, e separa o que não pode ser somado.
 *
 * ----------------------------------------------------------------------------
 * O QUE NÃO TEM TAXA FICA AO LADO DA SOMA, NUNCA DENTRO
 * ----------------------------------------------------------------------------
 *
 * `deliveries_without_fee` são corridas de uma filial que não tinha taxa
 * configurada no momento da atribuição. Elas entram na CONTAGEM e não na SOMA,
 * porque não há valor congelado nelas — é o número que o dono acerta à mão,
 * combinando com o motoboy.
 *
 * Somá-las como zero seria afirmar que aquelas corridas foram de graça: a mesma
 * mentira que a tela da taxa recusa contar do outro lado do balcão, onde `null`
 * é "sem taxa" e nunca zero.
 */
import type { CourierReport, CourierReportItem } from '../api/types';

/**
 * `MAX_REPORT_DAYS` do backend — ESPELHO DECLARADO.
 *
 * Não está no `/openapi.json`: mora na descrição da rota ("Ate 92 dias") e na
 * constante de `admin_report_service.py`. Acima disso a rota responde 400 com
 * uma frase, e a tela recusa antes — um 400 depois de escolher as datas é uma
 * ida à rede para saber uma regra que já se sabia, e a frase que volta não diz
 * qual campo mexer.
 *
 * O estrago de divergir é conhecido e pequeno nos dois sentidos: menor aqui, a
 * tela recusa um período que o backend aceitaria; maior, volta o 400. É por
 * isso que ele é espelho e não adivinhação — se o backend mudar, este número
 * muda junto, e o teste ao lado é onde a divergência aparece.
 */
export const LIMITE_DE_DIAS = 92;

/**
 * Texto de dinheiro → número, ou `null`.
 *
 * NADA AQUI VIRA ZERO POR ACIDENTE. `Number('')` é 0 e `Number(null)` é 0 — as
 * duas coerções que uma rodada inteira desta base passou caçando —, e aqui elas
 * fariam a tela afirmar "nada a pagar" num mês em que o dono deve. Resposta que
 * o painel não entende vira ausência, e ausência a tela sabe desenhar.
 */
function dinheiro(valor: string | null | undefined): number | null {
  const texto = (valor ?? '').trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

/** O total do período. `null` quando a resposta não traz um número legível. */
export function totalAPagar(relatorio: CourierReport): number | null {
  return dinheiro(relatorio.fee_total);
}

/**
 * A frase do que ficou de fora da soma — ou `null`, que é o caso bom.
 *
 * Ela existe SEPARADA do total de propósito: é a única informação da tela que o
 * dono precisa levar para uma conversa, e não para uma transferência.
 */
export function textoSemTaxa(quantas: number): string | null {
  if (!Number.isFinite(quantas) || quantas <= 0) return null;
  return quantas === 1
    ? '1 corrida sem taxa configurada, para acertar à mão'
    : `${quantas} corridas sem taxa configurada, para acertar à mão`;
}

export type LinhaDoRelatorio = {
  id: string;
  nome: string;
  telefone: string;
  entregas: number;
  semTaxa: number;
  /** `null` quando a soma não veio legível. Ver `dinheiro`. */
  total: number | null;
  /** Saiu da loja e ainda tem corrida a receber. */
  saiu: boolean;
};

/**
 * As linhas, NA ORDEM DO BACKEND.
 *
 * Reordenar aqui daria uma segunda resposta para a mesma pergunta, e o total do
 * rodapé deixaria de casar com a leitura de cima para baixo que o dono faz ao
 * conferir. É a mesma disciplina da lista de entregadores.
 *
 * O EXCLUÍDO ENTRA, MARCADO: ele saiu da loja e ainda tem corrida a receber, e
 * escondê-lo seria o dono não pagar quem trabalhou — numa tela que existe para
 * o dia de pagar.
 */
export function linhasDoRelatorio(relatorio: CourierReport): readonly LinhaDoRelatorio[] {
  return relatorio.couriers.map((item: CourierReportItem) => ({
    id: item.courier_id,
    nome: item.name,
    telefone: item.phone,
    entregas: item.deliveries_count,
    semTaxa: item.deliveries_without_fee,
    total: dinheiro(item.fee_total),
    saiu: item.is_deleted,
  }));
}

/**
 * O período escolhido serve?
 *
 * A CONTA É EM UTC, e não no fuso da operação: são datas de CALENDÁRIO
 * (AAAA-MM-DD), não instantes. Somar milissegundos num fuso com horário de
 * verão pularia ou repetiria um dia, e o teto de 92 passaria a depender do mês.
 * Mesma escolha de `previousRange` em Desempenho.
 *
 * O TETO É INCLUSIVO nos dois extremos, como no backend: de 1º de junho a 31 de
 * agosto são 92 dias, e passam.
 */
export function problemaDoPeriodo(range: { startDate: string; endDate: string }): string | null {
  if (!range.startDate || !range.endDate) return 'Escolha as duas datas do período.';
  if (range.startDate > range.endDate) return 'A data inicial é depois da final.';

  const inicio = Date.parse(`${range.startDate}T00:00:00Z`);
  const fim = Date.parse(`${range.endDate}T00:00:00Z`);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return 'Escolha as duas datas do período.';

  const dias = Math.round((fim - inicio) / 86_400_000) + 1;
  if (dias > LIMITE_DE_DIAS) {
    return `O relatório vai até ${LIMITE_DE_DIAS} dias por vez. Este período tem ${dias}.`;
  }
  return null;
}
