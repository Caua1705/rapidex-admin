/**
 * QUANTOS ITENS IMPRIMEM EM CADA SETOR — E QUANTOS NÃO IMPRIMEM EM NENHUM.
 *
 * Esta é a pergunta que o lojista precisa responder ANTES do sábado à noite, e
 * não durante: item sem setor não sai na comanda de produção. Hoje ele só
 * descobre isso quando a cozinha não recebe o pedido, com o salão cheio.
 *
 * O NÚMERO NÃO VEM DE GRAÇA, e vale saber por quê: `PrintingSectorResponse`
 * não traz contagem, e `GET /admin/products` não filtra por
 * `printing_sector_id` — não existe rota que responda "quantos itens tem o
 * setor Chapa". O que existe é a listagem paginada com o campo em cada item,
 * então a contagem é feita aqui, sobre os produtos lidos.
 *
 * `null` em `printing_sector_id` NÃO é o mesmo que "esquecido": ele é como o
 * lojista desliga a impressão de um item (§ "null que é escolha" da skill de
 * API). Por isso o resultado separa os dois casos que o painel PODE
 * distinguir — item sem setor e item apontando para um setor que não é desta
 * filial — em vez de somar tudo num alarme só.
 */
import type { PrintSector, Product } from '../api/types';

export type SectorCoverage = {
  /** Quantos itens apontam para cada setor, por id. */
  countBySectorId: Readonly<Record<string, number>>;
  /**
   * Itens com `printing_sector_id` nulo: não sai comanda de produção deles.
   * É uma escolha legítima (bebida de balcão, por exemplo) — o painel conta e
   * deixa o lojista julgar, sem chamar de erro.
   */
  withoutSector: number;
  /**
   * Itens apontando para um setor que não está na lista DESTA filial: setor de
   * outra loja, ou setor apagado. Esse sim é inconsistência — o agente joga a
   * via na impressora de resgate e o item quase não é notado.
   */
  strangeSector: number;
  /** Total de itens considerados. É contra ele que os outros números fecham. */
  total: number;
};

export function coverageOf(
  products: readonly Product[],
  sectors: readonly PrintSector[],
): SectorCoverage {
  const known = new Set(sectors.map((sector) => sector.id));
  const countBySectorId: Record<string, number> = {};
  let withoutSector = 0;
  let strangeSector = 0;

  products.forEach((product) => {
    const sectorId = product.printing_sector_id ?? null;
    if (sectorId === null) {
      withoutSector += 1;
      return;
    }
    if (!known.has(sectorId)) {
      strangeSector += 1;
      return;
    }
    countBySectorId[sectorId] = (countBySectorId[sectorId] ?? 0) + 1;
  });

  return { countBySectorId, withoutSector, strangeSector, total: products.length };
}

/**
 * "3 itens" / "1 item" / "nenhum item".
 *
 * Zero vira palavra e não algarismo porque a linha do setor é lida de bate
 * pronto: num "0" a diferença para um "8" é um traço, e o setor vazio é
 * justamente o que se procura nesta lista.
 */
export function formatItemCount(count: number): string {
  if (count === 0) return 'nenhum item';
  return count === 1 ? '1 item' : `${count} itens`;
}
