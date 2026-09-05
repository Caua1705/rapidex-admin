import type { CSSProperties } from 'react';

import type { SalesByDayItem } from '../api/types';
import {
  areaDaSerieAtual,
  caminhoDaSerie,
  diferencaDoPonto,
  indiceDoPico,
  marcasDoEixo,
  pontosDaLinha,
  rotuloDaMedida,
  serieAgrupada,
  tetoDaEscala,
  type Agrupamento,
  type Medida,
} from './line-chart-model';
import { dayFullLabel, dayLabel } from './report-model';

/**
 * ============================================================================
 * O GRÁFICO PRINCIPAL — a série no tempo, com o período anterior atrás
 * ============================================================================
 *
 * É a peça que responde a pergunta que o cartão de faturamento não responde:
 * "eu vendi menos, mas vendi menos QUANDO?". E ela responde com duas séries,
 * porque uma série sozinha não tem contra o que ser lida — uma semana de
 * R$ 3.169 é ótima ou péssima conforme a semana anterior, e a comparação
 * estava na memória do painel (`byDayPrevious` já era carregado) sem nunca ter
 * chegado à tela.
 *
 * POR QUE LINHA, E NÃO COLUNA. O gráfico de colunas que morava aqui estava
 * certo para UMA série: cada dia é um balde fechado, e coluna é a marca da
 * magnitude por categoria discreta. Com DUAS séries a coluna quebra — ou elas
 * ficam lado a lado (sessenta colunas de 6px num mês) ou empilhadas (que somam
 * dois períodos, o que não significa nada). A linha compara duas séries no
 * mesmo eixo sem nenhuma das duas.
 *
 * ============================================================================
 * A GRAMÁTICA VISUAL, E POR QUE ELA NÃO TEM COR
 * ============================================================================
 *
 * - **este período**: traço cheio em `--ink` (a tinta do dado), com uma área
 *   sob ele em degradê que dissolve para o nada. A área não acrescenta
 *   informação — ela dá PESO, e é o que separa "a série que importa" da outra
 *   sem gastar uma matiz;
 * - **o período anterior**: tracejado em `--ink-3` (a tinta de apoio). O
 *   tracejado é o segundo canal, e é ele que a legenda desenha: com a cor
 *   sozinha, o gráfico ficaria ilegível em impressão e em daltonismo (WCAG
 *   1.4.1);
 * - **a brasa NÃO aparece aqui.** Ela tem um emprego no sistema — a ação
 *   primária — e uma série de faturamento não é uma ação. Um gráfico laranja
 *   seria decoração, e é a decoração que faz a tela parecer template.
 *
 * O EIXO Y TEM TRÊS MARCAS e nenhuma moldura: três fios horizontais finos
 * atravessando o quadro, sem caixa em volta e sem eixo X desenhado. A régua
 * serve para dizer "a linha está na metade"; quem dá o valor exato é o balão
 * do ponteiro e a tabela equivalente.
 *
 * NADA EXISTE SÓ NO PONTEIRO. O balão é conforto; a tabela `sr-only` abaixo
 * tem as três colunas (dia, este período, período anterior) e é ela que
 * responde por teclado, por leitor de tela e no toque.
 */
export function RevenueChart({
  dias,
  diasAnteriores,
  medida,
  onMedida,
  agrupamento,
  rotuloAnterior,
}: {
  dias: readonly SalesByDayItem[];
  /** Nulo quando a segunda chamada falhou — a linha tracejada não é desenhada. */
  diasAnteriores: readonly SalesByDayItem[] | null;
  medida: Medida;
  onMedida: (medida: Medida) => void;
  agrupamento: Agrupamento;
  rotuloAnterior: string;
}) {
  const serie = serieAgrupada(dias, agrupamento);
  const serieAnterior = diasAnteriores ? serieAgrupada(diasAnteriores, agrupamento) : null;

  const pontos = pontosDaLinha(serie, serieAnterior, medida);
  const teto = tetoDaEscala(pontos);
  const marcas = marcasDoEixo(teto, medida);
  const pico = indiceDoPico(pontos);

  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];

  /*
   * SEM TETO NÃO HÁ ESCALA, e o gráfico inteiro sai do ar — legenda e
   * segmentado junto. Desenhar mesmo assim é o defeito: a linha deitaria rente
   * ao chão, a régua marcaria de zero a zero, e o resultado leria como "vendeu
   * pouquíssimo" em vez de "não vendeu". A legenda seria pior ainda: ela
   * nomearia duas séries que não estão desenhadas.
   */
  const semEscala = teto <= 0 || pontos.length === 0 || !primeiro || !ultimo;

  const nomeDaMedida = medida === 'faturamento' ? 'Faturamento' : 'Pedidos';
  const nomeDoBalde = agrupamento === 'semana' ? 'semana' : 'dia';
  const legendaDaTabela = `${nomeDaMedida} por ${nomeDoBalde}, com o período anterior`;

  return (
    <figure className="linha">
      {semEscala ? (
        <p className="muted">
          Sem venda no período — a linha do faturamento dia a dia aparece aqui assim que houver.
        </p>
      ) : null}

      {semEscala ? null : (
        <div className="linha__topo">
          {/*
          A LEGENDA DESENHA O TRAÇO DE CADA SÉRIE, e não um quadradinho de cor.
          O que separa as duas na tela é a forma (cheio × tracejado) tanto
          quanto a tinta; uma legenda de quadradinhos ensinaria a ler pela cor,
          que é o canal que some na impressão.
        */}
          <p className="linha__legenda" data-testid="perf-grafico-legenda">
            <span className="linha__chave">
              <span className="linha__amostra linha__amostra--atual" aria-hidden="true" />
              este período
            </span>
            {serieAnterior ? (
              <span className="linha__chave">
                <span className="linha__amostra linha__amostra--anterior" aria-hidden="true" />
                {rotuloAnterior}
              </span>
            ) : null}
            {agrupamento === 'semana' ? (
              <span className="linha__chave linha__chave--nota">somado por semana</span>
            ) : null}
          </p>

          {/*
          A MESMA ROTA TRAZ AS DUAS MEDIDAS, e por isso a troca não custa
          requisição nenhuma: `sales-by-day` devolve faturamento E pedidos no
          mesmo item. Sem o segmentado, "vendi menos porque veio menos gente ou
          porque gastaram menos?" exigiria uma segunda tela.
        */}
          <div className="seg seg--sm" role="group" aria-label="O que a linha mede">
            <button
              type="button"
              className="seg__opt"
              aria-pressed={medida === 'faturamento'}
              onClick={() => onMedida('faturamento')}
              data-testid="perf-medida-faturamento"
            >
              Faturamento
            </button>
            <button
              type="button"
              className="seg__opt"
              aria-pressed={medida === 'pedidos'}
              onClick={() => onMedida('pedidos')}
              data-testid="perf-medida-pedidos"
            >
              Pedidos
            </button>
          </div>
        </div>
      )}

      {semEscala || !primeiro || !ultimo ? null : (
        <div
          className="linha__plot"
          role="img"
          aria-label={descricao(nomeDaMedida, primeiro.day, ultimo.day, pontos, pico, medida)}
        >
          {/*
            OS RÓTULOS DO EIXO SÃO HTML, não `<text>` de SVG. Com
            `preserveAspectRatio="none"` o quadro estica na horizontal, e um
            texto dentro dele sairia esticado junto. Em HTML eles também herdam
            a tipografia do sistema sem uma regra própria.
          */}
          <div className="linha__eixo" aria-hidden="true">
            {marcas.map((marca) => (
              <span
                className="linha__marca tnum"
                key={marca.y}
                style={{ '--y': `${marca.y}%` } as CSSProperties}
              >
                {marca.rotulo}
              </span>
            ))}
          </div>

          <div className="linha__quadro">
            <svg
              className="linha__svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                {/*
                  O DEGRADÊ É DEFINIDO NA FOLHA, e só a geometria fica aqui: as
                  paradas leem `--ink` por classe, então o tema escuro vem de
                  graça e o `check-design-tokens` continua valendo. Uma cor
                  escrita no atributo seria um literal no TSX, que o ESLint
                  barra — e com razão: ela não acompanharia o tema.
                */}
                <linearGradient id={GRADIENTE} x1="0" y1="0" x2="0" y2="1">
                  <stop className="linha__parada linha__parada--topo" offset="0%" />
                  <stop className="linha__parada linha__parada--base" offset="100%" />
                </linearGradient>
              </defs>

              {marcas.map((marca) => (
                <line
                  className="linha__grade"
                  key={marca.y}
                  x1="0"
                  x2="100"
                  y1={marca.y}
                  y2={marca.y}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/*
                A ÁREA VEM ANTES DAS LINHAS na ordem do documento, porque em SVG
                quem vem depois fica por cima: com a ordem trocada, o
                preenchimento cobriria o tracejado do período anterior nos
                trechos em que ele passa por baixo.
              */}
              <path className="linha__area" d={areaDaSerieAtual(pontos, teto)} />

              {serieAnterior ? (
                <path
                  className="linha__traco linha__traco--anterior"
                  d={caminhoDaSerie(pontos, teto, 'anterior')}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              <path
                className="linha__traco linha__traco--atual"
                d={caminhoDaSerie(pontos, teto, 'atual')}
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/*
              OS ALVOS DO PONTEIRO SÃO HTML POR CIMA DO SVG, e cada um é
              posicionado pelo X do ponto — não por uma coluna de largura igual.
              A diferença importa nas pontas: o primeiro ponto está em x=0 e o
              último em x=100, então colunas centradas em (i+0,5)/n errariam o
              alvo justamente onde a série começa e acaba.
            */}
            <div className="linha__alvos">
              {pontos.map((ponto, index) => {
                const y = teto > 0 ? 100 - (ponto.atual / teto) * 100 : 100;
                const x = pontos.length === 1 ? 50 : (index / (pontos.length - 1)) * 100;
                const diferenca = diferencaDoPonto(ponto, medida);

                return (
                  <span
                    className={`linha__alvo${index === pico ? ' linha__alvo--pico' : ''}`}
                    key={ponto.day}
                    style={
                      {
                        '--x': `${arredonda(x)}%`,
                        '--y': `${arredonda(y)}%`,
                        '--banda': `${arredonda(100 / Math.max(1, pontos.length))}%`,
                      } as CSSProperties
                    }
                  >
                    <span className="linha__ponto" aria-hidden="true" />

                    {/* O pico leva rótulo DIRETO, sem depender de ponteiro: é o
                        extremo, e é o que o olho procura antes de tudo. */}
                    {index === pico ? (
                      <span className="linha__pico tnum" aria-hidden="true">
                        {rotuloDaMedida(medida, ponto.atual)}
                      </span>
                    ) : null}

                    <span className="linha__balao" aria-hidden="true">
                      <span className="linha__balao-dia">
                        {agrupamento === 'semana'
                          ? `semana de ${dayLabel(ponto.day)}`
                          : dayFullLabel(ponto.day)}
                      </span>
                      <span className="linha__balao-valor tnum">
                        {rotuloDaMedida(medida, ponto.atual)}
                      </span>
                      {diferenca ? (
                        <span
                          className={`linha__balao-delta linha__balao-delta--${diferenca.direcao}`}
                        >
                          {diferenca.texto}
                        </span>
                      ) : null}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* As pontas do eixo X, escritas. Um rótulo por ponto vira parede de
              texto assim que o período passa de dez. */}
          <div className="linha__datas" aria-hidden="true">
            <span>{dayLabel(primeiro.day)}</span>
            <span>{dayLabel(ultimo.day)}</span>
          </div>
        </div>
      )}

      {/*
        A TABELA EQUIVALENTE, COM AS DUAS SÉRIES. Ela não é enfeite de
        acessibilidade: é o que garante que nenhum número dependa de um ponteiro
        para ser lido. A coluna do período anterior só existe quando a série
        existe — uma coluna de travessões afirmaria que o backend respondeu
        zero.
      */}
      {semEscala ? null : (
        <table className="sr-only">
          <caption>{legendaDaTabela}</caption>
          <thead>
            <tr>
              <th scope="col">{agrupamento === 'semana' ? 'Semana' : 'Dia'}</th>
              <th scope="col">Este período</th>
              {serieAnterior ? <th scope="col">Período anterior</th> : null}
            </tr>
          </thead>
          <tbody>
            {pontos.map((ponto) => (
              <tr key={ponto.day}>
                <th scope="row">{dayFullLabel(ponto.day)}</th>
                <td>{rotuloDaMedida(medida, ponto.atual)}</td>
                {serieAnterior ? (
                  <td>{ponto.anterior === null ? '—' : rotuloDaMedida(medida, ponto.anterior)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

/** O `id` do degradê. Há UM gráfico de linha por tela, então ele é constante. */
const GRADIENTE = 'perf-area-degrade';

function descricao(
  nomeDaMedida: string,
  primeiroDia: string,
  ultimoDia: string,
  pontos: readonly { day: string; atual: number }[],
  pico: number | null,
  medida: Medida,
): string {
  const abertura = `${nomeDaMedida} ao longo do tempo, de ${dayFullLabel(primeiroDia)} a ${dayFullLabel(ultimoDia)}.`;
  if (pico === null) return `${abertura} Não houve movimento no período.`;

  const ponto = pontos[pico];
  if (!ponto) return abertura;

  return `${abertura} O maior foi ${dayFullLabel(ponto.day)}, com ${rotuloDaMedida(medida, ponto.atual)}.`;
}

function arredonda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
