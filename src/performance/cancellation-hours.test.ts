/**
 * A hora dos cancelamentos.
 *
 * O QUE ESTES TESTES PROTEGEM: dois erros silenciosos, e nenhum dos dois o
 * typecheck pega.
 *
 * 1. **O FUSO.** `created_at` chega em UTC e a leitura tem de ser feita em
 *    America/Fortaleza — o mesmo fuso em que o backend fecha o dia. Ler no fuso
 *    do navegador desloca o pico em três horas e a tela aponta o problema para
 *    o horário errado, com total aparência de acerto.
 * 2. **A AMOSTRA.** Um "pico às 20h" tirado de três pedidos é ruído com cara de
 *    evidência, e o lojista mudaria a escala da cozinha por causa dele.
 */
import { describe, expect, it } from 'vitest';

import {
  HORA_LIMIARES,
  hourLabel,
  lerHorasDeCancelamento,
  operationHour,
} from './cancellation-hours';
import type { OrderListItem } from '../api/types';

/** Um pedido com hora — é só o `created_at` que esta leitura consome. */
function pedidoEm(iso: string, index = 0): OrderListItem {
  return {
    id: `o${index}-${iso}`,
    order_number: 1000 + index,
    branch_id: 'b1',
    customer_name_snapshot: 'Cliente',
    customer_phone_snapshot: '85999990000',
    order_type: 'delivery',
    status: 'cancelled',
    payment_method: 'pix',
    payment_status: 'refunded',
    total: 50,
    created_at: iso,
  };
}

/** N pedidos na mesma hora LOCAL da operação (UTC−3). */
function naHoraLocal(hora: number, quantos: number, dia = '2026-08-12'): OrderListItem[] {
  const utc = String((hora + 3) % 24).padStart(2, '0');
  return Array.from({ length: quantos }, (_, i) => pedidoEm(`${dia}T${utc}:15:00Z`, i));
}

describe('operationHour', () => {
  /*
   * ESTE É O TESTE QUE JUSTIFICA O ARQUIVO. 23h UTC é 20h em Fortaleza — e
   * "20h" é exatamente o exemplo que motivou a seção. Lido no fuso do
   * navegador, o mesmo instante viraria 23h, 20h ou 01h conforme a máquina.
   */
  it('lê a hora no fuso da operação, não no do navegador', () => {
    expect(operationHour('2026-08-12T23:15:00Z')).toBe(20);
    expect(operationHour('2026-08-12T02:30:00Z')).toBe(23);
  });

  /*
   * A MEIA-NOITE É 0, NUNCA 24. Com `hour12: false` no lugar de `hourCycle:
   * 'h23'`, boa parte das combinações de locale escreve "24" — e um balde de
   * índice 24 num vetor de 24 posições some sem erro nenhum.
   */
  it('a meia-noite da operação é a hora 0', () => {
    expect(operationHour('2026-08-12T03:00:00Z')).toBe(0);
  });

  it('devolve null no que não é data', () => {
    expect(operationHour(null)).toBeNull();
    expect(operationHour(undefined)).toBeNull();
    expect(operationHour('')).toBeNull();
    expect(operationHour('ontem à noite')).toBeNull();
  });
});

describe('hourLabel', () => {
  it('escreve a hora com dois dígitos', () => {
    expect(hourLabel(9)).toBe('09h');
    expect(hourLabel(20)).toBe('20h');
    expect(hourLabel(0)).toBe('00h');
  });
});

describe('lerHorasDeCancelamento', () => {
  it('amostra pequena demais não vira leitura nenhuma', () => {
    const poucos = naHoraLocal(20, HORA_LIMIARES.amostraMinima - 1);
    expect(lerHorasDeCancelamento(poucos)).toBeNull();
  });

  it('a partir da amostra mínima a leitura existe', () => {
    const leitura = lerHorasDeCancelamento(naHoraLocal(20, HORA_LIMIARES.amostraMinima));
    expect(leitura?.total).toBe(HORA_LIMIARES.amostraMinima);
  });

  /*
   * A FAIXA DESENHADA VAI DA PRIMEIRA À ÚLTIMA HORA COM MOVIMENTO, e as horas
   * VAZIAS DE DENTRO ficam com zero.
   *
   * As duas metades importam. Sem a primeira, uma loja que abre às 18h teria
   * dezoito colunas rentes ao chão e o olho leria "cancelou pouco" onde está
   * escrito "estava fechado". Sem a segunda, um buraco às 20h desapareceria e
   * "concentrado" e "espalhado" passariam a ter o mesmo desenho.
   */
  it('desenha da primeira à última hora com movimento, com os buracos de dentro', () => {
    const leitura = lerHorasDeCancelamento([
      ...naHoraLocal(19, 3),
      ...naHoraLocal(21, 3),
    ]);

    expect(leitura?.horas.map((balde) => balde.hour)).toEqual([19, 20, 21]);
    expect(leitura?.horas.map((balde) => balde.count)).toEqual([3, 0, 3]);
  });

  it('uma hora sozinha acima do limiar de pico é a concentração', () => {
    const leitura = lerHorasDeCancelamento([
      ...naHoraLocal(20, 6),
      ...naHoraLocal(12, 1),
      ...naHoraLocal(15, 1),
    ]);

    expect(leitura?.concentracao?.tipo).toBe('pico');
    expect(leitura?.concentracao?.inicio).toBe(20);
    expect(leitura?.concentracao?.count).toBe(6);
  });

  it('sem hora dominante, a faixa de horas seguidas responde', () => {
    /* 3 + 3 + 3 nas 19h/20h/21h (nenhuma sozinha chega a 40%) e 2 espalhados. */
    const leitura = lerHorasDeCancelamento([
      ...naHoraLocal(19, 3),
      ...naHoraLocal(20, 3),
      ...naHoraLocal(21, 3),
      ...naHoraLocal(11, 1),
      ...naHoraLocal(14, 1),
    ]);

    expect(leitura?.concentracao?.tipo).toBe('janela');
    expect(leitura?.concentracao?.inicio).toBe(19);
    expect(leitura?.concentracao?.fim).toBe(21);
    expect(leitura?.concentracao?.count).toBe(9);
  });

  /*
   * ESPALHADO NÃO É UMA FRASE, É UM DESENHO PLANO.
   *
   * `concentracao` nula é a resposta "não há padrão de horário" — e ela chega à
   * tela como a AUSÊNCIA da frase, com o gráfico continuando ali. Uma frase
   * dizendo "espalhado pelo dia" apareceria na maioria dos períodos e deixaria
   * de ser lida, levando junto a credibilidade das que importam (regra 2 de
   * `insights.ts`).
   */
  it('cancelamento espalhado não produz concentração', () => {
    const leitura = lerHorasDeCancelamento([
      ...naHoraLocal(11, 1),
      ...naHoraLocal(13, 1),
      ...naHoraLocal(15, 1),
      ...naHoraLocal(18, 1),
      ...naHoraLocal(20, 1),
      ...naHoraLocal(22, 1),
    ]);

    expect(leitura).not.toBeNull();
    expect(leitura?.concentracao).toBeNull();
  });

  /*
   * A JANELA NÃO DÁ A VOLTA NA MEIA-NOITE, de propósito: o dia da operação
   * fecha à meia-noite no backend, então 23h e 00h são de DIAS diferentes, e
   * juntá-los numa faixa somaria pedidos de dias distintos.
   */
  it('a faixa de concentração não atravessa a virada do dia', () => {
    const leitura = lerHorasDeCancelamento([...naHoraLocal(23, 3), ...naHoraLocal(0, 3)]);
    expect(leitura?.concentracao?.tipo).not.toBe('janela');
  });

  it('pedido sem hora legível não entra na conta', () => {
    const leitura = lerHorasDeCancelamento([
      ...naHoraLocal(20, 5),
      pedidoEm('sem data', 99),
      { ...pedidoEm('2026-08-12T23:00:00Z', 98), created_at: null },
    ]);

    expect(leitura?.total).toBe(5);
  });

  it('sem pedido nenhum não há leitura', () => {
    expect(lerHorasDeCancelamento([])).toBeNull();
    expect(lerHorasDeCancelamento(null)).toBeNull();
  });
});
