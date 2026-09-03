/**
 * ============================================================================
 * A TAXA POR CORRIDA — o que a LOJA paga ao motoboy
 * ============================================================================
 *
 * Não confunda com o frete: são dois números com a mesma fórmula (`base + km ×
 * por_km`) e lados opostos do balcão. O frete é o que o CLIENTE paga e vive em
 * `delivery_base_fee`/`delivery_fee_per_km`; este é o que a LOJA paga, e o
 * contrato é enfático — "nenhum numero que o CLIENTE paga muda com isto".
 *
 * Por isso a seção tem rota própria, permissão própria (ler é GERÊNCIA, gravar
 * é SOMENTE_DONO) e botão próprio, como as faixas de prazo ao lado.
 *
 * ----------------------------------------------------------------------------
 * `null` É "SEM TAXA", E NUNCA ZERO
 * ----------------------------------------------------------------------------
 *
 * A regra dura desta tela, e ela é do backend: `calculate_courier_fee` devolve
 * NULO quando não há o que somar, de propósito. Zero é um número que SOMA no
 * histórico que o dono usa para pagar — uma filial que nunca configurou taxa
 * apareceria como "grátis" em vez de "sem taxa", e o dono concluiria que não
 * deve nada ao motoboy.
 *
 * A LEITURA AO CONTRÁRIO TAMBÉM É REGRA, e é a que se erra por descuido: um
 * zero DIGITADO é um zero de verdade — o acordo em que a loja não paga por
 * corrida —, e mostrá-lo como "sem taxa" apagaria uma escolha do lojista. A
 * diferença entre ausência e zero atravessa este arquivo inteiro.
 *
 * ----------------------------------------------------------------------------
 * CADA CAMPO TEM O PRÓPRIO NULO
 * ----------------------------------------------------------------------------
 *
 * Base nula com por-km preenchido é configuração VÁLIDA — é a loja que paga
 * pela distância e nada pela corrida —, e o backend calcula. "Sem taxa" é os
 * DOIS nulos, não um deles.
 */
import { formatCurrency } from '../orders/format';
import { formatDecimalInput, parseDecimal } from '../store/settings-model';
import type { CourierFee, CourierFeeUpdate } from '../api/types';

export type CourierFeeDraft = {
  base: string;
  perKm: string;
};

export const RASCUNHO_VAZIO: CourierFeeDraft = { base: '', perKm: '' };

/**
 * A filial está sem taxa configurada?
 *
 * `null` (a leitura ainda não voltou) devolve `false`: sem resposta o painel
 * não sabe, e "sem taxa" é uma afirmação. É a mesma disciplina do aviso do
 * agente de impressão — ausência de fato não vira fato.
 */
export function semTaxa(fee: CourierFee | null): boolean {
  if (!fee) return false;
  return (
    numeroOuNulo(fee.courier_fee_base) === null && numeroOuNulo(fee.courier_fee_per_km) === null
  );
}

/**
 * A frase que a tela mostra. Nunca "R$ 0,00" para ausência — ver o cabeçalho.
 *
 * A FÓRMULA FICA À VISTA ("+ R$ 1,50 por km") em vez de um total de exemplo:
 * o total depende da distância de cada pedido, e um número único ali seria uma
 * promessa que a próxima corrida desmente.
 */
export function textoDaTaxa(fee: CourierFee | null): string {
  if (!fee) return '—';

  const base = numeroOuNulo(fee.courier_fee_base);
  const perKm = numeroOuNulo(fee.courier_fee_per_km);

  if (base === null && perKm === null) return 'Sem taxa por corrida';

  const partes: string[] = [];
  if (base !== null) partes.push(`${formatCurrency(base)} por corrida`);
  if (perKm !== null) partes.push(`${formatCurrency(perKm)} por km`);
  return partes.join(' + ');
}

/** Resposta → campos do formulário. Nulo é campo em branco, não "0,00". */
export function rascunhoDaTaxa(fee: CourierFee | null): CourierFeeDraft {
  if (!fee) return RASCUNHO_VAZIO;
  return {
    base: formatDecimalInput(numeroOuNulo(fee.courier_fee_base)),
    perKm: formatDecimalInput(numeroOuNulo(fee.courier_fee_per_km)),
  };
}

export type CorpoDaTaxa = { ok: true; body: CourierFeeUpdate } | { ok: false; message: string };

/**
 * Rascunho → corpo do PATCH, com os três estados do contrato.
 *
 * SÓ O QUE MUDOU ENTRA NO CORPO. Não é economia de bytes: "campo ausente não
 * mexe" só vale como garantia se a tela realmente omitir o que não tocou — e o
 * dia em que esta seção mostrar um campo a menos para algum papel, mandar o par
 * inteiro reescreveria por cima de um valor que a tela nem exibiu. É o defeito
 * do preço do produto (403 ao reenviar o mesmo valor), evitado antes.
 *
 * Campo esvaziado vira `null` EXPLÍCITO, e não ausência: omitir seria "não
 * mexa", e quem limpou o campo mandou apagar. Mesma regra de
 * `printing_sector_id`.
 *
 * DINHEIRO SOBE COMO STRING de duas casas — `number | string | null` no
 * contrato, `Decimal` do outro lado, e 8,10 como número pode chegar
 * 8,099999. É a escolha que o resto do painel já faz.
 */
export function corpoDaTaxa(draft: CourierFeeDraft, baseline: CourierFeeDraft): CorpoDaTaxa {
  const base = parseDecimal(draft.base);
  if (!base.ok) return { ok: false, message: `Taxa por corrida: ${base.message}` };

  const perKm = parseDecimal(draft.perKm);
  if (!perKm.ok) return { ok: false, message: `Valor por km: ${perKm.message}` };

  const body: CourierFeeUpdate = {};
  if (draft.base.trim() !== baseline.base.trim()) {
    body.courier_fee_base = base.value === null ? null : base.value.toFixed(2);
  }
  if (draft.perKm.trim() !== baseline.perKm.trim()) {
    body.courier_fee_per_km = perKm.value === null ? null : perKm.value.toFixed(2);
  }
  return { ok: true, body };
}

/**
 * O campo do contrato é `number | null` E OPCIONAL — a chave pode faltar.
 *
 * A conversão mora aqui porque `undefined` e `null` significam a mesma coisa
 * para esta tela ("não configurado") e porque o resto do arquivo não pode ficar
 * escolhendo entre `=== null` e `== null` a cada leitura. Vale o cuidado do
 * `new Date(null)`: nada aqui passa por `Number()` nem por comparação sem
 * antes virar `null` de verdade.
 */
function numeroOuNulo(valor: number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  return Number.isFinite(valor) ? valor : null;
}
