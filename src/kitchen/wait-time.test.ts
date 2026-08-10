import { describe, expect, it } from 'vitest';

import { readWait, type PrepWindow } from './wait-time';

/** Um instante fixo, para o teste não depender do relógio da máquina. */
const AGORA = new Date('2026-08-10T20:00:00.000Z').getTime();

/** ISO de N minutos antes de AGORA. */
function minutosAtras(minutes: number): string {
  return new Date(AGORA - minutes * 60_000).toISOString();
}

const FAIXA: PrepWindow = { prep_time_min: 25, prep_time_max: 40 };

describe('readWait — o número', () => {
  it('conta os minutos inteiros desde a entrada', () => {
    expect(readWait(minutosAtras(12), FAIXA, AGORA).minutes).toBe(12);
    expect(readWait(minutosAtras(0), FAIXA, AGORA).minutes).toBe(0);
  });

  it('arredonda para baixo: 12min59s ainda é 12', () => {
    const criado = new Date(AGORA - (12 * 60_000 + 59_000)).toISOString();
    expect(readWait(criado, FAIXA, AGORA).minutes).toBe(12);
  });

  /*
   * O relógio do navegador da cozinha pode estar adiantado em relação ao do
   * servidor. "−3 min" num monitor de parede lê como defeito da tela.
   */
  it('relógio adiantado não produz minuto negativo', () => {
    const futuro = new Date(AGORA + 3 * 60_000).toISOString();
    const leitura = readWait(futuro, FAIXA, AGORA);

    expect(leitura.minutes).toBe(0);
    expect(leitura.label).toBe('agora');
  });

  it('sem data não há o que contar, e a tela não mostra número', () => {
    expect(readWait(null, FAIXA, AGORA)).toEqual({ minutes: null, level: 'unknown', label: '—' });
    expect(readWait(undefined, FAIXA, AGORA).level).toBe('unknown');
    expect(readWait('data-torta', FAIXA, AGORA).level).toBe('unknown');
  });

  it('o rótulo é o mesmo do resto do painel', () => {
    expect(readWait(minutosAtras(0), FAIXA, AGORA).label).toBe('agora');
    expect(readWait(minutosAtras(12), FAIXA, AGORA).label).toBe('12 min');
    expect(readWait(minutosAtras(65), FAIXA, AGORA).label).toBe('1h05');
  });
});

describe('readWait — o alarme', () => {
  it('dentro do mínimo está em dia', () => {
    expect(readWait(minutosAtras(10), FAIXA, AGORA).level).toBe('ok');
    expect(readWait(minutosAtras(24), FAIXA, AGORA).level).toBe('ok');
  });

  // A partir do mínimo o pedido entrou na janela em que deveria estar saindo.
  it('a partir do mínimo entra na janela de entrega', () => {
    expect(readWait(minutosAtras(25), FAIXA, AGORA).level).toBe('due');
    expect(readWait(minutosAtras(33), FAIXA, AGORA).level).toBe('due');
  });

  // O limite é o MÁXIMO: 40 ainda é o prometido, 41 já é atraso.
  it('estoura só depois do máximo', () => {
    expect(readWait(minutosAtras(40), FAIXA, AGORA).level).toBe('due');
    expect(readWait(minutosAtras(41), FAIXA, AGORA).level).toBe('late');
    expect(readWait(minutosAtras(120), FAIXA, AGORA).level).toBe('late');
  });

  /*
   * Sem faixa gravada não existe alarme. Um limite padrão inventado pintaria de
   * vermelho a cozinha inteira de quem ainda não configurou o prazo — e alarme
   * que está sempre ligado deixa de ser alarme.
   */
  it('sem faixa configurada, o cronômetro conta mas nada fica vermelho', () => {
    expect(readWait(minutosAtras(5), null, AGORA).level).toBe('ok');
    expect(readWait(minutosAtras(300), null, AGORA).level).toBe('ok');
    expect(readWait(minutosAtras(300), null, AGORA).minutes).toBe(300);
  });

  it('faixa de ponta única (min = max) tem um limite só', () => {
    const exata: PrepWindow = { prep_time_min: 30, prep_time_max: 30 };
    expect(readWait(minutosAtras(29), exata, AGORA).level).toBe('ok');
    expect(readWait(minutosAtras(30), exata, AGORA).level).toBe('due');
    expect(readWait(minutosAtras(31), exata, AGORA).level).toBe('late');
  });

  it('faixa começando em zero deixa tudo na janela desde o primeiro minuto', () => {
    const zero: PrepWindow = { prep_time_min: 0, prep_time_max: 10 };
    expect(readWait(minutosAtras(0), zero, AGORA).level).toBe('due');
    expect(readWait(minutosAtras(11), zero, AGORA).level).toBe('late');
  });
});
