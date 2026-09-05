import { describe, expect, it } from 'vitest';

import {
  agrupamentoDoPeriodo,
  agruparPorSemana,
  caminhoDaSerie,
  diferencaDoPonto,
  DIAS_ATE_AGRUPAR_POR_SEMANA,
  indiceDoPico,
  marcasDoEixo,
  pontosDaLinha,
  rotuloCurto,
  rotuloDaMedida,
  tetoDaEscala,
} from './line-chart-model';
import type { SalesByDayItem } from '../api/types';

function dia(day: string, revenue: string, orders = 1): SalesByDayItem {
  return { day, revenue_total: revenue, orders_count: orders };
}

const ATUAL = [
  dia('2026-09-01', '420.00', 7),
  dia('2026-09-02', '9.00', 1),
  dia('2026-09-03', '0.00', 0),
];
const ANTERIOR = [
  dia('2026-08-25', '420.00', 7),
  dia('2026-08-26', '1400.00', 23),
  dia('2026-08-27', '10.00', 1),
];

describe('pontosDaLinha', () => {
  it('alinha os dois períodos pela POSIÇÃO, não pela data', () => {
    const pontos = pontosDaLinha(ATUAL, ANTERIOR, 'faturamento');

    expect(pontos).toHaveLength(3);
    expect(pontos[1]).toEqual({
      day: '2026-09-02',
      atual: 9,
      anterior: 1400,
      diaAnterior: '2026-08-26',
    });
  });

  it('sem o período anterior, cada ponto fica sem par — não com zero', () => {
    const pontos = pontosDaLinha(ATUAL, null, 'faturamento');

    expect(pontos.every((ponto) => ponto.anterior === null)).toBe(true);
    expect(pontos.every((ponto) => ponto.diaAnterior === null)).toBe(true);
  });

  it('período anterior mais curto deixa os dias sobrando sem par', () => {
    const pontos = pontosDaLinha(ATUAL, ANTERIOR.slice(0, 2), 'faturamento');

    expect(pontos[1]?.anterior).toBe(1400);
    expect(pontos[2]?.anterior).toBeNull();
  });

  it('a medida "pedidos" lê a contagem, e "faturamento" lê o dinheiro como NÚMERO', () => {
    const faturamento = pontosDaLinha(ATUAL, ANTERIOR, 'faturamento');
    const pedidos = pontosDaLinha(ATUAL, ANTERIOR, 'pedidos');

    expect(faturamento[0]?.atual).toBe(420);
    expect(pedidos[0]?.atual).toBe(7);
    expect(pedidos[1]?.anterior).toBe(23);
  });
});

describe('tetoDaEscala', () => {
  it('é o maior valor entre as DUAS séries — o anterior também segura a escala', () => {
    const pontos = pontosDaLinha(ATUAL, ANTERIOR, 'faturamento');
    expect(tetoDaEscala(pontos)).toBe(1400);
  });

  it('compara números, não strings — "9" contra "10" dá 10', () => {
    const pontos = pontosDaLinha(
      [dia('2026-09-01', '9.00'), dia('2026-09-02', '10.00')],
      null,
      'faturamento',
    );
    expect(tetoDaEscala(pontos)).toBe(10);
  });

  it('é zero num período sem movimento nenhum', () => {
    const pontos = pontosDaLinha([dia('2026-09-01', '0.00', 0)], null, 'faturamento');
    expect(tetoDaEscala(pontos)).toBe(0);
  });
});

describe('caminhoDaSerie', () => {
  it('desenha em coordenadas de 0 a 100, com a origem embaixo', () => {
    const pontos = pontosDaLinha(ATUAL, ANTERIOR, 'faturamento');
    const caminho = caminhoDaSerie(pontos, 1400, 'atual');

    // 420/1400 = 30% da altura → y = 70; o último dia é zero → y = 100.
    expect(caminho).toBe('M0 70 L50 99.357 L100 100');
  });

  it('um dia sem par QUEBRA a linha do anterior em vez de puxá-la para o zero', () => {
    const pontos = pontosDaLinha(ATUAL, ANTERIOR.slice(0, 2), 'faturamento');
    const caminho = caminhoDaSerie(pontos, 1400, 'anterior');

    expect(caminho).toBe('M0 70 L50 0');
  });

  it('um único ponto vira um traço no meio, não uma divisão por zero', () => {
    const pontos = pontosDaLinha([dia('2026-09-01', '100.00')], null, 'faturamento');
    expect(caminhoDaSerie(pontos, 100, 'atual')).toBe('M50 0');
  });

  it('teto zero não desenha nada', () => {
    const pontos = pontosDaLinha([dia('2026-09-01', '0.00', 0)], null, 'faturamento');
    expect(caminhoDaSerie(pontos, 0, 'atual')).toBe('');
  });
});

describe('indiceDoPico', () => {
  it('aponta o maior dia DESTE período, ignorando o anterior', () => {
    const pontos = pontosDaLinha(ATUAL, ANTERIOR, 'faturamento');
    expect(indiceDoPico(pontos)).toBe(0);
  });

  it('é nulo sem movimento: um pico de zero não é pico', () => {
    const pontos = pontosDaLinha([dia('2026-09-01', '0.00', 0)], null, 'faturamento');
    expect(indiceDoPico(pontos)).toBeNull();
  });
});

describe('rotuloDaMedida', () => {
  it('faturamento em reais, pedidos em contagem com a palavra', () => {
    /*
     * O ESPAÇO DEPOIS DO "R$" É UM NBSP (U+00A0), e é o `Intl` que o põe ali.
     * Escrever um espaço comum aqui faz o teste falhar com as duas strings
     * IDÊNTICAS na tela do terminal — meia hora procurando um defeito de
     * formatação que não existe.
     */
    expect(rotuloDaMedida('faturamento', 1240)).toBe('R$ 1.240,00');
    expect(rotuloDaMedida('pedidos', 1)).toBe('1 pedido');
    expect(rotuloDaMedida('pedidos', 23)).toBe('23 pedidos');
  });
});

/* ==========================================================================
 * O AGRUPAMENTO
 * ======================================================================= */

describe('agrupamentoDoPeriodo', () => {
  it('mantém o dia enquanto os pontos couberem na faixa', () => {
    expect(agrupamentoDoPeriodo(7)).toBe('dia');
    expect(agrupamentoDoPeriodo(30)).toBe('dia');
    expect(agrupamentoDoPeriodo(DIAS_ATE_AGRUPAR_POR_SEMANA)).toBe('dia');
  });

  it('passa para a semana quando o período é maior que o corte', () => {
    expect(agrupamentoDoPeriodo(DIAS_ATE_AGRUPAR_POR_SEMANA + 1)).toBe('semana');
    expect(agrupamentoDoPeriodo(90)).toBe('semana');
  });
});

describe('agruparPorSemana', () => {
  const noveDias = Array.from({ length: 9 }, (_, i) =>
    dia(`2026-09-${String(i + 1).padStart(2, '0')}`, '10.00', 2),
  );

  it('soma de sete em sete, rotulando pelo dia em que o balde começa', () => {
    const baldes = agruparPorSemana(noveDias);

    expect(baldes).toHaveLength(2);
    expect(baldes[0]).toEqual({ day: '2026-09-01', revenue_total: '70.00', orders_count: 14 });
  });

  /*
   * O ÚLTIMO BALDE PODE TER MENOS DE SETE DIAS, e isso é verdade e não defeito:
   * ele é a semana em curso. Completá-lo com zeros afirmaria que a loja fechou
   * nos dias que ainda não aconteceram.
   */
  it('deixa o último balde curto em vez de completá-lo com zeros', () => {
    const baldes = agruparPorSemana(noveDias);

    expect(baldes[1]).toEqual({ day: '2026-09-08', revenue_total: '20.00', orders_count: 4 });
  });

  /* Dinheiro é string no contrato; a soma tem de voltar a string com duas casas
     — senão `'70'` e `'70.00'` passam a discordar entre gráfico e tabela. */
  it('devolve o dinheiro somado como string de duas casas', () => {
    const baldes = agruparPorSemana([dia('2026-09-01', '0.10'), dia('2026-09-02', '0.20')]);

    expect(baldes[0]?.revenue_total).toBe('0.30');
  });

  it('não inventa balde a partir de série vazia', () => {
    expect(agruparPorSemana([])).toEqual([]);
  });
});

/* ==========================================================================
 * O EIXO
 * ======================================================================= */

describe('marcasDoEixo', () => {
  it('dá três marcas — teto, meio e chão — de cima para baixo', () => {
    const marcas = marcasDoEixo(1000, 'faturamento');

    expect(marcas).toHaveLength(3);
    expect(marcas.map((marca) => marca.y)).toEqual([0, 50, 100]);
    expect(marcas.map((marca) => marca.valor)).toEqual([1000, 500, 0]);
  });

  /* Uma régua de zero a zero mediria o nada, e desenhá-la faria a tela afirmar
     uma escala que não existe. */
  it('não desenha régua nenhuma sem teto', () => {
    expect(marcasDoEixo(0, 'faturamento')).toEqual([]);
  });
});

describe('rotuloCurto', () => {
  it('abrevia o milhar no eixo de dinheiro', () => {
    expect(rotuloCurto('faturamento', 1240)).toBe('1,2 mil');
  });

  it('escreve o valor inteiro abaixo do milhar', () => {
    expect(rotuloCurto('faturamento', 420)).toContain('420');
  });

  it('no eixo de pedidos é contagem redonda, sem "mil" e sem R$', () => {
    expect(rotuloCurto('pedidos', 23.4)).toBe('23');
  });
});

/* ==========================================================================
 * O BALÃO
 * ======================================================================= */

describe('diferencaDoPonto', () => {
  const pontos = pontosDaLinha(ATUAL, ANTERIOR, 'faturamento');

  it('diz a diferença em dinheiro, não em percentual', () => {
    const diferenca = diferencaDoPonto(pontos[1]!, 'faturamento');

    expect(diferenca?.texto).toContain('1.391,00');
    expect(diferenca?.texto).not.toContain('%');
    expect(diferenca?.direcao).toBe('down');
  });

  it('sem par no período anterior não há diferença a mostrar', () => {
    const semPar = pontosDaLinha(ATUAL, null, 'faturamento');

    expect(diferencaDoPonto(semPar[0]!, 'faturamento')).toBeNull();
  });

  it('diferença zero é dita como igualdade, sem seta', () => {
    const diferenca = diferencaDoPonto(pontos[0]!, 'faturamento');

    expect(diferenca?.direcao).toBe('none');
    expect(diferenca?.texto).toContain('igual');
  });

  it('em pedidos a diferença é contagem', () => {
    const emPedidos = pontosDaLinha(ATUAL, ANTERIOR, 'pedidos');

    expect(diferencaDoPonto(emPedidos[1]!, 'pedidos')?.texto).toBe(
      '−22 pedidos vs. o período anterior',
    );
  });
});
