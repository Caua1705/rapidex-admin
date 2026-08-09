/**
 * As regras dos setores de impressão, sem React e sem rede.
 *
 * O QUE É UM SETOR: o lugar físico onde o pedido sai impresso — chapa, bar,
 * sobremesa. Cada produto imprime em um setor, ou em nenhum ("Não imprimir",
 * que é o caso de item que não passa pela produção).
 *
 * A ARMADILHA QUE ESTE ARQUIVO EXISTE PARA EVITAR: setor é POR FILIAL, mas
 * produto é DO RESTAURANTE. O mesmo item aparece nas duas lojas, e o "Chapa" da
 * Aldeota é outra linha de banco que o "Chapa" da Zona Norte. Por isso um
 * `print_sector_id` gravado no produto só faz sentido junto da filial que está
 * aberta na tela — e `sectorLabelFor` devolve um aviso, e não um nome, quando o
 * id aponta para setor que não é desta filial.
 */
import type { PrintSector } from '../api/types';

/** O texto de "não imprime", igual em toda tela que mostra setor. */
export const NO_SECTOR_LABEL = 'Não imprimir';

/** Ordem de exibição: `sort_order` e, no empate, o nome. */
export function sortSectors(sectors: readonly PrintSector[]): PrintSector[] {
  return [...sectors].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

/**
 * Só os ativos — é o que se pode ESCOLHER num produto.
 *
 * A lista de administração mostra todos, inclusive os desligados; a de escolha,
 * não. Oferecer um setor desativado seria mandar o pedido para uma impressora
 * que o lojista acabou de tirar do ar.
 */
export function activeSectors(sectors: readonly PrintSector[]): PrintSector[] {
  return sortSectors(sectors).filter((sector) => sector.is_active);
}

/**
 * O que mostrar na coluna "Setor" de um produto.
 *
 * Três respostas possíveis, e as três importam:
 *   - o nome do setor, quando o id casa com um setor desta filial;
 *   - "Não imprimir", quando não há id — que é uma configuração válida;
 *   - um aviso, quando há id e ele NÃO está na lista. Isso acontece de verdade:
 *     o produto foi configurado com o setor de OUTRA filial, ou com um setor
 *     que foi apagado. Mostrar "Não imprimir" nesse caso seria mentir — o
 *     produto tem setor, só não um que esta filial conheça.
 */
export function sectorLabelFor(
  printSectorId: string | null | undefined,
  sectors: readonly PrintSector[],
): { label: string; known: boolean; empty: boolean } {
  if (!printSectorId) return { label: NO_SECTOR_LABEL, known: true, empty: true };

  const found = sectors.find((sector) => sector.id === printSectorId);
  if (!found) return { label: 'Setor de outra filial', known: false, empty: false };

  // O nome do setor desativado ainda aparece: o produto continua apontando para
  // ele, e esconder isso faria o lojista achar que o item não imprime.
  return {
    label: found.is_active ? found.name : `${found.name} (desativado)`,
    known: true,
    empty: false,
  };
}

export type SectorNameCheck = { valid: true; name: string } | { valid: false; message: string };

/**
 * O nome do setor.
 *
 * Nome repetido é recusado aqui, e não só no backend, porque duas linhas
 * "Chapa" na lista deixam o lojista sem saber qual escolher no produto — e o
 * erro só apareceria depois, num pedido impresso no lugar errado.
 */
export function checkSectorName(
  raw: string,
  existing: readonly PrintSector[],
  { ignoreId }: { ignoreId?: string } = {},
): SectorNameCheck {
  const name = raw.trim();

  if (name === '') return { valid: false, message: 'Dê um nome ao setor.' };
  if (name.length > 60) return { valid: false, message: 'O nome passa de 60 caracteres.' };

  const clash = existing.some(
    (sector) =>
      sector.id !== ignoreId &&
      sector.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
  );
  if (clash) return { valid: false, message: 'Já existe um setor com esse nome nesta filial.' };

  return { valid: true, name };
}

/** A próxima posição na lista, para o setor novo entrar no fim. */
export function nextSortOrder(sectors: readonly PrintSector[]): number {
  return sectors.reduce((highest, sector) => Math.max(highest, sector.sort_order), -1) + 1;
}
