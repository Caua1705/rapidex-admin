import type { Branch } from '../api/types';

/**
 * A FILIAL QUE REPRESENTA O RESTAURANTE: a principal (`is_main`) e, na falta
 * dela, a primeira que o lojista enxerga.
 *
 * Este critério nasceu para o rótulo do topo (abaixo), mas ele não é sobre
 * rótulo: é a resposta do painel para "qual filial, quando ninguém escolheu
 * uma". Por isso ele mora aqui sozinho e `auth/branch-scope.ts` o importa em
 * vez de reescrevê-lo — duas cópias divergiriam no dia em que o backend
 * passasse a mandar mais de uma `is_main`, e divergiriam em silêncio.
 */
export function mainBranch(branches: readonly Branch[]): Branch | null {
  return branches.find((branch) => branch.is_main) ?? branches[0] ?? null;
}

/**
 * Como o painel descobre o nome do estabelecimento.
 *
 * NENHUMA rota /admin devolve o nome do restaurante: nem o JWT, nem
 * /admin/auth/me (que só traz restaurant_id), nem /admin/settings. O que
 * existe com nome legível é a filial. Então usamos a filial principal
 * (is_main) e, na falta dela, a primeira que o lojista enxerga.
 *
 * Se o backend um dia expuser `restaurant_name` em /admin/auth/me, este
 * arquivo inteiro sai e o topo passa a ler o campo direto.
 */
export function restaurantLabelFromBranches(branches: Branch[]): string {
  const main = mainBranch(branches);
  if (!main) return '—';

  return main.display_name?.trim() || main.name;
}

/* ==========================================================================
 * A IDENTIFICAÇÃO DO ESTABELECIMENTO — o que o shell mostra embaixo da marca
 * ======================================================================= */

/**
 * Quem está sendo operado, com o que o contrato /admin tem.
 *
 * ----------------------------------------------------------------------------
 * O QUE FALTA, E É PEDIDO PARA O BACKEND
 * ----------------------------------------------------------------------------
 *
 * `restaurants.name` e `restaurants.logo_path` EXISTEM no banco (ver
 * `models/restaurant_model.py`), e `logo_url` já é servido — mas só na API
 * PÚBLICA da vitrine (`RestaurantPublicResponse`, `RestaurantInfoRestaurantResponse`).
 * Nenhuma das 53 rotas `/admin` devolve um nem outro, e o painel não tem como
 * chamar a pública: ela é indexada pelo `restaurant_slug`, e nem esse campo
 * chega aqui.
 *
 * Enquanto isso não muda, a identificação é DERIVADA da filial principal — o
 * mesmo critério que `restaurantLabelFromBranches` já usava para a Cozinha.
 *
 * ----------------------------------------------------------------------------
 * A IMPRECISÃO QUE ISSO DEIXA, E POR QUE ELA NÃO VOLTA A SER O BUG ANTIGO
 * ----------------------------------------------------------------------------
 *
 * O rótulo é o nome PÚBLICO DA LOJA PRINCIPAL — numa rede, tipicamente algo
 * como "Pizzaria do Zé — Aldeota". Ele carrega um nome de filial dentro, e é
 * exatamente por isso que ele já foi removido do CABEÇALHO uma vez: ali, logo
 * acima de "Todas as filiais (2)", ele lia como "a filial que você está vendo"
 * e contradizia o seletor (ver o comentário de `layout/branch-heading.ts`).
 *
 * Duas coisas impedem a volta daquele defeito:
 *
 *   - **o lugar.** A identificação vive na LATERAL, embaixo da marca do
 *     Rapidex, longe do seletor. Ela responde "que cliente eu estou
 *     administrando"; o seletor responde "que loja esta tela está mostrando".
 *     São perguntas diferentes, em lugares diferentes.
 *   - **a segunda linha.** Com mais de uma loja no alcance, ela conta quantas
 *     são ("Fortaleza · 2 lojas"), e é isso que faz o bloco ler como o
 *     conjunto e não como uma das lojas.
 *
 * `branchCount` é quantas filiais ESTE lojista enxerga — o mesmo número que o
 * seletor escreve em "Todas as filiais (N)", e pelo mesmo motivo: é o que o
 * token alcança. Ele só é dito quando é maior que um; para quem está preso a
 * uma filial, afirmar "1 loja" seria afirmar algo sobre o restaurante que o
 * painel não sabe.
 */
export type Establishment = {
  /**
   * A MARCA — o que vem antes do travessão no nome público da loja principal.
   *
   * `display_name` de rede é "Marca — Bairro" ("Pizzaria do Zé — Aldeota"), e
   * mostrar isso inteiro aqui teria dois defeitos ao mesmo tempo: carregaria um
   * nome de FILIAL para dentro do bloco que identifica o restaurante (é essa
   * metade que contradizia o seletor no cabeçalho, e o motivo de o rótulo ter
   * saído de lá), e não caberia — 24 caracteres em 160px de lateral truncam em
   * "Pizzaria do Zé — Ald…", que é o pior dos dois mundos.
   *
   * Cortar no travessão é a mesma regra que as iniciais já usavam, e ela deixa
   * o bloco sem nome de filial nenhum. `fullLabel` guarda o texto inteiro para
   * o `title`, então nada se perde.
   */
  label: string;
  /** O `display_name` inteiro, como o backend o mandou. Vai no `title`. */
  fullLabel: string;
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
 * `null` quando ainda não há filial nenhuma — durante o carregamento da
 * sessão, por exemplo. O shell não desenha o bloco nesse caso: um travessão
 * piscando embaixo da marca lê como defeito, e a informação chega meio segundo
 * depois de qualquer jeito.
 */
export function establishmentFromBranches(branches: readonly Branch[]): Establishment | null {
  const main = mainBranch(branches);
  if (!main) return null;

  const fullLabel = main.display_name?.trim() || main.name;
  const label = brandPart(fullLabel);

  return {
    label,
    fullLabel,
    initials: initialsOf(label),
    city: sharedCity(branches),
    branchCount: branches.length,
  };
}

/**
 * A MARCA, antes do travessão.
 *
 * "Pizzaria do Zé — Aldeota" → "Pizzaria do Zé". O separador é o travessão
 * CERCADO DE ESPAÇO (— , – ou -), e nunca o hífen colado: "Pizza-Zé" é um nome,
 * não uma composição.
 *
 * Nome sem separador atravessa inteiro — é o caso do restaurante de uma loja
 * só, cujo `display_name` já é a marca.
 */
export function brandPart(label: string): string {
  const [marca] = label.split(/\s[—–-]\s/);
  return (marca ?? label).trim() || label.trim();
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
 * E ele para no TRAVESSÃO, quando há um: `display_name` de rede costuma ser
 * "Marca — Bairro", e as iniciais precisam ser da marca. Sem isso, duas lojas
 * do mesmo cliente teriam ladrilhos diferentes — e o ladrilho existe
 * justamente para ser a coisa estável na lateral.
 */
const CONECTORES = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na']);

export function initialsOf(label: string): string {
  const marca = brandPart(label);

  const palavras = marca
    .split(/\s+/)
    .map((palavra) => palavra.trim())
    .filter((palavra) => /^[\p{L}\p{N}]/u.test(palavra))
    .filter((palavra) => !CONECTORES.has(palavra.toLowerCase()));

  const escolhidas = palavras.length > 0 ? palavras : [marca.trim()];

  return escolhidas
    .slice(0, 2)
    .map((palavra) => palavra[0] ?? '')
    .join('')
    .toUpperCase();
}
