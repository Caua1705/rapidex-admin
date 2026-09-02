import type { Branch } from '../api/types';
import { branchName } from '../layout/branch-heading';
import { avisoDeAgenteParado } from './print-agent';
import { useAgentesDasFiliais } from './useAgentesDasFiliais';

/**
 * ============================================================================
 * "NENHUMA COMANDA ESTÁ SAINDO" — a faixa de Pedidos e de Cozinha
 * ============================================================================
 *
 * UM COMPONENTE PARA AS DUAS TELAS, e não a mesma condição escrita duas vezes.
 * Pedidos e Cozinha são as duas telas que ficam abertas o turno inteiro, e é
 * nelas que o silêncio da impressora precisa virar frase. Duplicar a regra aqui
 * seria o defeito da barra de navegação de novo: uma das duas telas avisaria e
 * a outra não, e ninguém descobriria qual.
 *
 * AS FILIAIS SÃO AS QUE A TELA ESTÁ MOSTRANDO, não a filial resolvida.
 * `usePrepRange` e o controle de preparo resolvem uma filial porque MEDEM ou
 * ESCREVEM sobre uma loja; esta faixa não faz nem uma coisa nem outra — ela
 * conta um fato sobre cada máquina que deveria estar imprimindo os pedidos que
 * estão na tela. Com "todas as filiais" escolhidas, são todas: é justamente o
 * dono de três lojas, que trabalha com o quadro somado, quem não podia
 * descobrir sozinho que o computador de uma delas caiu.
 *
 * ELA É `role="alert"` de propósito. A faixa aparece sozinha, no meio do
 * expediente, sem ninguém ter clicado em nada — sem o papel, quem opera por
 * leitor de tela só saberia que a comanda parou relendo a tela por acaso.
 */
export function AvisoDoAgente({
  branches,
  activeBranchId,
  className,
}: {
  branches: readonly Branch[];
  /** O que está no seletor do topo. Vazio é "todas as filiais". */
  activeBranchId: string;
  className?: string;
}) {
  const emVista = activeBranchId
    ? branches.filter((branch) => branch.id === activeBranchId)
    : branches;

  const porFilial = useAgentesDasFiliais(emVista.map((branch) => branch.id));

  const aviso = avisoDeAgenteParado(
    emVista.map((branch) => ({
      branchId: branch.id,
      nome: branchName(branch),
      status: porFilial.get(branch.id),
    })),
  );

  if (!aviso) return null;

  return (
    <p
      className={className ? `alert alert--warn ${className}` : 'alert alert--warn'}
      role="alert"
      data-testid="aviso-agente"
    >
      {aviso}
    </p>
  );
}
