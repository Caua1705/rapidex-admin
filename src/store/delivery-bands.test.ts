import { describe, expect, it } from 'vitest';

import { bandsFromDraft, draftFromBands, faixaPara, novaFaixa } from './delivery-bands';

function linha(maxDistanceKm: string, timeMin: string, timeMax: string) {
  return { ...novaFaixa(), maxDistanceKm, timeMin, timeMax };
}

describe('a tabelinha vira o corpo do PUT', () => {
  it('sai ordenada por teto, que é a ordem em que a regra as lê', () => {
    const resultado = bandsFromDraft([linha('10', '40', '55'), linha('5', '25', '35')]);
    expect(resultado.ok && resultado.bands.map((band) => band.max_distance_km)).toEqual([5, 10]);
  });

  /*
   * LISTA VAZIA NÃO É "SEM ENTREGA": é o prazo voltando a sair do tempo do
   * Google, como antes desta tabela existir. É como se desfaz a configuração.
   */
  it('lista vazia passa, e é como se apaga a configuração', () => {
    expect(bandsFromDraft([])).toEqual({ ok: true, bands: [] });
    expect(bandsFromDraft([novaFaixa()])).toEqual({ ok: true, bands: [] });
  });

  it('linha pela metade é erro, e não uma faixa com zero', () => {
    const resultado = bandsFromDraft([linha('5', '25', '')]);
    expect(resultado.ok).toBe(false);
  });

  it('tempo mínimo maior que o máximo é recusado antes de sair da tela', () => {
    const resultado = bandsFromDraft([linha('5', '40', '20')]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.message).toMatch(/mínimo não pode ser maior/);
  });

  /*
   * DOIS TETOS IGUAIS SÃO DUAS RESPOSTAS PARA A MESMA DISTÂNCIA, e qual vale
   * mudaria entre duas consultas idênticas. O backend tem UNIQUE; aqui o
   * lojista vê o problema com as duas linhas na frente dele.
   */
  it('dois tetos iguais são recusados', () => {
    const resultado = bandsFromDraft([linha('5', '20', '30'), linha('5', '25', '35')]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.message).toMatch(/duas faixas até 5 km/);
  });

  it('aceita distância com vírgula, que é como o lojista digita', () => {
    const resultado = bandsFromDraft([linha('7,5', '30', '45')]);
    expect(resultado.ok && resultado.bands[0]?.max_distance_km).toBe(7.5);
  });
});

describe('qual faixa responde por uma distância', () => {
  const bands = [
    { max_distance_km: 5, delivery_time_min: 20, delivery_time_max: 30 },
    { max_distance_km: 10, delivery_time_min: 35, delivery_time_max: 50 },
  ];

  it('vale a primeira, em ordem crescente, cujo teto alcança', () => {
    expect(faixaPara(bands, 3)?.max_distance_km).toBe(5);
    expect(faixaPara(bands, 7)?.max_distance_km).toBe(10);
  });

  /* O teto é `<=`: a distância exata cai na própria faixa. */
  it('a distância exata do teto cai na faixa dele', () => {
    expect(faixaPara(bands, 5)?.max_distance_km).toBe(5);
  });

  /*
   * ALÉM DO ÚLTIMO TETO NÃO É "NÃO ATENDIDO": é o tempo do Google de novo. Quem
   * responde por até onde a filial atende é `delivery_max_distance_km`, que é
   * outra pergunta.
   */
  it('além do último teto não há faixa, e isso é um estado válido', () => {
    expect(faixaPara(bands, 12)).toBeNull();
  });
});

describe('o que veio do backend vira rascunho', () => {
  it('já ordenado, e com a distância no formato que se digita', () => {
    const draft = draftFromBands([
      { id: 'b', branch_id: 'f1', max_distance_km: 7.5, delivery_time_min: 30, delivery_time_max: 45 },
      { id: 'a', branch_id: 'f1', max_distance_km: 3, delivery_time_min: 15, delivery_time_max: 25 },
    ]);
    expect(draft.map((linha) => linha.maxDistanceKm)).toEqual(['3', '7,5']);
  });
});
