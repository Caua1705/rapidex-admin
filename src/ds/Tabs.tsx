import { useRef } from 'react';

import './Tabs.css';

/**
 * Abas.
 *
 *   <Tabs
 *     label="Configurações da loja"
 *     value={aba}
 *     onChange={setAba}
 *     tabs={[
 *       { id: 'geral', label: 'Geral' },
 *       { id: 'horarios', label: 'Horários' },
 *     ]}
 *   />
 *
 * O TECLADO É O DA ARIA, não o do navegador: dentro da faixa de abas, Tab sai
 * para o conteúdo (só a aba ativa é focável) e as SETAS trocam de aba. É a
 * diferença entre percorrer seis abas com seis Tabs e chegar ao conteúdo com
 * um só.
 *
 * O sublinhado desliza de uma aba para a outra. É a única animação da
 * navegação e ela diz de onde a seleção veio; sob prefers-reduced-motion ela
 * troca de posição na hora, sem deslizar.
 */
export type TabItem = {
  id: string;
  label: string;
  /** Contagem opcional à direita do nome — pedidos na coluna, itens na aba. */
  count?: number;
};

export function Tabs({
  label,
  tabs,
  value,
  onChange,
  /** Liga cada aba ao painel correspondente por id (`<id>-painel`). */
  panelIdPrefix,
}: {
  label: string;
  tabs: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  panelIdPrefix?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = tabs.findIndex((tab) => tab.id === value);

  function mover(step: number) {
    const total = tabs.length;
    const next = (activeIndex + step + total) % total;
    const alvo = tabs[next];
    if (!alvo) return;
    onChange(alvo.id);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      mover(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      mover(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange(tabs[0]?.id ?? value);
      refs.current[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const ultimo = tabs.length - 1;
      onChange(tabs[ultimo]?.id ?? value);
      refs.current[ultimo]?.focus();
    }
  }

  return (
    <div className="ds-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab, index) => {
        const ativa = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={panelIdPrefix ? `${panelIdPrefix}-${tab.id}-aba` : undefined}
            aria-selected={ativa}
            aria-controls={panelIdPrefix ? `${panelIdPrefix}-${tab.id}-painel` : undefined}
            /* Roving tabindex: uma parada de Tab para a faixa inteira. */
            tabIndex={ativa ? 0 : -1}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={`ds-tab${ativa ? ' ds-tab--ativa' : ''}`}
            onClick={() => onChange(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="ds-tab__count">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
