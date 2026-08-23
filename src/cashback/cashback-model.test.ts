import { describe, expect, it } from 'vitest';

import type { CashbackRule, CashbackRuleView } from '../api/types';
import {
  bodyFrom,
  draftFrom,
  draftVazio,
  explicacaoDaOrigem,
  percentuaisIncomuns,
  problemaDoDraft,
  TETO_PERCENTUAL,
  WEEKDAYS,
} from './cashback-model';

function regra(overrides: Partial<CashbackRule> = {}): CashbackRule {
  return {
    id: 'rule-1',
    restaurant_id: 'rest-1',
    branch_id: null,
    enabled: true,
    default_percent: '5.00',
    min_redeem_balance: '10.00',
    expiry_days: 60,
    weekdays: [],
    ...overrides,
  };
}

describe('a numeração do dia da semana', () => {
  /*
   * A ARMADILHA Nº 1, e ela é silenciosa dos dois lados: o número existe em
   * ambos e nenhum reclama. `getDay()` do JS é 0 = domingo; aqui 0 é SEGUNDA.
   */
  it('conta 0 = segunda, como o backend e como a grade de horários', () => {
    expect(WEEKDAYS[0]).toMatchObject({ weekday: 0, label: 'Segunda-feira' });
    expect(WEEKDAYS[1]).toMatchObject({ weekday: 1, label: 'Terça-feira' });
    expect(WEEKDAYS[6]).toMatchObject({ weekday: 6, label: 'Domingo' });
  });

  it('a terça de 10% sai no corpo como weekday 1, não 2', () => {
    const draft = draftFrom(regra({ weekdays: [{ weekday: 1, percent: '10.00' }] }));
    expect(draft.dias.find((dia) => dia.weekday === 1)?.percent).toBe('10');

    const body = bodyFrom(draft);
    expect(body.weekdays).toEqual([{ weekday: 1, percent: '10.00' }]);
  });
});

describe('dia ausente herda o percentual base', () => {
  /*
   * A ARMADILHA Nº 2 — a inversão em relação ao `PUT` de horários, onde dia
   * ausente significa dia FECHADO. Aqui, mandar os sete sempre congelaria os
   * sete no valor da caixa e mataria a alavanca.
   */
  it('dia em branco SAI do corpo, e não vai como zero', () => {
    const draft = draftFrom(regra({ weekdays: [{ weekday: 1, percent: '10.00' }] }));
    const body = bodyFrom(draft);

    expect(body.weekdays).toHaveLength(1);
    expect(body.weekdays?.some((dia) => dia.percent === '0.00')).toBe(false);
  });

  it('regra sem nenhum dia próprio manda a lista VAZIA, não sete zeros', () => {
    expect(bodyFrom(draftFrom(regra())).weekdays).toEqual([]);
  });

  /* Zero digitado é uma escolha — "neste dia não credita" — e não é o mesmo
     que o campo vazio. Os dois estados precisam sobreviver ao corpo. */
  it('zero DIGITADO entra no corpo, ao contrário do campo vazio', () => {
    const draft = draftFrom(regra());
    draft.dias[5]!.percent = '0';
    expect(bodyFrom(draft).weekdays).toEqual([{ weekday: 5, percent: '0.00' }]);
  });

  it('a grade tem sempre os sete dias, mesmo com a regra trazendo um', () => {
    const draft = draftFrom(regra({ weekdays: [{ weekday: 3, percent: '8.00' }] }));
    expect(draft.dias).toHaveLength(7);
    expect(draft.dias.filter((dia) => dia.percent === '')).toHaveLength(6);
  });
});

describe('a ida e a volta', () => {
  /* Abrir e salvar sem tocar em nada devolve exatamente a mesma regra. */
  it('carregar e gravar sem editar não muda a regra', () => {
    const original = regra({
      default_percent: '7.50',
      min_redeem_balance: '20.00',
      expiry_days: 30,
      weekdays: [
        { weekday: 1, percent: '12.00' },
        { weekday: 4, percent: '3.00' },
      ],
    });

    expect(bodyFrom(draftFrom(original))).toEqual({
      enabled: true,
      default_percent: '7.50',
      min_redeem_balance: '20.00',
      expiry_days: 30,
      weekdays: [
        { weekday: 1, percent: '12.00' },
        { weekday: 4, percent: '3.00' },
      ],
    });
  });

  /*
   * A ARMADILHA Nº 4: `Numeric(5,2)` promete duas casas, e `10.00` como número
   * JSON vira `10.0`. Tudo o que é dinheiro ou percentual sai como STRING.
   */
  it('percentual e dinheiro saem como string de duas casas', () => {
    const draft = draftVazio();
    draft.enabled = true;
    draft.defaultPercent = '7,5';
    draft.minRedeemBalance = '10';
    draft.dias[0]!.percent = '12';

    const body = bodyFrom(draft);
    expect(body.default_percent).toBe('7.50');
    expect(body.min_redeem_balance).toBe('10.00');
    expect(body.weekdays?.[0]?.percent).toBe('12.00');
    expect(typeof body.expiry_days).toBe('number');
  });

  it('aceita a vírgula decimal que o lojista digita', () => {
    const draft = { ...draftVazio(), enabled: true, defaultPercent: '5,25' };
    expect(bodyFrom(draft).default_percent).toBe('5.25');
  });
});

describe('o rascunho vazio', () => {
  /* `source: 'none'` é "ninguém configurou". Abrir já ligado faria o primeiro
     salvamento acender uma campanha que ninguém pediu. */
  it('nasce desligado, com os sete dias em branco', () => {
    const draft = draftVazio();
    expect(draft.enabled).toBe(false);
    expect(draft.dias).toHaveLength(7);
    expect(draft.dias.every((dia) => dia.percent === '')).toBe(true);
  });

  it('regra nula cai no rascunho vazio', () => {
    expect(draftFrom(null)).toEqual(draftVazio());
  });
});

describe('o teto de sanidade', () => {
  it(`recusa acima de ${TETO_PERCENTUAL}%`, () => {
    const draft = { ...draftVazio(), enabled: true, defaultPercent: '31' };
    expect(problemaDoDraft(draft)?.campo).toBe('defaultPercent');
  });

  it('recusa também no percentual de um dia — é onde o dedo escorrega', () => {
    const draft = { ...draftVazio(), enabled: true, defaultPercent: '5' };
    draft.dias = draft.dias.map((dia) => (dia.weekday === 2 ? { ...dia, percent: '100' } : dia));
    expect(problemaDoDraft(draft)?.campo).toBe('dia-2');
  });

  it('aceita exatamente o teto', () => {
    const draft = { ...draftVazio(), enabled: true, defaultPercent: String(TETO_PERCENTUAL) };
    expect(problemaDoDraft(draft)).toBeNull();
  });

  /* O aviso de 10% é opinião: ele nomeia onde olhar e não impede nada. */
  it('avisa acima de 10% sem barrar, e nomeia o campo', () => {
    const draft = { ...draftVazio(), enabled: true, defaultPercent: '15' };
    draft.dias = draft.dias.map((dia) => (dia.weekday === 1 ? { ...dia, percent: '20' } : dia));

    expect(problemaDoDraft(draft)).toBeNull();
    expect(percentuaisIncomuns(draft)).toEqual(['Base', 'Terça-feira']);
  });

  it('não avisa nada num percentual comum', () => {
    const draft = { ...draftVazio(), enabled: true, defaultPercent: '5' };
    expect(percentuaisIncomuns(draft)).toEqual([]);
  });

  /*
   * DESLIGADO NÃO SE VALIDA: `enabled: false` é a forma de desligar a campanha,
   * e exigir os números certos para poder desligá-la seria pedir que o lojista
   * arrume a casa antes de fechar a porta.
   */
  it('rascunho desligado passa mesmo com os campos vazios', () => {
    expect(problemaDoDraft(draftVazio())).toBeNull();
    expect(percentuaisIncomuns({ ...draftVazio(), defaultPercent: '99' })).toEqual([]);
  });

  it('ligado sem percentual não salva', () => {
    expect(problemaDoDraft({ ...draftVazio(), enabled: true })?.campo).toBe('defaultPercent');
  });

  it('validade tem de ser inteiro a partir de 1', () => {
    const base = { ...draftVazio(), enabled: true, defaultPercent: '5' };
    expect(problemaDoDraft({ ...base, expiryDays: '0' })?.campo).toBe('expiryDays');
    expect(problemaDoDraft({ ...base, expiryDays: '1' })).toBeNull();
  });
});

describe('a origem da regra', () => {
  const view = (source: CashbackRuleView['source']): CashbackRuleView => ({
    source,
    rule: source === 'none' ? null : regra(),
  });

  /*
   * A ARMADILHA Nº 3: `none` NÃO é `enabled: false`. Um é "ninguém configurou",
   * o outro é "configurado e desligado" — e sem a distinção a tela não avisa que
   * salvar ali CRIA uma sobrescrita.
   */
  it('herdando avisa que salvar CRIA uma sobrescrita', () => {
    expect(explicacaoDaOrigem(view('restaurant'), 'filial').detalhe).toMatch(/CRIA uma regra/);
  });

  it('regra própria fala em voltar a herdar, não em criar', () => {
    const texto = explicacaoDaOrigem(view('branch'), 'filial');
    expect(texto.titulo).toMatch(/regra própria/);
    expect(texto.detalhe).not.toMatch(/CRIA/);
  });

  it('"ninguém configurou" é uma frase diferente de "desligado"', () => {
    const nenhuma = explicacaoDaOrigem(view('none'), 'filial');
    const desligada = explicacaoDaOrigem({ source: 'branch', rule: regra({ enabled: false }) }, 'filial');
    expect(nenhuma.titulo).not.toBe(desligada.titulo);
    expect(nenhuma.detalhe).toMatch(/ninguém está acumulando/i);
  });

  it('na rede a frase diz que filial com sobrescrita não é alcançada', () => {
    expect(explicacaoDaOrigem(view('restaurant'), 'rede').detalhe).toMatch(/sobrescrita/);
  });
});
