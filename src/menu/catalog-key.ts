/**
 * ============================================================================
 * A CHAVE DE CATÁLOGO — o que ela é, e as três formas de errá-la em silêncio
 * ============================================================================
 *
 * Desde que o cardápio virou da filial, a picanha do Centro e a da Aldeota são
 * duas linhas independentes, com dois ids e dois preços. `catalog_key` é o
 * único fio que as liga, e ele responde UMA pergunta: *"quanto vendi de
 * picanha nas duas lojas?"*.
 *
 * ELA NÃO TEM SEMÂNTICA DE HERANÇA. Nada no cardápio, no pedido ou no Rapi lê
 * a chave para decidir preço, disponibilidade ou qualquer outra coisa. Parear
 * dois itens não sincroniza nada entre eles — muda uma linha do relatório.
 *
 * NÃO CONFUNDA COM `code`. Aquele é o código que o lojista imprime e busca no
 * painel: texto livre, sem unicidade, e entra no conteúdo indexado do Rapi. A
 * chave de catálogo o lojista nunca lê.
 *
 * ----------------------------------------------------------------------------
 * POR QUE ISTO É UM ARQUIVO, E NÃO TRÊS LINHAS DENTRO DO DIÁLOGO
 * ----------------------------------------------------------------------------
 *
 * As três regras abaixo compilam nas duas direções. Errar qualquer uma delas
 * produz um produto salvo, uma tela sem erro, e um relatório que conta a mesma
 * venda em duas linhas — descoberto no fim do mês, se for descoberto.
 *
 *   1. A CHAVE DO PAR É A DO GÊMEO, e quando ele não tem, é o ID DELE. Usar o
 *      id do produto que está sendo criado dá uma chave que não pareia com
 *      nada: o gêmeo continua com a dele (ou sem nenhuma), e os dois seguem
 *      contados separados.
 *   2. GÊMEO SEM CHAVE PRECISA RECEBER A CHAVE. Gravar a chave só do lado de
 *      cá é parear com ninguém — o agrupamento precisa dos dois lados. É o
 *      caso NORMAL depois do deploy: só os itens que a migração copiou nascem
 *      pareados; tudo o que o lojista cadastrou depois está sem chave.
 *   3. DESFAZER O PAR MANDA `null` EXPLÍCITO, não omite o campo. Omitir e
 *      mandar nulo teriam que significar coisas diferentes, e um corpo sem a
 *      chave não diz qual das duas o lojista quis — a mesma regra de
 *      `printing_sector_id`.
 */
import type { Branch, Product } from '../api/types';

/** O item de OUTRA loja que o lojista escolheu como par. */
export type CatalogTwin = {
  id: string;
  name: string;
  /** O nome da loja do gêmeo. Existe para a tela; não vai para o backend. */
  branchLabel: string;
  /** A chave que o gêmeo JÁ tem. `null` é o estado normal de item novo. */
  key: string | null;
};

export type CatalogPair = {
  /** A chave que vai no corpo do produto. */
  key: string;
  /**
   * O gêmeo escolhido AGORA. Nulo quando a chave veio do backend: o produto
   * tem chave, e o painel não tem como saber com quem ela pareia — não existe
   * filtro por `catalog_key` em `GET /admin/products`, e adivinhar o par pelo
   * nome erraria em todo item que o lojista renomeou de um lado só.
   */
  twin: CatalogTwin | null;
};

/**
 * O par a partir do item escolhido.
 *
 * A CHAVE É `twin.key ?? twin.id`, e o `id` do gêmeo não é um chute: é a mesma
 * convenção da migração, que carimbou o id do produto de ORIGEM no original e
 * na cópia. Ele é único no banco inteiro, então não colide dentro de nenhuma
 * das duas filiais — o que o `uq_products_branch_catalog_key` cobraria.
 */
export function pairWith(twin: CatalogTwin): CatalogPair {
  return { key: twin.key ?? twin.id, twin };
}

/**
 * O par de um produto que veio do backend: chave sem gêmeo conhecido.
 *
 * QUEM MONTA RASCUNHO DE EDIÇÃO PRECISA PASSAR POR AQUI. Um rascunho que
 * esquece a chave manda `catalog_key: null` no PATCH — e desfaz o pareamento
 * de um item porque alguém corrigiu o preço dele.
 */
export function pairFromProduct(product: Pick<Product, 'catalog_key'>): CatalogPair | null {
  return product.catalog_key ? { key: product.catalog_key, twin: null } : null;
}

/**
 * O que gravar no gêmeo ANTES de gravar o nosso — ou nulo, se não há o que
 * gravar.
 *
 * Só existe quando o gêmeo não tinha chave. Quem já tem não é tocado: mandar a
 * mesma chave de volta gastaria uma requisição para não mudar nada, e um PATCH
 * a mais numa linha de outra loja é um efeito que ninguém pediu.
 */
export function twinKeyToWrite(
  pair: CatalogPair | null,
): { productId: string; key: string } | null {
  if (!pair?.twin || pair.twin.key !== null) return null;
  return { productId: pair.twin.id, key: pair.key };
}

/**
 * O valor de `catalog_key` no corpo do produto.
 *
 * Sempre presente, e `null` quando não há par — ver a regra 3 no cabeçalho.
 */
export function catalogKeyBody(pair: CatalogPair | null): string | null {
  return pair?.key ?? null;
}

/**
 * Onde procurar um gêmeo: em todas as filiais MENOS a que está aberta.
 *
 * A própria filial fica de fora porque parear com ela é o único uso que o
 * backend recusa — duas linhas da mesma loja com a mesma chave fariam o
 * relatório contar a mesma venda duas vezes, e a resposta é 409. Repetir a
 * chave ENTRE lojas, ao contrário, é exatamente o uso.
 *
 * Filial inativa fica de fora junto: oferecer o item de uma loja que saiu do ar
 * é oferecer um pareamento que não vai aparecer em relatório nenhum.
 */
export function branchesToSearch(
  branches: readonly Branch[],
  currentBranchId: string,
): readonly Branch[] {
  return branches.filter((branch) => branch.id !== currentBranchId && branch.is_active !== false);
}

/**
 * A chave de catálogo só faz sentido com mais de uma loja.
 *
 * Com uma só não há o que agrupar: `/reports/products` já conta cada produto
 * numa linha, e o campo seria um controle que não distingue nada — a mesma
 * regra do "DISPONÍVEL" ao lado de um interruptor ligado.
 */
export function catalogPairingApplies(branches: readonly Branch[]): boolean {
  return branches.filter((branch) => branch.is_active !== false).length > 1;
}
