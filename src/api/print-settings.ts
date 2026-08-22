/**
 * ============================================================================
 * COMO A COMANDA SAI — o rodapé e as vias de uma filial
 * ============================================================================
 *
 * Arquivo próprio, ao lado de `print-sectors.ts` e `print-agent.ts`, porque é
 * um terceiro recurso na mesma tela e de natureza diferente dos dois: o SETOR é
 * uma linha que o lojista cria, o AGENTE é um programa que está rodando ou não
 * naquela máquina, e isto aqui é como o PAPEL sai — o que vem impresso e
 * quantas folhas.
 *
 * A LEITURA É DE QUEM OPERA E A ESCRITA É DA GERÊNCIA (`PESSOAS` contra
 * `GERENCIA` no mapa de papéis), e a assimetria é proposital: quem está em pé
 * ao lado da impressora é quem pergunta "por que saíram duas vias?". A tela
 * mostra a resposta para os dois e o controle só para um.
 */
import { apiClient, unwrap } from './client';
import type { BranchPrintSettings, BranchPrintSettingsUpdate } from './types';

/** O que está gravado nesta filial, mais o rodapé já resolvido com a marca. */
export async function fetchPrintSettings(branchId: string): Promise<BranchPrintSettings> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/print-settings', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

/**
 * Grava o que mudou.
 *
 * EDIÇÃO PARCIAL DE VERDADE: o que não vier no corpo não é tocado, e é por isso
 * que quem monta o corpo (`print-sectors/print-settings.ts`) omite o campo que
 * não mudou em vez de reenviá-lo. `receipt_footer_message: null` NÃO é "não
 * mexe" — é o pedido explícito de voltar a herdar a mensagem do restaurante.
 *
 * O BACKEND NORMALIZA O TEXTO NA GRAVAÇÃO (tira caractere de controle, `\t`
 * vira espaço, linha em branco repetida colapsa), então o que volta pode não
 * ser byte a byte o que foi enviado. Quem chama REPINTA o campo com a resposta:
 * mostrar o que foi digitado, enquanto a bobina imprime outra coisa, é o tipo
 * de divergência que ninguém descobre até o papel sair.
 */
export async function updatePrintSettings(
  branchId: string,
  body: BranchPrintSettingsUpdate,
): Promise<BranchPrintSettings> {
  return unwrap(
    await apiClient.PATCH('/admin/branches/{branch_id}/print-settings', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}
