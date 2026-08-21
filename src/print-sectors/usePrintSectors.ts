import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { createPrintSector, listPrintSectors, updatePrintSector } from '../api/print-sectors';
import type { PrintSector } from '../api/types';
import { nextSortOrder, sortSectors } from './print-sectors';

/**
 * Os setores de impressão da filial aberta no cabeçalho.
 *
 * Compartilhado entre a aba Impressão (que os administra) e o Cardápio (que os
 * lê para o campo do produto e para a coluna da lista). Um hook só porque a
 * regra de qual filial vale é a mesma nas duas telas, e duas cópias divergiriam
 * assim que a aba criasse um setor.
 *
 * Filial vazia ("Todas as filiais") não carrega nada: setor é por filial, e não
 * existe lista a mostrar. Quem chama trata esse caso na tela.
 */
export function usePrintSectors(branchId: string) {
  const [sectors, setSectors] = useState<PrintSector[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  /** Ids com chamada em voo, para travar só a linha mexida. */
  const [pendingIds, setPendingIds] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!branchId) {
      setSectors([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const loaded = await listPrintSectors(branchId);
        if (!cancelled) setSectors(sortSectors(loaded));
      } catch (error) {
        if (!cancelled) setErrorMessage(messageFromUnknownError(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const markPending = useCallback((sectorId: string, pending: boolean) => {
    setPendingIds((current) =>
      pending ? [...current, sectorId] : current.filter((id) => id !== sectorId),
    );
  }, []);

  const create = useCallback(
    async (name: string): Promise<boolean> => {
      if (!branchId) return false;
      setIsCreating(true);
      setErrorMessage(null);
      try {
        const created = await createPrintSector(branchId, {
          name,
          is_active: true,
          sort_order: nextSortOrder(sectors),
        });
        setSectors((current) => sortSectors([...current, created]));
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [branchId, sectors],
  );

  const rename = useCallback(
    async (sectorId: string, name: string): Promise<boolean> => {
      markPending(sectorId, true);
      setErrorMessage(null);
      try {
        const updated = await updatePrintSector(sectorId, { name });
        setSectors((current) =>
          sortSectors(current.map((sector) => (sector.id === sectorId ? updated : sector))),
        );
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        markPending(sectorId, false);
      }
    },
    [markPending],
  );

  /**
   * Desativar, não excluir.
   *
   * Setor apagado deixaria produtos apontando para um id que não existe mais —
   * e a lista do cardápio mostraria "setor de outra filial" no cardápio inteiro.
   * Desativado, ele some das ESCOLHAS mas continua explicando o que o produto
   * tem gravado.
   */
  const setActive = useCallback(
    async (sectorId: string, isActive: boolean): Promise<boolean> => {
      markPending(sectorId, true);
      setErrorMessage(null);
      try {
        const updated = await updatePrintSector(sectorId, { is_active: isActive });
        setSectors((current) =>
          sortSectors(current.map((sector) => (sector.id === sectorId ? updated : sector))),
        );
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        markPending(sectorId, false);
      }
    },
    [markPending],
  );

  /**
   * A IMPRESSORA DAQUELE SETOR — e por que ela mora no painel agora.
   *
   * O agente resolve a impressora de cada via em duas fontes, nesta ordem: a
   * escolhida AQUI (`printer_name`, que viaja junto da via) e, na falta dela, o
   * mapa do `config.ini` da máquina.
   *
   * O painel vem primeiro porque o `config.ini` casa pelo NOME do setor —
   * renomear "Cozinha" para "Cozinha Quente" fazia a via deixar de casar, cair
   * na impressora padrão e a comanda da cozinha começar a sair no balcão, sem
   * erro nenhum em lugar nenhum. Com o id do setor carregando a escolha, o
   * rename deixou de quebrar a impressão.
   *
   * `null` NÃO É VAZIO: é "deixar o programa decidir", ou seja, voltar para o
   * `config.ini`. É um estado que o lojista escolhe, e é por isso que o seletor
   * tem uma opção para ele em vez de um campo em branco.
   */
  const setPrinter = useCallback(
    async (sectorId: string, printerName: string | null): Promise<boolean> => {
      markPending(sectorId, true);
      setErrorMessage(null);
      try {
        const updated = await updatePrintSector(sectorId, { printer_name: printerName });
        setSectors((current) =>
          sortSectors(current.map((sector) => (sector.id === sectorId ? updated : sector))),
        );
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        markPending(sectorId, false);
      }
    },
    [markPending],
  );

  return {
    sectors,
    isLoading,
    isCreating,
    pendingIds,
    errorMessage,
    create,
    rename,
    setActive,
    setPrinter,
  };
}
