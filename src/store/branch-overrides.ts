import type { BranchOperation, BranchSettingsUpdate, RestaurantSettings } from '../api/types';
import {
  checkEstimatedRange,
  formatDecimalInput,
  formatIntegerInput,
  parseDecimal,
  parseInteger,
} from './settings-model';

/**
 * AS SOBRESCRITAS COMERCIAIS DE UMA FILIAL, e a regra que impede a taxa de
 * mudar sozinha.
 *
 * Cada campo tem TRÊS estados no backend, e o terceiro é o motivo de este
 * arquivo existir:
 *
 *   - ausente do corpo  → não mexe;
 *   - com valor         → esta filial passa a usar esse valor;
 *   - `null` explícito  → esta filial VOLTA A HERDAR o padrão do restaurante.
 *
 * O CAMPO VAZIO DO FORMULÁRIO NÃO É O `null` DO CORPO. Um formulário que
 * serializa vazio como `null` devolve ao padrão toda filial que estava
 * herdando, sem ninguém ter pedido: o lojista abre a tela, corrige o prazo,
 * salva — e a taxa de serviço da loja volta para a da rede. O defeito não
 * aparece no dia em que é escrito; aparece semanas depois, com o cliente
 * pagando outro número.
 *
 * A regra, por campo:
 *
 * | Estava gravado | Está no campo | Vai no corpo        |
 * | -------------- | ------------- | ------------------- |
 * | nada (herdando)| vazio         | **nada** (omitido)  |
 * | nada (herdando)| um valor      | o valor             |
 * | um valor       | o mesmo valor | **nada** (omitido)  |
 * | um valor       | outro valor   | o novo valor        |
 * | um valor       | vazio         | `null` — o lojista APAGOU |
 *
 * Ou seja: `null` só sai quando o lojista apagou uma sobrescrita que existia.
 * É a única leitura em que apagar o campo é um gesto, e não o estado em que a
 * tela já abriu.
 */
export type OverridesDraft = {
  minOrderValue: string;
  estimatedMin: string;
  estimatedMax: string;
  /** Três estados, porque o campo tem três: herdar não é "não cobrar". */
  serviceFee: 'herda' | 'cobra' | 'nao-cobra';
  serviceFeeAmount: string;
  defaultDeliveryFee: string;
};

export const EMPTY_DRAFT: OverridesDraft = {
  minOrderValue: '',
  estimatedMin: '',
  estimatedMax: '',
  serviceFee: 'herda',
  serviceFeeAmount: '',
  defaultDeliveryFee: '',
};

/** O que está GRAVADO na filial vira o rascunho. Nulo = campo vazio. */
export function draftFromOverrides(overrides: BranchOperation['overrides']): OverridesDraft {
  return {
    minOrderValue: formatDecimalInput(overrides.min_order_value),
    estimatedMin: formatIntegerInput(overrides.estimated_delivery_time_min),
    estimatedMax: formatIntegerInput(overrides.estimated_delivery_time_max),
    serviceFee:
      overrides.service_fee_enabled === null || overrides.service_fee_enabled === undefined
        ? 'herda'
        : overrides.service_fee_enabled
          ? 'cobra'
          : 'nao-cobra',
    serviceFeeAmount: formatDecimalInput(overrides.service_fee_amount),
    defaultDeliveryFee: formatDecimalInput(overrides.default_delivery_fee),
  };
}

export type BodyResult =
  { ok: true; body: BranchSettingsUpdate; vazio: boolean } | { ok: false; message: string };

/**
 * Um campo só entra no corpo quando MUDOU. Ver a tabela no topo do arquivo.
 *
 * `undefined` significa "não mexe" e some do JSON; `null` é o pedido explícito
 * de voltar a herdar.
 */
function campo(
  atual: number | null,
  gravado: number | null | undefined,
): number | null | undefined {
  const antes = gravado ?? null;
  if (atual === antes) return undefined;
  return atual;
}

/**
 * O corpo do PATCH, ou o que impede de montá-lo.
 *
 * `padrao` é o do RESTAURANTE, e ele entra por um motivo só: a validação da
 * faixa de prazo roda sobre a MESCLA (o que a filial sobrescreve mais o que ela
 * herda), como no backend. Sem isso, sobrescrever só o máximo passaria na tela
 * e voltaria 422 — com a filial parecendo ter um teto abaixo do piso.
 */
export function bodyFromDraft(
  draft: OverridesDraft,
  gravado: BranchOperation['overrides'],
  padrao: RestaurantSettings,
): BodyResult {
  const minOrder = parseDecimal(draft.minOrderValue);
  if (!minOrder.ok) return { ok: false, message: `Valor mínimo do pedido: ${minOrder.message}` };

  const estimatedMin = parseInteger(draft.estimatedMin);
  if (!estimatedMin.ok)
    return { ok: false, message: `Tempo estimado mínimo: ${estimatedMin.message}` };

  const estimatedMax = parseInteger(draft.estimatedMax);
  if (!estimatedMax.ok)
    return { ok: false, message: `Tempo estimado máximo: ${estimatedMax.message}` };

  const serviceFeeAmount = parseDecimal(draft.serviceFeeAmount);
  if (!serviceFeeAmount.ok)
    return { ok: false, message: `Taxa de serviço: ${serviceFeeAmount.message}` };

  const contingencia = parseDecimal(draft.defaultDeliveryFee);
  if (!contingencia.ok)
    return { ok: false, message: `Taxa de contingência: ${contingencia.message}` };

  // A faixa é conferida como o backend a confere: sobre a mescla. Um lado
  // vazio aqui não é "sem faixa" — é o lado que continua vindo do restaurante.
  const faixa = checkEstimatedRange(
    estimatedMin.value ?? padrao.estimated_delivery_time_min ?? null,
    estimatedMax.value ?? padrao.estimated_delivery_time_max ?? null,
  );
  if (faixa) return { ok: false, message: faixa };

  const feeAtual = draft.serviceFee === 'herda' ? null : draft.serviceFee === 'cobra';
  const feeGravado = gravado.service_fee_enabled ?? null;

  const body: BranchSettingsUpdate = {
    min_order_value: campo(minOrder.value, gravado.min_order_value),
    estimated_delivery_time_min: campo(estimatedMin.value, gravado.estimated_delivery_time_min),
    estimated_delivery_time_max: campo(estimatedMax.value, gravado.estimated_delivery_time_max),
    service_fee_enabled: feeAtual === feeGravado ? undefined : feeAtual,
    service_fee_amount: campo(serviceFeeAmount.value, gravado.service_fee_amount),
    default_delivery_fee: campo(contingencia.value, gravado.default_delivery_fee),
  };

  // Chave com `undefined` some do JSON, mas não do objeto: quem pergunta se há
  // o que mandar precisa contar as que sobraram.
  for (const chave of Object.keys(body) as (keyof BranchSettingsUpdate)[]) {
    if (body[chave] === undefined) delete body[chave];
  }

  return { ok: true, body, vazio: Object.keys(body).length === 0 };
}
