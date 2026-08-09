/**
 * Os adicionais escolhidos, prontos para a tela.
 *
 * POR QUE agrupado, e não uma lista achatada: é o GRUPO que dá o sentido da
 * escolha. "Espaguete" em "Acompanhamento" é a troca do acompanhamento que já
 * vem no prato; "Espaguete" em "Adicional" é uma porção a mais que a cozinha
 * precisa montar. Achatado, os dois viram a mesma linha e a cozinha erra o
 * prato.
 *
 * POR QUE o preço não entra em conta nenhuma: `unit_price_snapshot` do item JÁ
 * inclui os adicionais. Somar `additional_price_snapshot` por cima daria um
 * total maior que o cobrado do cliente. Ele aparece só para conferência, ao
 * lado da opção.
 */
import type {
  OrderItemOptionGroupSnapshot,
  OrderItemOptionSnapshot,
  OrderItemWithOptions,
} from '../api/contract-pending';

export type ChosenOption = {
  key: string;
  label: string;
  /** Já embutido no preço do item; serve só para conferir. */
  additionalPrice: number | null;
  quantity: number | null;
};

export type ChosenOptionGroup = {
  key: string;
  label: string;
  options: ChosenOption[];
};

/**
 * Resolve o nome do campo num lugar só.
 *
 * O contrato publicado ainda não descreve estes objetos (ver
 * `api/contract-pending.ts`), então o rótulo é lido do nome com sufixo
 * `_snapshot` — a convenção do resto do contrato — e cai para `name` se o
 * backend tiver escolhido o nome curto. Se um dia for um terceiro nome, é
 * ESTA função que muda, e nada mais.
 */
function labelOf(entry: { name?: string | null } & Record<string, unknown>, snapshotKey: string) {
  const snapshot = entry[snapshotKey];
  if (typeof snapshot === 'string' && snapshot.trim() !== '') return snapshot.trim();
  if (typeof entry.name === 'string' && entry.name.trim() !== '') return entry.name.trim();
  return '';
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null;
}

function readOption(option: OrderItemOptionSnapshot, index: number): ChosenOption | null {
  const label = labelOf(option, 'option_name_snapshot');
  // Opção sem rótulo não é mostrável: uma linha em branco recuada sob o item
  // parece defeito da tela, não dado faltando no pedido.
  if (!label) return null;

  return {
    key: option.id ?? option.option_id ?? `${label}-${index}`,
    label,
    additionalPrice: toNumberOrNull(option.additional_price_snapshot),
    quantity: toNumberOrNull(option.quantity),
  };
}

function readGroup(group: OrderItemOptionGroupSnapshot, index: number): ChosenOptionGroup | null {
  const options = (group.options ?? [])
    .map(readOption)
    .filter((option): option is ChosenOption => option !== null);
  if (options.length === 0) return null;

  return {
    key: group.id ?? group.option_group_id ?? `grupo-${index}`,
    // Grupo sem nome ainda vale a pena mostrar: as opções são a informação, e
    // o rótulo vazio some sozinho na renderização.
    label: labelOf(group, 'group_name_snapshot'),
    options,
  };
}

/** Os grupos com pelo menos uma opção legível, na ordem em que vieram. */
export function readOptionGroups(item: OrderItemWithOptions): ChosenOptionGroup[] {
  return (item.option_groups ?? [])
    .map(readGroup)
    .filter((group): group is ChosenOptionGroup => group !== null);
}
