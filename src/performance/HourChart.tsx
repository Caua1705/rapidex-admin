import type { CSSProperties } from 'react';

import { hourLabel, type BaldeDeHora } from './cancellation-hours';

/**
 * ============================================================================
 * OS CANCELAMENTOS NO RELÓGIO — coluna, contagem, marca neutra
 * ============================================================================
 *
 * ELE USA AS MESMAS CLASSES DO GRÁFICO DE DIAS (`.grafico__*`), e isso é
 * deliberado: a folha de estilo é a implementação compartilhada, e os dois
 * componentes são as duas leituras. Um `.horas__barra` com raio, altura e cor
 * próprios seria uma segunda gramática de gráfico no mesmo produto — e a
 * primeira vez que alguém ajustasse o raio da coluna, os dois desenhos
 * deixariam de combinar.
 *
 * O QUE MUDA EM RELAÇÃO AO DE DIAS, e por quê:
 *
 * - **A escala é CONTAGEM, não dinheiro.** A pergunta é "quantos", e um valor
 *   em reais aqui responderia outra coisa (o valor perdido já está escrito na
 *   frase da seção, uma vez — §8).
 * - **É mais baixo** (`--modificador de altura` no CSS): ele mora numa coluna
 *   de metade da grade, embaixo de uma frase e em cima de uma tabela. Com a
 *   altura do gráfico de dias, a seção sozinha passaria de uma dobra.
 * - **Nenhuma hora leva rótulo de valor**, nem a de pico: as barras são
 *   contagens de um dígito ou dois, e a FRASE acima já diz "8 de 14 entraram
 *   entre 19h e 21h". Repetir o 8 dentro da coluna seria a mesma informação
 *   duas vezes na mesma dobra.
 *
 * A FAIXA DESENHADA vai da primeira à última hora COM movimento, e as horas
 * vazias de dentro ficam — ver `lerHorasDeCancelamento`. É essa diferença que
 * separa "concentrado" de "espalhado", que é a pergunta inteira desta peça.
 */
export function HourChart({ horas, total }: { horas: readonly BaldeDeHora[]; total: number }) {
  const primeira = horas[0];
  const ultima = horas[horas.length - 1];
  if (!primeira || !ultima) return null;

  const maior = horas.reduce((max, balde) => Math.max(max, balde.count), 0);
  if (maior <= 0) return null;

  const indiceDoPico = horas.reduce(
    (melhor, balde, index) => (balde.count > (horas[melhor]?.count ?? 0) ? index : melhor),
    0,
  );
  const pico = horas[indiceDoPico] ?? primeira;

  /*
   * TODAS AS HORAS LEVAM RÓTULO ATÉ DOZE, e o limite é maior que o do gráfico
   * de dias de propósito: "20h" mede três caracteres contra os cinco de uma
   * data, então cabem mais rótulos na mesma faixa. Com o limite em oito, uma
   * série de nove horas rotulava só as pontas e o pico — e a barra das 19h
   * ficava sem nome, colada na das 20h, que é justamente o par que a leitura
   * precisa distinguir.
   */
  const rotulaTodos = horas.length <= 12;

  return (
    <figure className="grafico grafico--horas">
      <div
        className="grafico__plot"
        role="img"
        aria-label={`Pedidos que não viraram venda por hora de entrada, de ${hourLabel(
          primeira.hour,
        )} a ${hourLabel(ultima.hour)}. A hora com mais deles foi ${hourLabel(pico.hour)}, com ${
          pico.count === 1 ? '1 pedido' : `${pico.count} pedidos`
        } de ${total}.`}
      >
        <span className="grafico__teto" aria-hidden="true" />

        <ol className="grafico__barras" style={{ '--dias': horas.length } as CSSProperties}>
          {horas.map((balde, index) => (
            <li
              className={`grafico__dia${index === indiceDoPico ? ' grafico__dia--pico' : ''}`}
              key={balde.hour}
            >
              <div className="grafico__coluna">
                {/*
                  ALTURA ZERO PARA HORA SEM CANCELAMENTO, não um mínimo "para
                  aparecer". Uma hora limpa é uma informação, e desenhá-la com
                  dois pixels diria "cancelou pouco", que é outra coisa — a
                  mesma decisão de `barRatio` no gráfico de dias.
                */}
                <span
                  className="grafico__barra"
                  style={{ '--h': `${(balde.count / maior) * 100}%` } as CSSProperties}
                />

                <span className="grafico__balao" aria-hidden="true">
                  <span className="grafico__balao-dia">{hourLabel(balde.hour)}</span>
                  <span className="grafico__balao-pedidos">
                    {balde.count === 1 ? '1 pedido' : `${balde.count} pedidos`}
                  </span>
                </span>
              </div>

              <span className="grafico__rotulo" aria-hidden="true">
                {rotulaTodos || index === 0 || index === horas.length - 1 || index === indiceDoPico
                  ? hourLabel(balde.hour)
                  : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/*
        A TABELA EQUIVALENTE, como no gráfico de dias: nenhum número desta peça
        pode existir só no ponteiro. Quem usa teclado, leitor de tela ou celular
        chega aos mesmos valores.
      */}
      <table className="sr-only">
        <caption>Pedidos que não viraram venda, por hora de entrada</caption>
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {horas.map((balde) => (
            <tr key={balde.hour}>
              <th scope="row">{hourLabel(balde.hour)}</th>
              <td>{balde.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
