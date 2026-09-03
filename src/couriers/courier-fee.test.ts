import { describe, expect, it } from 'vitest';

import {
  corpoDaTaxa,
  rascunhoDaTaxa,
  semTaxa,
  textoDaTaxa,
  type CourierFeeDraft,
} from './courier-fee';
import { formatCurrency } from '../orders/format';
import type { CourierFee } from '../api/types';

/*
 * O DINHEIRO É ESCRITO POR `formatCurrency`, e a expectativa passa por ele.
 *
 * Não é preguiça: entre "R$" e o número o `Intl` põe um espaço FIXO (U+00A0),
 * e uma expectativa com o espaço comum falha por uma diferença invisível na
 * tela e no diff. O que este arquivo testa é a COMPOSIÇÃO da frase; o formato
 * do dinheiro tem dono, e tem teste próprio.
 */
const reais = (valor: number) => formatCurrency(valor);

function taxa(overrides: Partial<CourierFee> = {}): CourierFee {
  return {
    branch_id: '22222222-2222-2222-2222-222222222222',
    courier_fee_base: null,
    courier_fee_per_km: null,
    ...overrides,
  };
}

const VAZIO: CourierFeeDraft = { base: '', perKm: '' };

/*
 * ============================================================================
 * `null` É "SEM TAXA", E NUNCA ZERO
 * ============================================================================
 *
 * É a regra dura do contrato, e ela existe porque zero é um número que SOMA no
 * histórico que o dono usa para pagar o motoboy: uma filial que nunca
 * configurou taxa apareceria como "grátis" em vez de "sem taxa", e o dono
 * concluiria que não deve nada.
 *
 * A leitura ao contrário também é regra, e é a que se erra por descuido: um
 * zero DIGITADO é um zero de verdade — o acordo em que a loja não paga por
 * corrida — e mostrá-lo como "sem taxa" apagaria uma escolha do lojista.
 */
describe('semTaxa', () => {
  it('os dois nulos é sem taxa', () => {
    expect(semTaxa(taxa())).toBe(true);
  });

  it('só a base configurada já é taxa', () => {
    expect(semTaxa(taxa({ courier_fee_base: 8 }))).toBe(false);
  });

  it('só o por-km configurado também é taxa', () => {
    expect(semTaxa(taxa({ courier_fee_per_km: 1.5 }))).toBe(false);
  });

  it('ZERO NÃO É AUSÊNCIA: base zero é um acordo, não um campo em branco', () => {
    expect(semTaxa(taxa({ courier_fee_base: 0 }))).toBe(false);
  });

  it('sem resposta ainda, não afirma que não há taxa', () => {
    expect(semTaxa(null)).toBe(false);
  });
});

describe('textoDaTaxa', () => {
  it('sem taxa não vira R$ 0,00', () => {
    const texto = textoDaTaxa(taxa());
    expect(texto).toContain('Sem taxa');
    expect(texto).not.toContain('0,00');
  });

  it('só base é "por corrida"', () => {
    expect(textoDaTaxa(taxa({ courier_fee_base: 8 }))).toBe(`${reais(8)} por corrida`);
  });

  it('base e por-km somam na frase, com a fórmula à vista', () => {
    expect(textoDaTaxa(taxa({ courier_fee_base: 8, courier_fee_per_km: 1.5 }))).toBe(
      `${reais(8)} por corrida + ${reais(1.5)} por km`,
    );
  });

  it('só por-km é a configuração de quem paga pela distância', () => {
    expect(textoDaTaxa(taxa({ courier_fee_per_km: 1.5 }))).toBe(`${reais(1.5)} por km`);
  });

  it('base zero é R$ 0,00 escrito, e não "sem taxa"', () => {
    expect(textoDaTaxa(taxa({ courier_fee_base: 0 }))).toBe(`${reais(0)} por corrida`);
  });
});

describe('rascunhoDaTaxa', () => {
  it('nulo vira campo em branco, não zero digitado', () => {
    expect(rascunhoDaTaxa(taxa())).toEqual({ base: '', perKm: '' });
  });

  it('número vira o texto que o lojista digitaria', () => {
    expect(rascunhoDaTaxa(taxa({ courier_fee_base: 8, courier_fee_per_km: 1.5 }))).toEqual({
      base: '8,00',
      perKm: '1,50',
    });
  });

  it('zero gravado volta como zero no campo', () => {
    expect(rascunhoDaTaxa(taxa({ courier_fee_base: 0 })).base).toBe('0,00');
  });
});

/*
 * ============================================================================
 * O CORPO DO PATCH TEM TRÊS ESTADOS, E O DIFF É QUEM OS SEPARA
 * ============================================================================
 *
 * Campo ausente não mexe; valor grava; `null` explícito apaga. Só o que MUDOU
 * entra no corpo — mandar o par inteiro a cada salvamento faria um campo que a
 * tela nem mostrou (porque o papel não o edita) ser reescrito por cima.
 */
describe('corpoDaTaxa', () => {
  it('nada mudou, corpo vazio: um PATCH que não mexe em nada', () => {
    const atual: CourierFeeDraft = { base: '8,00', perKm: '' };
    const saida = corpoDaTaxa(atual, atual);
    expect(saida.ok && saida.body).toEqual({});
  });

  it('dinheiro sobe como STRING de duas casas, como o resto do painel', () => {
    const saida = corpoDaTaxa({ base: '8,5', perKm: '' }, VAZIO);
    expect(saida.ok && saida.body).toEqual({ courier_fee_base: '8.50' });
  });

  /*
   * APAGAR É `null` EXPLÍCITO, e não o campo fora do corpo — este é o par do
   * `printing_sector_id`: omitir seria "não mexa", e o lojista que limpou o
   * campo mandou apagar.
   */
  it('campo esvaziado manda null explícito, não a ausência', () => {
    const saida = corpoDaTaxa(VAZIO, { base: '8,00', perKm: '1,50' });
    expect(saida.ok && saida.body).toEqual({ courier_fee_base: null, courier_fee_per_km: null });
  });

  it('só o campo mexido entra no corpo', () => {
    const saida = corpoDaTaxa({ base: '8,00', perKm: '2,00' }, { base: '8,00', perKm: '1,50' });
    expect(saida.ok && saida.body).toEqual({ courier_fee_per_km: '2.00' });
  });

  it('zero digitado é um valor, e vai como valor', () => {
    const saida = corpoDaTaxa({ base: '0', perKm: '' }, VAZIO);
    expect(saida.ok && saida.body).toEqual({ courier_fee_base: '0.00' });
  });

  it('texto que não é número trava o salvamento, dizendo qual campo', () => {
    const saida = corpoDaTaxa({ base: 'oito reais', perKm: '' }, VAZIO);
    expect(saida.ok).toBe(false);
    expect(!saida.ok && saida.message).toContain('Taxa por corrida');
  });

  it('negativo é recusado antes de sair da tela', () => {
    const saida = corpoDaTaxa({ base: '', perKm: '-1' }, VAZIO);
    expect(saida.ok).toBe(false);
    expect(!saida.ok && saida.message).toContain('por km');
  });
});
