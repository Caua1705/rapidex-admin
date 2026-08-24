import type { ReactNode } from 'react';

import './PageBar.css';

/**
 * A FAIXA DE 52px — o primeiro elemento de TODA tela do painel.
 *
 *   <PageBar title="Clientes">
 *     <SearchField … />
 *   </PageBar>
 *
 *   <PageBar title="Pedidos" aside={<Tabs … />} meta={<contadores />}>
 *     <OrdersFilters … />
 *   </PageBar>
 *
 * ELA NASCEU EM PEDIDOS E VIROU PRIMITIVO. O diagnóstico que abriu esta rodada
 * era desta tela: título, subtítulo explicando a tela, abas com régua própria e
 * um cartão branco de filtros com 130px de altura — o primeiro pedido começava
 * a ~500px do topo. A faixa resolveu isso ali, e no dia seguinte cada tela
 * tinha o seu cabeçalho com a sua altura, o seu respiro e o seu lugar para as
 * ferramentas. Um cabeçalho por tela é como seis telas passam a ler como seis
 * produtos.
 *
 * O QUE ELA GARANTE, IGUAL EM TODAS:
 *
 *   - o título nasce na MESMA horizontal, com a mesma altura (`--topbar-h`);
 *   - as ferramentas ficam à direita, na mesma linha, sem moldura;
 *   - o limite de baixo é um fio de 1px, nunca uma sombra;
 *   - ela GRUDA no topo enquanto o conteúdo rola.
 *
 * NÃO HÁ SUBTÍTULO EXPLICANDO A TELA. Quem abre "Clientes" sabe o que é a tela,
 * e a frase custava uma dobra por turno para explicar o óbvio uma vez. O que
 * existe é `crumb`, que é OUTRA coisa: o nome da seção aberta dentro da tela
 * ("Loja › Geral"), que é a continuação do título e não um segundo.
 *
 * ELA ENVOLVE quando aperta: com o painel de detalhe aberto, ou em qualquer
 * janela estreita, as ferramentas descem para uma segunda fileira alinhada à
 * direita. Duas fileiras de 34px continuam sendo um terço do que um cartão de
 * filtro custava, e a alternativa — espremer sete controles numa linha só — é a
 * barra amontoada que a direção anterior tinha.
 */
export function PageBar({
  title,
  crumb,
  aside,
  meta,
  children,
  sticky = true,
}: {
  title: string;
  /** O nome da seção aberta dentro da tela. Continuação do título, não título. */
  crumb?: string;
  /** O que vive COM o título: abas, etiqueta de estado. */
  aside?: ReactNode;
  /** O grupo do meio: contadores, resumo curto. */
  meta?: ReactNode;
  /** As ferramentas, alinhadas à direita. */
  children?: ReactNode;
  /**
   * A faixa gruda no topo por padrão. Telas cuja rolagem é da PÁGINA inteira
   * (e não de uma lista interna) passam `false`: grudar numa página que rola
   * por baixo do cabeçalho do shell empilharia duas barras coladas.
   */
  sticky?: boolean;
}) {
  return (
    <header className={`ds-pagebar${sticky ? ' ds-pagebar--gruda' : ''}`}>
      <div className="ds-pagebar__id">
        <h1 className="t-title ds-pagebar__titulo">{title}</h1>
        {crumb ? <span className="t-crumb ds-pagebar__crumb">{crumb}</span> : null}
        {aside}
      </div>

      {meta ? <div className="ds-pagebar__meta">{meta}</div> : null}
      {children ? <div className="ds-pagebar__tools">{children}</div> : null}
    </header>
  );
}
