import type { ReactNode } from 'react';

import { MaturationBar } from './MaturationBar';
import type { Stage } from './status';
import './OrderRow.css';

/**
 * A LINHA DE PEDIDO — a unidade da lista, e o ÚNICO componente de pedido do
 * sistema.
 *
 *   <OrderRow
 *     stage="preparando"
 *     stageLabel="Em preparo"
 *     abreBloco                   // só na PRIMEIRA linha do bloco
 *     number={1042}
 *     elapsedLabel="62 min"
 *     elapsedMinutes={62}
 *     windowMinutes={100}
 *     timeLabel="20:41"
 *     customer="Marcos Lima"
 *     modalidade="Entrega"
 *     pagamento="Pix"
 *     pagamentoNota="Pago"
 *     total="R$ 192,90"
 *     onOpen={abrir}
 *   />
 *
 * ELA ERA UM CARTÃO, e a troca é a decisão central da direção. Onze cartões
 * são onze molduras disputando a mesma atenção: cada um precisava de borda, de
 * sombra e de respiro próprio, e o olho relia a caixa inteira para achar o
 * mesmo campo. A linha põe os campos em COLUNAS ALINHADAS e deixa o
 * alinhamento fazer o trabalho que a moldura fazia — o olho desce uma coluna
 * em vez de reler onze caixas. É também o que resolve o agrupamento vazio: sem
 * cartão não há faixa, e o estágio passa a ser dito por uma COLUNA MESCLADA
 * (ver `stageLabel`).
 *
 * A HIERARQUIA, na ordem em que um funcionário no pico precisa dela:
 *
 *   1 ESTÁGIO      o fio de 2px na margem + o nome, escrito uma vez por bloco
 *   2 TEMPO        tabular, o maior corpo da linha, com a barra de maturação
 *   3 CLIENTE      quem é — o único campo que não é número nem rótulo
 *   4 PEDIDO       nº e hora de entrada: como o pedido é CHAMADO
 *   5 MODALIDADE   entrega ou retirada
 *   6 PAGAMENTO    forma e situação — e o único lugar onde a linha levanta a voz
 *   7 VALOR        tabular, à direita, porque é o que se confere no caixa
 *
 * NÃO É UMA <table>, E ISSO É DE PROPÓSITO. A linha inteira é UMA ação (abrir o
 * detalhe), e a única forma de uma tabela ter linha clicável é pendurar um
 * `onClick` numa `<tr>` — que é como uma tela perde o teclado. Aqui a linha é
 * um `<button>` em `display: grid`, e o alinhamento das colunas vem de
 * `--grade-pedido`, declarada UMA vez na lista e herdada por todas as linhas.
 * Uma grade só, uma fonte de verdade: é o que impede a coluna de desalinhar
 * entre o quadro e o histórico.
 *
 * DOIS LAYOUTS, E SÓ DOIS. O largo (acima) e o COMPACTO, que entra por
 * `@container` quando a lista tem menos de 900px — no telefone e também com o
 * painel de detalhe aberto. O compacto NÃO é a linha larga dobrada em duas:
 * ele é outro desenho, com alvo de toque de 76px, o tempo e o valor nas pontas
 * e o resto numa segunda linha de apoio. Ver `OrderRow.css`.
 *
 * Ela não conhece o contrato da API: quem traduz um `OrderListItem` para estas
 * propriedades é `orders/OrderLine`. Isso é o que permite ao `ds/` compilar sem
 * depender do `openapi.d.ts` gerado.
 */
export function OrderRow({
  stage,
  stageLabel,
  abreBloco = false,
  number,
  elapsedLabel,
  elapsedMinutes,
  windowMinutes,
  timeLabel,
  customer,
  modalidade,
  pagamento,
  pagamentoNota,
  total,
  alerta,
  selected = false,
  onOpen,
  'data-testid': testId,
  'data-status': dataStatus,
}: {
  stage: Stage;
  /**
   * O nome do estágio. Ele é SEMPRE passado, e quem decide se aparece é o
   * layout:
   *
   *   - no LARGO, só a primeira linha do bloco o mostra (`abreBloco`) — é a
   *     coluna mesclada. Nas seguintes o fio de cor continua descendo e diz
   *     "ainda é o mesmo bloco" sem repetir a palavra onze vezes. A célula
   *     continua ocupando a largura dela mesmo vazia: se ela encolhesse, as
   *     outras seis colunas andariam de linha para linha, e o alinhamento —
   *     que é o ganho inteiro da direção — iria junto.
   *
   *   - no COMPACTO, TODAS as linhas o mostram. Sem colunas alinhadas não há
   *     coluna mesclada, e uma célula em branco só produzia um separador solto
   *     no começo da linha de apoio ("· #1002 11:46").
   */
  stageLabel: string;
  /** Esta linha ABRE um bloco de estágio: fio mais forte e rótulo visível. */
  abreBloco?: boolean;
  number: number;
  /** "12 min", "1h20" — já formatado por quem sabe formatar. */
  elapsedLabel: string;
  elapsedMinutes: number;
  /** A janela de preparo da loja. Sem ela, a barra de maturação não aparece. */
  windowMinutes: number | null;
  /** A hora de entrada, "20:41". */
  timeLabel: string;
  customer: string;
  /** "Entrega" ou "Retirada". */
  modalidade: string;
  /** A forma: "Pix", "Dinheiro", "Crédito". */
  pagamento: string;
  /** A situação: "Pago", "Paga na entrega". Ausente quando há `alerta`. */
  pagamentoNota?: string;
  total: string;
  /**
   * O aviso que IMPEDE o preparo — hoje, pagamento online não recebido. Ele
   * ocupa a célula de pagamento inteira em vez de virar mais uma etiqueta: não
   * é um atributo do pedido, é uma proibição.
   */
  alerta?: ReactNode;
  selected?: boolean;
  onOpen: () => void;
  'data-testid'?: string;
  'data-status'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testId}
      data-status={dataStatus}
      className={[
        'ds-row',
        `is-${stage}`,
        selected ? 'ds-row--selecionada' : '',
        alerta ? 'ds-row--alerta' : '',
        abreBloco ? 'ds-row--abre' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/*
        A COLUNA MESCLADA. O fio de 2px é desenhado pela CÉLULA e vale para
        todas as linhas do bloco; o rótulo mora num filho próprio, porque é ele
        — e não a célula — que some nas linhas do meio do bloco.
      */}
      <span className="ds-row__estagio">
        <span className="ds-row__estagio-rotulo">{stageLabel}</span>
      </span>

      <span className="ds-row__tempo">
        <span className="ds-row__decorrido tnum">{elapsedLabel}</span>
        <MaturationBar elapsedMinutes={elapsedMinutes} windowMinutes={windowMinutes} />
      </span>

      <span className="ds-row__cliente">{customer}</span>

      <span className="ds-row__pedido">
        <span className="ds-row__numero tnum">#{number}</span>
        <span className="ds-row__hora tnum">{timeLabel}</span>
      </span>

      <span className="ds-row__modalidade">{modalidade}</span>

      <span className="ds-row__pagamento">
        {alerta ? (
          <span className="ds-row__alerta">{alerta}</span>
        ) : (
          <>
            <span className="ds-row__forma">{pagamento}</span>
            {pagamentoNota ? <span className="ds-row__situacao">{pagamentoNota}</span> : null}
          </>
        )}
      </span>

      <span className="ds-row__valor tnum">{total}</span>
    </button>
  );
}
