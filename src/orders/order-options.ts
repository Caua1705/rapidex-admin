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
 *
 * Os tipos vêm do contrato gerado. Antes vinham de um overlay escrito à mão que
 * lia o rótulo de dois campos possíveis, porque não se sabia qual o backend
 * mandava; o contrato publicou `option_group_name_snapshot` e
 * `option_name_snapshot`, e a adivinhação saiu junto com o overlay.
 */
import type { OrderItem, OrderItemOption, OrderItemOptionGroup } from '../api/types';

export type ChosenOption = {
  key: string;
  label: string;
  /** Já embutido no preço do item; serve só para conferir. */
  additionalPrice: number;
};

export type ChosenOptionGroup = {
  key: string;
  label: string;
  options: ChosenOption[];
};

function readOption(option: OrderItemOption): ChosenOption | null {
  const label = option.option_name_snapshot.trim();
  // Opção sem rótulo não é mostrável: uma linha em branco recuada sob o item
  // parece defeito da tela, não dado faltando no pedido.
  if (!label) return null;

  return {
    key: option.id,
    label,
    additionalPrice: option.additional_price_snapshot,
  };
}

function readGroup(group: OrderItemOptionGroup): ChosenOptionGroup | null {
  const options = group.options
    .map(readOption)
    .filter((option): option is ChosenOption => option !== null);
  if (options.length === 0) return null;

  return {
    key: group.option_group_id,
    // Grupo sem nome ainda vale a pena mostrar: as opções são a informação, e
    // o rótulo vazio some sozinho na renderização.
    label: group.option_group_name_snapshot.trim(),
    options,
  };
}

/** Os grupos com pelo menos uma opção legível, na ordem em que vieram. */
export function readOptionGroups(item: OrderItem): ChosenOptionGroup[] {
  return (item.option_groups ?? [])
    .map(readGroup)
    .filter((group): group is ChosenOptionGroup => group !== null);
}
