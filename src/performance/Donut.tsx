import { arcosDoDonut, DONUT_RAIO, type FatiaDaComposicao } from './composition-model';

/**
 * ============================================================================
 * A ROSCA DA COMPOSIÇÃO — três fatias, nenhuma cor
 * ============================================================================
 *
 * ELA DESENHA O BRUTO DIVIDIDO EM PRODUTOS, TAXA DE ENTREGA E TAXA DE SERVIÇO,
 * e é a única forma circular da tela. A pergunta que ela responde é de PARTE
 * SOBRE TODO ("quanto do que entrou é comida, quanto é frete"), que é
 * exatamente o caso em que a rosca ganha da barra: a soma fechar em 100% é a
 * informação, e o anel a mostra sem ter de ser lida.
 *
 * COM TRÊS FATIAS, E NÃO COM DEZ. Rosca com muitas fatias é o gráfico mais
 * criticado que existe, e com razão: ninguém compara ângulos parecidos. Aqui
 * são três no máximo, e elas nunca são parecidas — produtos costuma ser 75–90%.
 *
 * ============================================================================
 * A ESCALA DE TINTA, E POR QUE ELA NÃO É UMA PALETA
 * ============================================================================
 *
 * As fatias saem de `--ink`, `--ink-2` e `--ink-3` — a MESMA escada de tinta
 * que a tipografia do painel usa, na ordem do tamanho. Não há matiz nova, não
 * há "cor por série", e é decisão: pintar cada fatia de uma cor diferente
 * obrigaria a inventar uma paleta categórica, que é o que faz um painel parecer
 * um template de biblioteca. Aqui a informação é o TAMANHO do arco; a tinta só
 * separa um arco do vizinho.
 *
 * Os três tons já são medidos contra `--surface-raised` nos dois temas por
 * `check-contrast.mjs`.
 *
 * NADA EXISTE SÓ NO DESENHO. O anel é `aria-hidden`: cada fatia tem valor e
 * percentual escritos na lista ao lado, que é a leitura de verdade. Uma rosca
 * sem os números seria um enfeite.
 */
export function Donut({ fatias }: { fatias: readonly FatiaDaComposicao[] }) {
  const arcos = arcosDoDonut(fatias);
  if (arcos.length === 0) return null;

  return (
    <svg className="rosca" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {/*
        O GIRO DE -90° PÕE A PRIMEIRA FATIA ÀS 12 HORAS. Sem ele o arco começa
        às 3 horas, que é onde o SVG ancora o zero de um círculo — e a lista ao
        lado, que está na mesma ordem, deixaria de bater com o desenho.
      */}
      <g transform="rotate(-90 50 50)">
        {arcos.map((arco, index) => (
          <circle
            className={`rosca__arco rosca__arco--${Math.min(index, 2)}`}
            key={arco.id}
            cx="50"
            cy="50"
            r={DONUT_RAIO}
            strokeDasharray={arco.dash}
            strokeDashoffset={arco.offset}
          />
        ))}
      </g>
    </svg>
  );
}
