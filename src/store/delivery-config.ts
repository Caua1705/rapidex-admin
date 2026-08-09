/**
 * As regras de entrega da filial.
 *
 * A ENTREGA É POR RAIO, NÃO POR BAIRRO. O preço sai da distância em linha do
 * endereço até a filial: `base + por_km × km`, preso entre a mínima e a máxima,
 * e recusado acima da distância máxima. Não existe tabela de bairro nem zona
 * desenhada no mapa — quem procurar isso na tela não vai achar, e é assim
 * mesmo.
 *
 * O DEFEITO CARO QUE ESTE ARQUIVO PREVINE: com `delivery_base_fee` ou
 * `delivery_fee_per_km` nulos, a estimativa não tem como ser calculada, e o
 * endereço do cliente volta como NÃO ATENDÍVEL — a loja aparece aberta e não
 * recebe pedido de entrega nenhum. Isso não é "campo opcional em branco": é a
 * entrega desligada por configuração faltando, e a tela precisa dizer isso com
 * todas as letras.
 */
import type { Branch } from '../api/types';

/** A parte da filial que descreve a entrega. */
export type DeliveryConfig = Pick<
  Branch,
  | 'delivery_base_fee'
  | 'delivery_fee_per_km'
  | 'delivery_min_fee'
  | 'delivery_max_fee'
  | 'delivery_max_distance_km'
>;

export type DeliveryProblem = {
  /** O campo que está faltando ou incoerente. */
  field: keyof DeliveryConfig;
  message: string;
};

function isMissing(value: number | null | undefined): boolean {
  return value === null || value === undefined;
}

/**
 * O que quebra a entrega, em ordem de gravidade.
 *
 * Os dois primeiros são ERRO DE CONFIGURAÇÃO, não aviso: sem eles o cálculo
 * não roda. Os demais são incoerências que o lojista consegue criar sozinho
 * (mínima maior que máxima) e que dariam preço estranho no app do cliente.
 */
export function checkDeliveryConfig(config: DeliveryConfig): DeliveryProblem[] {
  const problems: DeliveryProblem[] = [];

  if (isMissing(config.delivery_base_fee)) {
    problems.push({
      field: 'delivery_base_fee',
      message:
        'Sem taxa base não há como estimar o frete: todo endereço volta como não atendível e a loja não recebe pedido de entrega.',
    });
  }

  if (isMissing(config.delivery_fee_per_km)) {
    problems.push({
      field: 'delivery_fee_per_km',
      message:
        'Sem valor por km não há como estimar o frete: todo endereço volta como não atendível e a loja não recebe pedido de entrega.',
    });
  }

  const min = config.delivery_min_fee;
  const max = config.delivery_max_fee;
  if (!isMissing(min) && !isMissing(max) && (min as number) > (max as number)) {
    problems.push({
      field: 'delivery_max_fee',
      message:
        'A taxa máxima está abaixo da mínima. O cliente veria um frete preso no valor errado.',
    });
  }

  if (
    !isMissing(config.delivery_max_distance_km) &&
    (config.delivery_max_distance_km as number) <= 0
  ) {
    problems.push({
      field: 'delivery_max_distance_km',
      message: 'Com distância máxima zerada, nenhum endereço é atendido.',
    });
  }

  return problems;
}

/** A entrega está de pé? Só os dois campos que o cálculo exige. */
export function isDeliveryEstimable(config: DeliveryConfig): boolean {
  return !isMissing(config.delivery_base_fee) && !isMissing(config.delivery_fee_per_km);
}

/**
 * Quanto ficaria o frete a X km, com a configuração atual.
 *
 * Serve para a prévia ao lado dos campos: número concreto convence mais que
 * texto explicando a fórmula, e é onde o lojista percebe que digitou 15 no
 * lugar de 1,50. Devolve null quando a estimativa não roda — o mesmo "não
 * atendível" que o cliente veria.
 */
export function estimateDeliveryFee(config: DeliveryConfig, distanceKm: number): number | null {
  if (!isDeliveryEstimable(config)) return null;
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;

  const maxDistance = config.delivery_max_distance_km;
  if (!isMissing(maxDistance) && distanceKm > (maxDistance as number)) return null;

  let fee =
    (config.delivery_base_fee as number) + (config.delivery_fee_per_km as number) * distanceKm;

  const min = config.delivery_min_fee;
  const max = config.delivery_max_fee;
  if (!isMissing(min)) fee = Math.max(fee, min as number);
  if (!isMissing(max)) fee = Math.min(fee, max as number);

  return Math.round(fee * 100) / 100;
}
