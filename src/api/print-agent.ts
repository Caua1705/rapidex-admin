/**
 * ============================================================================
 * O PROGRAMA DE IMPRESSÃO — a máquina do balcão, vista pelo painel
 * ============================================================================
 *
 * Arquivo próprio, separado de `print-sectors.ts`, porque são recursos de
 * naturezas diferentes na mesma tela: um SETOR é configuração que o lojista
 * escreve ("Chapa", "Bar"); o AGENTE é um programa que está rodando ou não no
 * computador da loja, e sobre o qual o painel só faz duas coisas — perguntar
 * como ele está e mandar uma ordem.
 *
 * AS DUAS DIREÇÕES DO CONTRATO, e o painel só usa uma delas:
 *
 *   agente → API   `POST /admin/print-agent/heartbeat` e `/printers`. São
 *                  fatos que a máquina conta sobre si, e a filial sai do TOKEN
 *                  do agente. O PAINEL NÃO CHAMA ESSAS DUAS — chamar seria o
 *                  painel se anunciando como se fosse a máquina.
 *   painel → API   as três daqui, todas com `{branch_id}` no path.
 *
 * POR QUE O TESTE NÃO TEM CANAL PRÓPRIO: o comando é gravado numa linha e
 * entregue pelo MESMO stream SSE que o agente já escuta para os pedidos. Não há
 * polling nem fila em memória — com mais de um worker, o comando criado num
 * nunca chegaria ao agente conectado no outro.
 */
import { apiClient, unwrap } from './client';
import type {
  PrintAgentPrinter,
  PrintAgentStatus,
  PrintTestRequest,
  PrintTestResult,
} from './types';

/**
 * Como está o programa daquela filial.
 *
 * `is_online` é o backend comparando o último sinal com uma janela de 90
 * segundos (o agente bate a cada 30) — a tela NÃO recalcula isso a partir de
 * `last_seen_at`: seriam duas respostas para a mesma pergunta, e a do navegador
 * dependeria do relógio da máquina de quem está olhando.
 *
 * Nunca 404. Filial sem agente instalado responde 200 com tudo nulo.
 */
export async function fetchPrintAgentStatus(branchId: string): Promise<PrintAgentStatus> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/print-agent', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

/**
 * As impressoras que o programa daquela máquina reportou, a padrão primeiro.
 *
 * É uma FOTO do que o Windows enxergava no último sinal, não um cadastro: o
 * agente substitui a lista inteira a cada relato, então impressora desinstalada
 * some daqui sozinha. Lista vazia tem dois significados que a tela precisa
 * separar — o agente nunca falou, ou ele falou e a máquina não tem nenhuma.
 *
 * Devolve só o array: `branch_id` na resposta é eco do que já foi pedido no
 * path, e carregá-lo até a tela seria um campo que ninguém lê.
 */
export async function listPrintAgentPrinters(branchId: string): Promise<PrintAgentPrinter[]> {
  const response = await unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/printers', {
      params: { path: { branch_id: branchId } },
    }),
  );
  return response.printers;
}

/**
 * Manda uma via de teste para a máquina daquela filial.
 *
 * RESPONDE 202, E A DIFERENÇA É A TELA INTEIRA DESTE BLOCO: o comando foi
 * ENFILEIRADO, não impresso. Quem põe no papel é o agente quando o stream
 * entregar, e se ele estiver desligado a via sai quando ele voltar — amanhã, se
 * for o caso. Por isso a resposta traz `agent_is_online`, e por isso quem chama
 * é obrigado a olhar esse campo antes de dizer "pronto" ao lojista.
 *
 * O corpo tem os dois campos opcionais e a resolução é do backend:
 * `printer_name` > a impressora do setor > a padrão do agente. Mandar o SETOR é
 * o caso comum ("testar a Cozinha"); mandar a IMPRESSORA direto é o que serve
 * para conferir uma máquina recém-instalada, antes de existir setor nenhum.
 */
export async function requestPrintTest(
  branchId: string,
  body: PrintTestRequest,
): Promise<PrintTestResult> {
  return unwrap(
    await apiClient.POST('/admin/branches/{branch_id}/print-test', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}
