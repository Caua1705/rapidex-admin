import { useEffect, useState } from 'react';

/**
 * Qual seção da coluna está sendo lida agora.
 *
 * A lista de âncoras substituiu as abas, e uma âncora que não sabe onde você
 * está é pior que uma aba: ela vira uma lista de links mortos. Isto é o que a
 * faz responder — a seção visível fica marcada enquanto a página rola.
 *
 * `rootMargin` recorta a janela para uma faixa no ALTO da área de conteúdo
 * (`-45% embaixo`): sem isso, com duas seções na tela ao mesmo tempo, a marca
 * ficaria na de baixo assim que ela aparecesse por 1px, e o índice pularia
 * antes de o olho chegar lá.
 *
 * Sem IntersectionObserver (jsdom nos testes), devolve a primeira seção: uma
 * âncora marcada a mais é inofensiva, e o alternativo seria a tela não
 * renderizar.
 */
export function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const visiveis = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visiveis.add(entry.target.id);
          else visiveis.delete(entry.target.id);
        });
        // A primeira da ORDEM DA PÁGINA entre as visíveis, não a primeira a
        // disparar: a ordem dos eventos do observer não é a ordem da tela.
        const primeira = ids.find((id) => visiveis.has(id));
        if (primeira) setActive(primeira);
      },
      { rootMargin: '0% 0% -45% 0%', threshold: 0 },
    );

    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [ids]);

  return active;
}
