import type { CSSProperties } from 'react';

import { formatCurrency } from '../orders/format';
import { barRatio, dayFullLabel, dayLabel, maxRevenue, toNumberOrZero } from './report-model';
import type { SalesByDayItem } from '../api/types';

/**
 * ============================================================================
 * FATURAMENTO DIA A DIA — coluna, série única, marca neutra
 * ============================================================================
 *
 * POR QUE COLUNA E NÃO LINHA: a pergunta é "quanto entrou em cada dia", que é
 * magnitude por categoria discreta — cada dia é um balde fechado, não um ponto
 * de uma medida contínua. Linha sugere interpolação entre terça e quarta, e
 * não existe meia-quarta.
 *
 * POR QUE NÃO TEM LEGENDA: é UMA série. Uma caixinha com um quadrado só
 * repetiria o título da seção e gastaria a largura que as colunas usam.
 *
 * POR QUE A COLUNA É NEUTRA (`--ink-2`) E NÃO A BRASA: a brasa aparece em três
 * lugares no sistema — botão primário, indicador de item ativo e anel de foco
 * — e barra de gráfico não é nenhum dos três (§4 da skill de design). A cor
 * aqui não carregaria informação nenhuma: quem diz o valor é a ALTURA. Um
 * gráfico laranja seria decoração, e decoração é o que a regra de avareza
 * proíbe.
 *
 * O DIA SEM VENDA TEM ALTURA ZERO, não um mínimo "para aparecer" — ver
 * `barRatio`. Um dia fechado é uma informação, e desenhá-lo com dois pixels
 * diria que vendeu pouco, que é outra coisa.
 *
 * ACESSIBILIDADE: o desenho é `role="img"` com um resumo, e os números todos
 * estão na tabela abaixo — visualmente escondida, presente para o leitor de
 * tela e para quem navega por teclado. Nenhum dado só existe no hover.
 */
export function DayChart({ days }: { days: readonly SalesByDayItem[] }) {
  /*
   * A saída vem ANTES das contas, e não é só arrumação: `days[0]` num período
   * vazio é `undefined`, e o resumo do `aria-label` sairia com "undefined" no
   * lugar da data. O contrato devolve todos os dias do período, inclusive os
   * sem venda — mas um período vazio ainda é possível, e o `noUncheckedIndexedAccess`
   * do projeto cobra a conferência.
   */
  if (days.length === 0) {
    return <p className="muted grafico__vazio">Sem dias no período.</p>;
  }

  const primeiro = days[0];
  const ultimo = days[days.length - 1];
  if (!primeiro || !ultimo) {
    return <p className="muted grafico__vazio">Sem dias no período.</p>;
  }

  const max = maxRevenue(days);

  /*
   * Com 30 colunas, um rótulo por dia vira uma parede de texto ilegível — e a
   * régua de acabamento reprova texto cortado. Rotula-se o primeiro, o último
   * e, quando cabem poucos, todos. O resto sai no hover e na tabela.
   */
  const rotulaTodos = days.length <= 10;

  /* O dia de maior faturamento leva rótulo direto: é o extremo, e é o que a
     pessoa procura no gráfico antes de qualquer outra coisa. */
  const indiceDoPico = days.reduce(
    (melhor, day, index) =>
      toNumberOrZero(day.revenue_total) > toNumberOrZero(days[melhor]?.revenue_total ?? '0')
        ? index
        : melhor,
    0,
  );
  const pico = days[indiceDoPico] ?? primeiro;

  return (
    <figure className="grafico">
      <div
        className="grafico__plot"
        role="img"
        aria-label={`Faturamento por dia, de ${dayFullLabel(primeiro.day)} a ${dayFullLabel(
          ultimo.day,
        )}. O maior dia foi ${dayFullLabel(pico.day)}, com ${formatCurrency(pico.revenue_total)}.`}
      >
        {/*
          A RÉGUA DO TOPO NÃO LEVA VALOR ESCRITO, e isso é conserto de um
          defeito que só apareceu no print: ela marcava o teto da escala com
          "R$ 1.240,00" à direita, e o rótulo direto do dia de pico dizia
          exatamente o mesmo número duzentos pixels ao lado. O teto da escala É
          o faturamento do maior dia — são a mesma informação escrita duas
          vezes na mesma linha (§8).

          Fica a régua, que é o que dá a referência de altura, e o rótulo do
          pico, que diz o número E de qual dia ele é. Direct label antes de
          eixo, como manda a régua de gráfico.
        */}
        <span className="grafico__teto" aria-hidden="true" />

        <ol
          className="grafico__barras"
          /*
            Quantos dias a série tem, para a folha limitar a largura das
            faixas. Com sete dias soltos em 1190px, cada faixa ficava com 170px
            para uma coluna de 24 — e o gráfico lia como palitos espalhados, não
            como uma série. Ver `.grafico__barras` no CSS.
          */
          style={{ '--dias': days.length } as CSSProperties}
        >
          {days.map((day, index) => {
            const razao = barRatio(day.revenue_total, max);
            const pedidos = day.orders_count;
            const rotula = rotulaTodos || index === 0 || index === days.length - 1;

            return (
              <li
                className={`grafico__dia${index === indiceDoPico && max > 0 ? ' grafico__dia--pico' : ''}`}
                key={day.day}
              >
                <div className="grafico__coluna">
                  {index === indiceDoPico && max > 0 ? (
                    <span className="grafico__pico tnum">{formatCurrency(day.revenue_total)}</span>
                  ) : null}

                  {/*
                    A altura vai por propriedade CSS, e não por `height` inline:
                    é o valor que muda, e a folha continua dona da forma (o
                    canto arredondado só no topo, o quadrado na base).
                  */}
                  <span
                    className="grafico__barra"
                    style={{ '--h': `${razao * 100}%` } as CSSProperties}
                  />

                  {/* O balão do ponteiro. Nada existe só aqui: a tabela abaixo
                      tem os mesmos números. */}
                  <span className="grafico__balao" aria-hidden="true">
                    <span className="grafico__balao-dia">{dayFullLabel(day.day)}</span>
                    <span className="grafico__balao-valor tnum">
                      {formatCurrency(day.revenue_total)}
                    </span>
                    <span className="grafico__balao-pedidos">
                      {pedidos === 1 ? '1 pedido' : `${pedidos} pedidos`}
                    </span>
                  </span>
                </div>

                <span className="grafico__rotulo" aria-hidden="true">
                  {rotula ? dayLabel(day.day) : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/*
        A TABELA EQUIVALENTE. Ela não é enfeite de acessibilidade: é o que
        garante que nenhum número do gráfico dependa de um ponteiro para ser
        lido — quem usa teclado, leitor de tela ou celular chega aos mesmos
        valores.
      */}
      <table className="sr-only">
        <caption>Faturamento e pedidos por dia</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Faturamento</th>
            <th scope="col">Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{dayFullLabel(day.day)}</th>
              <td>{formatCurrency(day.revenue_total)}</td>
              <td>{day.orders_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
