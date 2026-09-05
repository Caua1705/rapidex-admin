import type { CSSProperties } from 'react';

/**
 * ============================================================================
 * A MINISSÉRIE DO CARTÃO DE MÉTRICA
 * ============================================================================
 *
 * Ela responde uma pergunta só, e é uma que o número e a variação não
 * respondem: **o período foi assim o tempo todo, ou foi um dia?** "R$ 3.169,50,
 * -6,8%" é o mesmo texto para uma semana estável e para uma semana morta com
 * um sábado enorme — e as duas pedem coisas opostas do lojista.
 *
 * ELA É `aria-hidden`, E ISSO NÃO É PREGUIÇA. Nenhum número existe só aqui: a
 * série inteira, dia a dia e nos dois períodos, está na tabela equivalente do
 * gráfico grande logo abaixo. Uma linha de 60px sem eixo, sem rótulo e sem
 * balão não tem valor exato para dar a um leitor de tela — o que ela tem é
 * FORMA, e forma se anuncia na descrição do gráfico grande, não em vinte
 * pontos lidos um a um.
 *
 * SEM EIXO, SEM RÓTULO E SEM COR PRÓPRIA. Ela é a marca neutra do sistema,
 * fina, encostada na base do cartão. Uma minissérie com eixo é um gráfico
 * pequeno; um gráfico pequeno dentro de um cartão que já tem um número de 28px
 * são dois gráficos disputando a mesma leitura.
 *
 * O ÚLTIMO PONTO GANHA UMA MARCA, e só ele: é onde a série está AGORA, e é o
 * ponto que o olho procura quando a linha é curta demais para ter forma. Ele é
 * um elemento de HTML por cima do SVG, e não um `<circle>` dentro dele — com
 * `preserveAspectRatio="none"` o quadro estica dez vezes mais na horizontal
 * que na vertical, e um círculo sairia ovo.
 */
export function Sparkline({ valores }: { valores: readonly number[] }) {
  /*
   * DOIS PONTOS SÃO O MÍNIMO PARA UMA LINHA. Com um só, `index / (n - 1)` é
   * uma divisão por zero e o `d` sai com `NaN` — que o SVG desenha como nada,
   * em silêncio. Melhor não desenhar de propósito do que não desenhar por
   * defeito.
   */
  if (valores.length < 2) return null;

  /*
   * A ESCALA VAI DE ZERO AO MAIOR, e não do menor ao maior.
   *
   * Comprimir entre mínimo e máximo é o truque que faz toda minissérie parecer
   * dramática: uma semana de R$ 400, 410 e 405 vira um zigue-zague de topo a
   * base. A pergunta que esta peça responde é "foi estável ou foi um dia?", e
   * ancorar no zero é o que a deixa responder com honestidade.
   *
   * O piso é zero e não o menor valor porque nenhuma das três medidas do
   * cartão (dinheiro, contagem, ticket) fica negativa.
   */
  const teto = Math.max(...valores, 0);

  const ultimo = valores.length - 1;
  const pontos = valores.map((valor, index) => ({
    x: arredonda((index / ultimo) * 100),
    /* Série chapada (todos iguais, inclusive todos zero) fica na base: uma
       linha no meio do quadro sugeriria uma metade de alguma coisa. */
    y: arredonda(teto > 0 ? 100 - (valor / teto) * 100 : 100),
  }));

  const caminho = pontos
    .map((ponto, index) => `${index === 0 ? 'M' : 'L'}${ponto.x} ${ponto.y}`)
    .join(' ');

  const fim = pontos[ultimo];

  return (
    <span className="mini" aria-hidden="true">
      <svg className="mini__svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        {/*
          `vector-effect` É OBRIGATÓRIO AQUI, e não acabamento: com
          `preserveAspectRatio="none"` o SVG estica o eixo X umas dez vezes mais
          que o Y, e a espessura do traço estica junto — a linha sairia grossa
          nas subidas e fina nas retas.
        */}
        <path className="mini__linha" d={caminho} vectorEffect="non-scaling-stroke" />
      </svg>

      {fim ? (
        <span
          className="mini__fim"
          style={{ '--mini-x': `${fim.x}%`, '--mini-y': `${fim.y}%` } as CSSProperties}
        />
      ) : null}
    </span>
  );
}

function arredonda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
