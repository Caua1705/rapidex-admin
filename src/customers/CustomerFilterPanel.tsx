import { useEffect, useState } from 'react';

import { Badge } from '../ds/Badge';
import { Field } from '../ds/Field';
import { RangeInput } from '../ds/RangeInput';
import { Select } from '../ds/Select';
import { useAnchoredPanel } from '../ds/use-anchored-panel';
import {
  NO_FILTERS,
  SEGMENT_OPTIONS,
  activeFilterCount,
  filterProblem,
  type CustomerFilterState,
} from './customer-filters';
import type { CustomerSegment } from '../api/types';
import './CustomerFilterPanel.css';

/**
 * ============================================================================
 * OS FILTROS DE CLIENTES — um botão que abre os critérios
 * ============================================================================
 *
 * Três critérios, um painel, e um número no botão dizendo quantos estão
 * ligados.
 *
 * ----------------------------------------------------------------------------
 * POR QUE AQUI O FILTRO SE ESCONDE, E EM PEDIDOS NÃO
 * ----------------------------------------------------------------------------
 *
 * A regra do sistema é dura e continua valendo: "as ferramentas não abrem nem
 * fecham". Ela foi escrita para PEDIDOS, e o motivo estava no uso — numa tela
 * que fica aberta o turno inteiro, um filtro atrás de um botão é um filtro que
 * ninguém lembra que ligou. O lojista jura que sumiu pedido, e o que sumiu foi
 * a memória de que ontem ele deixou o período em "últimos 7 dias".
 *
 * Clientes é outra tela. Ela se CONSULTA — abre-se para responder uma pergunta
 * ("a quem vale a pena chamar de volta") e fecha-se —, não se opera. Três
 * critérios sempre visíveis custariam uma segunda faixa permanente numa tela
 * cuja ferramenta normal é a busca.
 *
 * MAS O RISCO DE PEDIDOS NÃO DESAPARECEU, e é ele que este componente paga com
 * duas coisas:
 *
 *   - **o número no botão** ("Filtros" com um 2 ao lado). A faixa gruda no
 *     topo, então na quadragésima linha ele continua dizendo que a lista está
 *     recortada. É o mínimo para o esconderijo não mentir.
 *   - **o "Limpar" fora do painel**, que só existe quando há o que limpar. Sem
 *     ele, desligar um filtro exigiria adivinhar que ele está atrás do botão.
 *
 * ----------------------------------------------------------------------------
 * O RASCUNHO, E POR QUE ELE NÃO É O FILTRO
 * ----------------------------------------------------------------------------
 *
 * O que se digita é RASCUNHO; a lista só muda em "Aplicar". Filtrar a cada
 * tecla daria uma chamada por dígito do ticket, e três respostas em voo
 * disputando a mesma tabela — e ao contrário da busca, aqui não há um termo só:
 * uma faixa pela metade ("de 20 a" ainda em branco) é um recorte que ninguém
 * pediu.
 *
 * O rascunho é SEMEADO NA ABERTURA a partir do que está aplicado. É isso que
 * faz fechar sem aplicar não deixar rastro: o painel sempre abre mostrando o
 * recorte que está no ar.
 *
 * ----------------------------------------------------------------------------
 * A FAIXA INVERTIDA É BARRADA AQUI, E NÃO NO 400
 * ----------------------------------------------------------------------------
 *
 * O backend responde 400 a data ou ticket invertidos — e está certo, porque
 * lista vazia deixaria o lojista procurando o cliente que sumiu da tela. Mas um
 * 400 é uma tarja vermelha genérica no lugar da lista, e a lista SOME (o hook
 * esvazia em erro).
 *
 * Então "Aplicar" trava enquanto há intervalo invertido, e a mensagem aparece
 * no campo que está errado. O 400 continua tratado como qualquer erro — ele é a
 * rede, para o dia em que as duas regras divergirem.
 */
export function CustomerFilterPanel({
  applied,
  onApply,
}: {
  /** O recorte que está NO AR. É dele que o rascunho é semeado. */
  applied: CustomerFilterState;
  onApply: (filtros: CustomerFilterState) => void;
}) {
  const painel = useAnchoredPanel();
  const [draft, setDraft] = useState<CustomerFilterState>(applied);

  /*
   * SEMEAR NA ABERTURA. Ver o hook: é a alternativa a um `onClose`, e a única
   * que não tem o intervalo em que "Aplicar" já mudou a lista e o painel ainda
   * mostra o critério antigo.
   */
  useEffect(() => {
    if (painel.open) setDraft(applied);
  }, [painel.open, applied]);

  const ligados = activeFilterCount(applied);
  const problema = filterProblem(draft);

  function aplicar() {
    if (problema) return;
    onApply(draft);
    painel.close(true);
  }

  return (
    <div className="filtro-cli" ref={painel.rootRef} onBlur={painel.onBlur}>
      <button
        type="button"
        ref={painel.triggerRef}
        className="btn btn--sm filtro-cli__gatilho"
        aria-expanded={painel.open}
        onClick={painel.toggle}
        data-testid="customers-filtros"
      >
        Filtros
        {ligados > 0 ? <Badge value={ligados} unidade="critérios ligados" /> : null}
      </button>

      {/*
        O "LIMPAR" FICA FORA DO PAINEL, e só aparece com filtro ligado.

        Dentro, ele limparia o rascunho e exigiria um segundo clique em
        "Aplicar" para a lista voltar — dois cliques para desfazer um. Aqui ele
        desliga tudo de uma vez, que é o que quem clica em "limpar" quer.
      */}
      {ligados > 0 ? (
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={() => onApply(NO_FILTERS)}
          data-testid="customers-filtros-limpar"
        >
          Limpar
        </button>
      ) : null}

      {painel.open ? (
        <div className="filtro-cli__painel" role="group" aria-label="Filtros de clientes">
          <Field label="Classificação">
            <Select
              value={draft.segment}
              onChange={(value) =>
                setDraft((atual) => ({ ...atual, segment: value as CustomerSegment | '' }))
              }
              options={SEGMENT_OPTIONS}
              data-testid="customers-filtro-classe"
            />
          </Field>

          {/*
            AS DUAS DATAS SÃO O DIA DA OPERAÇÃO. Um `input type="date"` devolve
            AAAA-MM-DD sem fuso, que é exatamente o que o backend espera ler em
            `America/Fortaleza` — nenhum `Date` no caminho.

            O FIM É INCLUSIVO no contrato, e a ajuda diz isso: sem a frase, quem
            recorta até hoje fica em dúvida se o pedido das 23h de hoje entrou.
          */}
          <Field
            label="Último pedido"
            hint="O dia da loja, e o fim entra inteiro."
            error={problema?.campo === 'periodo' ? problema.message : null}
          >
            <RangeInput
              type="date"
              separator="a"
              from={{
                value: draft.lastOrderFrom,
                onValueChange: (value) => setDraft((atual) => ({ ...atual, lastOrderFrom: value })),
                label: 'Último pedido a partir de',
                'data-testid': 'customers-filtro-de',
              }}
              to={{
                value: draft.lastOrderTo,
                onValueChange: (value) => setDraft((atual) => ({ ...atual, lastOrderTo: value })),
                label: 'Último pedido até',
                'data-testid': 'customers-filtro-ate',
              }}
            />
          </Field>

          <Field
            label="Ticket médio"
            error={problema?.campo === 'ticket' ? problema.message : null}
          >
            <RangeInput
              prefix="R$"
              inputMode="decimal"
              className="ds-range--faixa"
              from={{
                value: draft.minTicket,
                onValueChange: (value) => setDraft((atual) => ({ ...atual, minTicket: value })),
                label: 'Ticket médio mínimo, em reais',
                placeholder: '0,00',
                'data-testid': 'customers-filtro-min',
              }}
              to={{
                value: draft.maxTicket,
                onValueChange: (value) => setDraft((atual) => ({ ...atual, maxTicket: value })),
                label: 'Ticket médio máximo, em reais',
                placeholder: '0,00',
                'data-testid': 'customers-filtro-max',
              }}
            />
          </Field>

          <div className="filtro-cli__acoes">
            {/*
              "Aplicar" é a ação, e é o único primário. "Limpar rascunho" é
              alternativa — dois primários juntos e nenhum dos dois é a ação.
            */}
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setDraft(NO_FILTERS)}
              data-testid="customers-filtro-zerar"
            >
              Limpar rascunho
            </button>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={aplicar}
              disabled={problema !== null}
              data-testid="customers-filtro-aplicar"
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
