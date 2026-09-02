import { describe, expect, it } from 'vitest';

import { fluxoParado, LIMITE_DE_SILENCIO_MS, TETO_DA_CONEXAO_MS } from './stream-health';

const AGORA = Date.parse('2026-09-02T20:00:00Z');
const min = (n: number) => n * 60_000;

describe('fluxoParado', () => {
  it('recém-aberto não está parado', () => {
    expect(fluxoParado(AGORA, AGORA)).toBe(false);
  });

  /*
   * O CICLO NORMAL É DE QUINZE MINUTOS, e ele não pode acender a etiqueta: o
   * backend fecha toda conexão em `MAX_STREAM_SECONDS`, o painel reabre, e o
   * `onopen` da reabertura é o sinal. Um limite abaixo do teto acusaria o
   * funcionamento normal como defeito, a cada quarto de hora, em toda loja.
   */
  it('o silêncio do ciclo normal do backend não acende nada', () => {
    expect(fluxoParado(AGORA - TETO_DA_CONEXAO_MS, AGORA)).toBe(false);
    expect(fluxoParado(AGORA - TETO_DA_CONEXAO_MS - min(1), AGORA)).toBe(false);
  });

  it('passado o limite, está parado', () => {
    expect(fluxoParado(AGORA - LIMITE_DE_SILENCIO_MS - 1, AGORA)).toBe(true);
  });

  it('exatamente no limite ainda não está — a folga é para não acusar à toa', () => {
    expect(fluxoParado(AGORA - LIMITE_DE_SILENCIO_MS, AGORA)).toBe(false);
  });

  /*
   * A FOLGA PRECISA CABER UMA REABERTURA INTEIRA: ticket novo, conexão nova, e
   * a espera crescente se a primeira tentativa falhar. Sem ela, um painel
   * saudável numa rede lenta piscaria "sem sinal" a cada quarto de hora.
   */
  it('o limite fica acima do teto da conexão, com folga de sobra', () => {
    expect(LIMITE_DE_SILENCIO_MS).toBeGreaterThan(TETO_DA_CONEXAO_MS + min(2));
  });

  /*
   * NUNCA ABRIU NÃO É "PAROU". Sem nenhum sinal ainda, o estado é `connecting`
   * e quem cuida dele é a reconexão. E o `null` aqui é a armadilha do dia: uma
   * subtração com ele viraria `agora - 0`, um número enorme, e TODO painel
   * abriria afirmando que o tempo real está parado desde 1970.
   */
  it('sem nenhum sinal ainda, não afirma que parou', () => {
    expect(fluxoParado(null, AGORA)).toBe(false);
  });
});
