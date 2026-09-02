/**
 * O relato de erro do lojista.
 *
 * A rota existia e o painel nunca a chamou. Ela é a outra metade da borda de
 * erro (`erro/ErrorBoundary.tsx`): sem ela, uma exceção de render num sábado à
 * noite é uma tela branca, muda, e nada chega ao suporte; com ela, chega um
 * número de relato com o log da tela dentro. É a diferença entre depurar por
 * telefone e depurar por registro.
 *
 * O QUE NÃO VAI NO CORPO: restaurante, filial e usuário. Os três saem do token
 * no backend, e `extra="forbid"` recusa o corpo que os mandar. Credencial que
 * apareça no texto é mascarada lá antes de o registro existir, e o relato
 * inteiro é apagado em 90 dias — nada disso é responsabilidade desta função.
 *
 * `PESSOAS` (dono, gerente e atendente) segundo `papeis.ts`: quem opera é quem
 * vê o erro, e um relato que só o dono pudesse mandar chegaria no dia seguinte.
 */
import { apiClient, unwrap } from './client';
import type { CreateErrorReport, ErrorReport } from './types';

export async function createErrorReport(body: CreateErrorReport): Promise<ErrorReport> {
  return unwrap(await apiClient.POST('/admin/error-reports', { body }));
}
