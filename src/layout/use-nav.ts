import { useMemo } from 'react';

import { usePermissoes } from '../auth/use-permissions';
import { NAV_GROUPS, type NavGroup } from './nav';

/**
 * A NAVEGAÇÃO QUE ESTE LOJISTA ENXERGA.
 *
 * `nav.ts` continua sendo a fonte única do que o produto tem; este hook é o
 * recorte por papel. Ele existe como hook, e não como um `filter` dentro de
 * cada componente, porque a navegação é desenhada em DOIS lugares — a lateral
 * (`AppShell`) e a barra de baixo do celular (`BottomBar`) — e um filtro
 * copiado nos dois é a forma conhecida de o item sumir de um e ficar no outro.
 * O arquivo `nav.ts` já diz isso sobre a lista; vale igual sobre o recorte.
 *
 * GRUPO QUE FICA VAZIO NÃO É DESENHADO. Um rótulo "Crescimento" sozinho, sem
 * item nenhum embaixo, custa uma dobra de tela para anunciar o nada — é a mesma
 * regra do agrupamento vazio no quadro de pedidos.
 */
export function useNavGroups(): readonly NavGroup[] {
  const { pode } = usePermissoes();

  return useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => !entry.acao || pode(entry.acao)),
      })).filter((group) => group.entries.length > 0),
    [pode],
  );
}
