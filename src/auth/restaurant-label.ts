import type { Branch, RestaurantProfile } from '../api/types';

/**
 * A FILIAL QUE REPRESENTA O RESTAURANTE: a principal (`is_main`) e, na falta
 * dela, a primeira que o lojista enxerga.
 *
 * ELE NÃO DECIDE MAIS NOME NENHUM. Este critério nasceu para o rótulo do topo,
 * quando a identificação do estabelecimento era derivada da filial; hoje o nome
 * vem de `GET /admin/restaurant` (abaixo) e o critério sobrou para o que ele
 * sempre foi de verdade: a resposta do painel para "qual filial, quando ninguém
 * escolheu uma". Quem o usa é `auth/branch-scope.ts`, que o importa em vez de
 * reescrevê-lo — duas cópias divergiriam no dia em que o backend passasse a
 * mandar mais de uma `is_main`, e divergiriam em silêncio.
 */
export function mainBranch(branches: readonly Branch[]): Branch | null {
  return branches.find((branch) => branch.is_main) ?? branches[0] ?? null;
}

/**
 * O nome do estabelecimento, como o backend o guarda.
 *
 * ELE VEM DE `GET /admin/restaurant` (`restaurants.name`), e não mais da filial
 * principal. Até a revisão `20260823_0034` do backend nenhuma das rotas
 * `/admin` devolvia `restaurants.name`: o JWT não trazia, `/admin/auth/me` só
 * tinha `restaurant_id`, `/admin/settings` era `restaurant_settings`. O único
 * texto legível ao alcance do painel era o nome da FILIAL, e a identificação
 * era derivada dele.
 *
 * `/admin/restaurant` acabou com a derivação: `restaurants` é a MARCA — outra
 * tabela, outro dono, filial nenhuma herda (ver o comentário de
 * `api/store.ts`). É o nome certo, dito pelo backend, e não uma inferência que
 * acerta na maioria dos casos.
 *
 * `null` é o perfil que ainda não chegou (a sessão está carregando) ou a
 * leitura que falhou. Não há queda para a filial: voltar a derivar seria
 * reintroduzir, no pior momento, exatamente a imprecisão que esta troca
 * removeu.
 */
export function restaurantLabelOf(restaurant: RestaurantProfile | null): string {
  return restaurant?.name.trim() || '—';
}

/* ==========================================================================
 * A IDENTIFICAÇÃO DO ESTABELECIMENTO — o que o shell mostra embaixo da marca
 * ======================================================================= */

/**
 * Quem está sendo operado.
 *
 * ----------------------------------------------------------------------------
 * O NOME É DITO, NÃO DERIVADO — e é isso que mudou
 * ----------------------------------------------------------------------------
 *
 * Antes, `label` era o nome público da LOJA PRINCIPAL cortado no travessão:
 * `display_name` de rede é "Marca — Bairro", e mostrar isso inteiro carregaria
 * um nome de filial para dentro do bloco que identifica o restaurante — a
 * metade que já tinha contradito o seletor uma vez, quando o rótulo morava no
 * CABEÇALHO e lia "Matriz" logo acima de "Todas as filiais (2)" (ver
 * `layout/branch-heading.ts`).
 *
 * Com `restaurants.name` não há travessão a cortar nem bairro a esconder: o
 * campo já é a marca. O corte saiu junto com a derivação, e com ele o
 * `fullLabel` que existia só para o `title` guardar o que o corte tirava.
 *
 * ----------------------------------------------------------------------------
 * O QUE AINDA FALTA, E É PEDIDO PARA O BACKEND
 * ----------------------------------------------------------------------------
 *
 * `restaurants.logo_path` existe no banco e `logo_url` já é servido — mas só na
 * API PÚBLICA da vitrine (`RestaurantPublicResponse`), que é indexada pelo
 * `restaurant_slug`. `GET /admin/restaurant` devolve o `slug`, então o caminho
 * deixou de ser impossível; enquanto a logo não sair em `/admin`, o ladrilho
 * leva as INICIAIS.
 *
 * ----------------------------------------------------------------------------
 * A SEGUNDA LINHA CONTINUA SENDO DAS FILIAIS
 * ----------------------------------------------------------------------------
 *
 * Cidade e contagem não estão em `restaurants`, e não deveriam estar: elas são
 * sobre o alcance DESTE lojista, não sobre a marca. `branchCount` é quantas
 * filiais este token enxerga — o mesmo número que o seletor escreve em "Todas
 * as filiais (N)". Ele só é dito quando é maior que um; para quem está preso a
 * uma filial, afirmar "1 loja" seria afirmar sobre o restaurante algo que o
 * painel não viu.
 */
export type Establishment = {
  /** O nome do restaurante, como `restaurants.name` o guarda. */
  label: string;
  /** Duas letras para o ladrilho, enquanto não há logo. */
  initials: string;
  /**
   * A cidade — e só quando ela vale para TODAS as filiais que o lojista
   * enxerga.
   *
   * Com lojas em cidades diferentes, escrever a da principal seria dizer que a
   * rede é de Fortaleza porque a matriz é. Aí a linha fica só com a contagem,
   * que continua verdadeira.
   */
  city: string;
  /** Quantas filiais este lojista enxerga. */
  branchCount: number;
};

/**
 * `null` enquanto o perfil não chegou — durante o carregamento da sessão, por
 * exemplo. O shell não desenha o bloco nesse caso: um travessão piscando
 * embaixo da marca lê como defeito, e o nome chega meio segundo depois de
 * qualquer jeito.
 *
 * As filiais entram só para a segunda linha, e por isso não seguram o bloco: um
 * restaurante conhecido com a lista de filiais ainda a caminho mostra o nome
 * sem o detalhe, que é o que ele sabe.
 */
export function establishmentOf(
  restaurant: RestaurantProfile | null,
  branches: readonly Branch[],
): Establishment | null {
  const label = restaurant?.name.trim();
  if (!label) return null;

  return {
    label,
    initials: initialsOf(label),
    city: sharedCity(branches),
    branchCount: branches.length,
  };
}

/**
 * A cidade que vale para TODAS as filiais que o lojista enxerga — ou nenhuma.
 *
 * A comparação ignora caixa e espaço de sobra porque as duas linhas são
 * digitadas à mão no cadastro de cada filial: "Fortaleza" e "fortaleza " são a
 * mesma cidade, e tratá-las como duas apagaria a linha sem motivo.
 */
function sharedCity(branches: readonly Branch[]): string {
  const primeira = branches[0]?.city?.trim() ?? '';
  if (!primeira) return '';

  const todasIguais = branches.every(
    (branch) => (branch.city?.trim() ?? '').toLowerCase() === primeira.toLowerCase(),
  );
  return todasIguais ? primeira : '';
}

/**
 * As duas letras do ladrilho — o lugar da logo, enquanto ela não vem.
 *
 * ELE PULA AS PALAVRAS QUE NÃO IDENTIFICAM. "Pizzaria do Zé" com as duas
 * primeiras palavras daria "PD", que não é sigla de nada; o que separa uma
 * marca da outra na lateral é "PZ". Por isso conectores e o que não começa com
 * letra ou dígito ficam de fora.
 *
 * ELE NÃO PARA MAIS NO TRAVESSÃO, e isso é consequência da troca de origem:
 * parar existia porque a entrada era `display_name` de filial ("Marca —
 * Bairro") e as iniciais precisavam ser da marca. A entrada agora É a marca, e
 * continuar cortando só teria um efeito — comer a segunda metade de um
 * `restaurants.name` que legitimamente tenha um travessão dentro.
 */
const CONECTORES = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na']);

export function initialsOf(label: string): string {
  const palavras = label
    .split(/\s+/)
    .map((palavra) => palavra.trim())
    .filter((palavra) => /^[\p{L}\p{N}]/u.test(palavra))
    .filter((palavra) => !CONECTORES.has(palavra.toLowerCase()));

  const escolhidas = palavras.length > 0 ? palavras : [label.trim()];

  return escolhidas
    .slice(0, 2)
    .map((palavra) => palavra[0] ?? '')
    .join('')
    .toUpperCase();
}
