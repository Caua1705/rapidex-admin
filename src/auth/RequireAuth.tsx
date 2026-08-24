import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import type { Acao } from './permissions';
import { useSession } from './session-context';
import { usePermissoes } from './use-permissions';

/** A única tela que abre para quem entrou com uma senha temporária. */
export const ROTA_DA_TROCA_DE_SENHA = '/trocar-senha';

/**
 * Guarda de rota: sem sessão, ninguém entra.
 *
 * Também é o que faz o 401 voltar para o login — quando o SessionProvider
 * zera o usuário, este componente rerenderiza e redireciona.
 *
 * `acao` É A SEGUNDA GUARDA, e ela existe porque esconder o item da lateral não
 * fecha a porta: o endereço continua digitável, e o F5 numa aba deixada aberta
 * antes de alguém ser rebaixado cairia na mesma tela. Sem ela, o atendente
 * chegaria numa lista que responde 403 e leria isso como defeito.
 *
 * O DESTINO É /pedidos, e não uma tela de "acesso negado": Pedidos é o que todo
 * papel que entra no painel alcança, e é onde ele iria de qualquer forma. Uma
 * tela de recusa seria uma página a mais para dizer "não é aqui" — e o backend
 * continua sendo quem recusa de verdade.
 *
 * ----------------------------------------------------------------------------
 * A SENHA TEMPORÁRIA VENCE TUDO, E QUEM DECIDE É O CAMPO
 * ----------------------------------------------------------------------------
 *
 * Com `must_change_password`, o backend só deixa passar `GET /admin/auth/me` e
 * `PATCH /admin/auth/password`: todo o resto é 403. O painel obedece o CAMPO, e
 * não o 403 — ele vem no login e no `/me` justamente para o painel saber disso
 * ANTES de tentar qualquer rota, em vez de descobrir tela a tela.
 *
 * A checagem vem ANTES da de papel de propósito. As duas escondem telas, e a
 * ordem entre elas decide para onde a pessoa vai: um atendente com senha
 * temporária que caísse primeiro na guarda de papel seria mandado para
 * /pedidos, que responde 403 — e ele leria isso como painel quebrado, que é
 * exatamente o que estas guardas existem para acabar.
 *
 * O 403 continua sendo a rede embaixo: ele não é tratado em lugar nenhum da
 * tela, e não deve ser. Um tratamento global de 403 confundiria este caso com o
 * 403 de PAPEL, que é outra coisa e já tem caminho próprio.
 */
export function RequireAuth({ children, acao }: { children: ReactNode; acao?: Acao }) {
  const { user } = useSession();
  const { pode } = usePermissoes();
  const location = useLocation();

  if (!user) {
    // Guarda de onde a pessoa veio para voltar ao mesmo lugar após o login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.must_change_password && location.pathname !== ROTA_DA_TROCA_DE_SENHA) {
    /*
     * `replace`, e sem guardar de onde veio: não há "voltar para onde eu
     * estava" aqui. A pessoa acabou de entrar com uma senha que outra pessoa
     * criou, e o lugar dela é a troca — o histórico do navegador não deve
     * oferecer o caminho de volta para uma tela que responde 403.
     */
    return <Navigate to={ROTA_DA_TROCA_DE_SENHA} replace />;
  }

  if (acao && !pode(acao)) {
    return <Navigate to="/pedidos" replace />;
  }

  return <>{children}</>;
}
