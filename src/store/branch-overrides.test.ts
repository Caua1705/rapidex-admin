import { describe, expect, it } from 'vitest';

import type { BranchOperation, RestaurantSettings } from '../api/types';
import { bodyFromDraft, draftFromOverrides, EMPTY_DRAFT } from './branch-overrides';

const PADRAO: RestaurantSettings = {
  min_order_value: 20,
  estimated_delivery_time_min: 30,
  estimated_delivery_time_max: 60,
  default_delivery_fee: 9,
  service_fee_enabled: true,
  service_fee_amount: 0.99,
};

/** Toda filial nasce assim: herdando tudo, como a migração as deixou. */
const HERDANDO: BranchOperation['overrides'] = {
  min_order_value: null,
  estimated_delivery_time_min: null,
  estimated_delivery_time_max: null,
  default_delivery_fee: null,
  service_fee_enabled: null,
  service_fee_amount: null,
};

function corpo(draft = EMPTY_DRAFT, gravado = HERDANDO, padrao = PADRAO) {
  const resultado = bodyFromDraft(draft, gravado, padrao);
  if (!resultado.ok) throw new Error(`não montou o corpo: ${resultado.message}`);
  return resultado;
}

describe('o rascunho sai do que está gravado NA FILIAL', () => {
  it('herdando é campo vazio, não zero', () => {
    expect(draftFromOverrides(HERDANDO)).toEqual(EMPTY_DRAFT);
  });

  it('sobrescrito vem preenchido, no formato que o lojista digita', () => {
    expect(
      draftFromOverrides({ ...HERDANDO, min_order_value: 45, estimated_delivery_time_min: 25 }),
    ).toMatchObject({ minOrderValue: '45,00', estimatedMin: '25' });
  });

  /*
   * `false` gravado é uma ESCOLHA ("esta loja não cobra taxa"), e não a falta
   * de uma. Lê-lo como "herda" faria a filial voltar a cobrar a taxa da rede no
   * primeiro salvamento — o mesmo erro que um `or` no lugar de `is not None`
   * causaria no backend.
   */
  it('taxa desligada na filial não é herança', () => {
    expect(draftFromOverrides({ ...HERDANDO, service_fee_enabled: false }).serviceFee).toBe(
      'nao-cobra',
    );
    expect(draftFromOverrides({ ...HERDANDO, service_fee_enabled: true }).serviceFee).toBe('cobra');
    expect(draftFromOverrides(HERDANDO).serviceFee).toBe('herda');
  });
});

describe('o corpo do PATCH', () => {
  /*
   * O TESTE QUE GUARDA O DEFEITO: abrir a tela de uma filial que herda tudo e
   * salvar não pode mandar `null` nenhum. Um formulário que serializa vazio
   * como `null` devolveria a filial ao padrão sem ninguém pedir — e o sintoma
   * apareceria semanas depois, com a taxa mudando sozinha.
   */
  it('não manda nada quando nada mudou, mesmo com tudo vazio', () => {
    const resultado = corpo();

    expect(resultado.body).toEqual({});
    expect(resultado.vazio).toBe(true);
  });

  it('herdando tudo e salvando de novo, continua sem mandar null', () => {
    const gravado = { ...HERDANDO, min_order_value: 45 };
    const draft = draftFromOverrides(gravado);

    // Mexeu só no prazo; o resto continua como estava.
    const resultado = corpo({ ...draft, estimatedMin: '25', estimatedMax: '40' }, gravado);

    expect(resultado.body).toEqual({
      estimated_delivery_time_min: 25,
      estimated_delivery_time_max: 40,
    });
    expect(resultado.body).not.toHaveProperty('min_order_value');
    expect(resultado.body).not.toHaveProperty('service_fee_enabled');
  });

  it('sobrescreve o que o lojista digitou', () => {
    expect(corpo({ ...EMPTY_DRAFT, minOrderValue: '45,00' }).body).toEqual({
      min_order_value: 45,
    });
  });

  /*
   * O `null` explícito só sai daqui: o campo TINHA valor e o lojista o apagou.
   * É o único jeito de desfazer uma divergência — sem ele a filial ficaria com
   * a cópia congelada para sempre.
   */
  it('apagar uma sobrescrita que existia manda null', () => {
    const gravado = { ...HERDANDO, min_order_value: 45 };

    expect(corpo({ ...EMPTY_DRAFT, minOrderValue: '' }, gravado).body).toEqual({
      min_order_value: null,
    });
  });

  it('voltar a taxa para "herda" manda null; trocar cobra/não cobra manda o booleano', () => {
    const cobrando = { ...HERDANDO, service_fee_enabled: true };

    expect(corpo({ ...EMPTY_DRAFT, serviceFee: 'herda' }, cobrando).body).toEqual({
      service_fee_enabled: null,
    });
    expect(corpo({ ...EMPTY_DRAFT, serviceFee: 'nao-cobra' }, cobrando).body).toEqual({
      service_fee_enabled: false,
    });
    // `false` gravado x `false` no campo: nada mudou, nada vai.
    expect(
      corpo(
        { ...EMPTY_DRAFT, serviceFee: 'nao-cobra' },
        { ...HERDANDO, service_fee_enabled: false },
      ).body,
    ).toEqual({});
  });

  it('digitar o mesmo valor que já estava gravado não manda nada', () => {
    const gravado = { ...HERDANDO, min_order_value: 45 };

    expect(corpo({ ...EMPTY_DRAFT, minOrderValue: '45,00' }, gravado).body).toEqual({});
  });
});

describe('a faixa de prazo é conferida sobre a MESCLA', () => {
  /*
   * Sobrescrever só o máximo é legítimo: o mínimo continua vindo do
   * restaurante. Quem trata o lado vazio como "sem faixa" recusa uma edição
   * que o backend aceitaria.
   */
  it('só o máximo sobrescrito passa, medido contra o mínimo herdado', () => {
    expect(corpo({ ...EMPTY_DRAFT, estimatedMax: '90' }).body).toEqual({
      estimated_delivery_time_max: 90,
    });
  });

  it('máximo abaixo do mínimo herdado é recusado antes de sair da tela', () => {
    const resultado = bodyFromDraft({ ...EMPTY_DRAFT, estimatedMax: '10' }, HERDANDO, PADRAO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.message).toContain('não pode ser menor');
  });

  it('texto inválido trava o salvamento em vez de virar nulo', () => {
    const resultado = bodyFromDraft({ ...EMPTY_DRAFT, minOrderValue: 'abc' }, HERDANDO, PADRAO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.message).toContain('Valor mínimo');
  });
});
