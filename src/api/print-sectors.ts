/**
 * Chamadas dos setores de impressão.
 *
 * Arquivo próprio, e não um pedaço de `store.ts` ou de `menu.ts`, porque os
 * setores são usados pelas DUAS telas: a aba Impressão de Loja os
 * administra, e o Cardápio os lê para dizer em qual setor cada produto imprime.
 *
 * A rota é `printing-sectors` (e o campo, `printing_sector_id`) — é o nome que
 * o contrato publica. `print-sectors`, que este arquivo usava antes de o
 * contrato sair, nunca existiu do lado do backend.
 */
import { apiClient, unwrap } from './client';
import type {
  PrintSector,
  PrintSectorCreate,
  PrintSectorUpdate,
  ProductPrintSector,
} from './types';

/**
 * Os setores de UMA filial.
 *
 * Traz também os desativados: a tela do lojista mostra o que está desligado —
 * desativar é o substituto de excluir, e o que some da tela ninguém reativa.
 */
export async function listPrintSectors(branchId: string): Promise<PrintSector[]> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/printing-sectors', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

export async function createPrintSector(
  branchId: string,
  body: PrintSectorCreate,
): Promise<PrintSector> {
  return unwrap(
    await apiClient.POST('/admin/branches/{branch_id}/printing-sectors', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}

/** Renomear e desativar passam pelo mesmo PATCH. Não existe DELETE. */
export async function updatePrintSector(
  sectorId: string,
  body: PrintSectorUpdate,
): Promise<PrintSector> {
  return unwrap(
    await apiClient.PATCH('/admin/printing-sectors/{sector_id}', {
      params: { path: { sector_id: sectorId } },
      body,
    }),
  );
}

/**
 * Aponta UM produto para um setor — ou desliga a impressão dele.
 *
 * Rota própria, e não um campo no PATCH do produto: `AdminProductUpdate` não
 * tem `printing_sector_id`. Faz sentido pelo mesmo motivo do esgotado — mandar
 * o produto inteiro só para trocar o setor reenviaria preço e nome velhos por
 * cima de uma edição feita em outra aba.
 *
 * `null` é escolha, não vazio: significa "não imprimir comanda deste item".
 */
export async function setProductPrintSector(
  productId: string,
  printSectorId: string | null,
): Promise<ProductPrintSector> {
  return unwrap(
    await apiClient.PATCH('/admin/products/{product_id}/printing-sector', {
      params: { path: { product_id: productId } },
      body: { printing_sector_id: printSectorId },
    }),
  );
}

/**
 * Aplica um setor a TODOS os produtos da categoria, de uma vez.
 *
 * Rota própria em vez de um PATCH por produto: uma categoria de 80 itens viraria
 * 80 requisições, e uma falha no meio deixaria metade do cardápio com um setor
 * e metade com outro — sem ninguém saber onde parou. Aqui é uma chamada, e o
 * backend responde quantos produtos mudaram.
 *
 * `null` limpa o setor da categoria inteira ("Não imprimir").
 */
export async function applyPrintSectorToCategory(
  categoryId: string,
  printSectorId: string | null,
): Promise<number> {
  const result = await unwrap(
    await apiClient.PATCH('/admin/categories/{category_id}/printing-sector', {
      params: { path: { category_id: categoryId } },
      body: { printing_sector_id: printSectorId },
    }),
  );
  return result.updated_products;
}
