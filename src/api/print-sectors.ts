/**
 * Chamadas dos setores de impressão.
 *
 * Arquivo próprio, e não um pedaço de `store.ts` ou de `menu.ts`, porque os
 * setores são usados pelas DUAS telas: a aba Impressão de Minha loja os
 * administra, e o Cardápio os lê para dizer em qual setor cada produto imprime.
 *
 * ATENÇÃO: estas rotas ainda NÃO existem no backend (2026-08-09). Ver o bloco 4
 * de `contract-pending.ts` — enquanto não subirem, cada chamada aqui volta 404
 * e a tela mostra o erro da API.
 */
import { apiClient, unwrap } from './client';
import type { PrintSector, PrintSectorCreate, PrintSectorUpdate } from './types';

/**
 * Os setores de UMA filial.
 *
 * Traz também os desativados: a tela do lojista mostra o que está desligado —
 * desativar é o substituto de excluir, e o que some da tela ninguém reativa.
 */
export async function listPrintSectors(branchId: string): Promise<PrintSector[]> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/print-sectors', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

export async function createPrintSector(
  branchId: string,
  body: PrintSectorCreate,
): Promise<PrintSector> {
  return unwrap(
    await apiClient.POST('/admin/branches/{branch_id}/print-sectors', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}

/** Renomear e desativar passam pelo mesmo PATCH. */
export async function updatePrintSector(
  sectorId: string,
  body: PrintSectorUpdate,
): Promise<PrintSector> {
  return unwrap(
    await apiClient.PATCH('/admin/print-sectors/{sector_id}', {
      params: { path: { sector_id: sectorId } },
      body,
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
    await apiClient.PATCH('/admin/categories/{category_id}/print-sector', {
      params: { path: { category_id: categoryId } },
      body: { print_sector_id: printSectorId },
    }),
  );
  return result.updated_count;
}
