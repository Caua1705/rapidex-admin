import { useCallback, useEffect, useState } from 'react';

const CHAVE = 'rapidex-admin.store-recolhidas';

/**
 * Quais seções de Minha loja começam recolhidas — e a memória disso.
 *
 * POR QUE ALGUMAS NASCEM FECHADAS: a coluna única resolveu o problema das abas
 * (tudo na mesma página, tudo buscável com Ctrl+F) e criou o próprio: a página
 * ficou longa. Horários são sete linhas, Pagamento e Impressão são listas
 * inteiras — três blocos que o lojista configura uma vez e não toca mais, e
 * que ficavam entre ele e o que ele voltou para mexer.
 *
 * Geral, Filial e Entrega nascem ABERTAS porque são as que mudam: preço
 * mínimo, endereço e taxa de entrega são o que se ajusta com o negócio.
 *
 * A MEMÓRIA É O QUE FAZ ISSO VALER A PENA. Sem ela, quem abre Horários todo
 * dia paga um clique todo dia — e um recolhimento que não aprende é só uma aba
 * com outro nome.
 *
 * localStorage bloqueado (aba anônima com política restrita) não quebra nada:
 * a preferência vira só desta sessão. É o mesmo tratamento que o tema recebe.
 */
export function useCollapsedSections(padraoRecolhidas: readonly string[]) {
  const [recolhidas, setRecolhidas] = useState<readonly string[]>(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo === null) return padraoRecolhidas;
      const lido: unknown = JSON.parse(salvo);
      // Guardado por uma versão anterior com outro formato: cai no padrão em
      // vez de explodir a tela inteira por causa de uma preferência.
      return Array.isArray(lido)
        ? lido.filter((id): id is string => typeof id === 'string')
        : padraoRecolhidas;
    } catch {
      return padraoRecolhidas;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(recolhidas));
    } catch {
      /* Sem localStorage a escolha vale só nesta sessão. */
    }
  }, [recolhidas]);

  const alternar = useCallback((id: string) => {
    setRecolhidas((atual) =>
      atual.includes(id) ? atual.filter((outro) => outro !== id) : [...atual, id],
    );
  }, []);

  /** Abrir sem alternar — é o que a âncora faz ao levar a uma seção fechada. */
  const abrir = useCallback((id: string) => {
    setRecolhidas((atual) => (atual.includes(id) ? atual.filter((outro) => outro !== id) : atual));
  }, []);

  return { recolhidas, alternar, abrir };
}
