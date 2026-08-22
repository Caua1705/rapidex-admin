import { useId, type ReactNode } from 'react';

import './Choice.css';

/**
 * Caixa de marcar.
 *
 *   <Checkbox
 *     checked={cobraTaxa}
 *     onChange={setCobraTaxa}
 *     label="Cobrar taxa de serviço"
 *     hint="Some do carrinho do cliente quando desligada."
 *   />
 *
 * O <input> é nativo — teclado, formulário e leitor de tela vêm dele — mas com
 * `appearance: none` ele não desenha nada: a caixinha do sistema operacional e
 * o `accent-color` somem, e o que se vê é o desenho do design system.
 *
 * A ÁREA DE CLIQUE É A LINHA INTEIRA, não o quadrado de 18px: no balcão, com
 * pressa, ninguém acerta 18px de primeira. O rótulo é o `<label>` de verdade,
 * então clicar no texto marca a caixa sem nenhum código nosso.
 *
 * `hideLabel` É PARA A CAIXA QUE VIVE NUMA LINHA DE LISTA — a mesma convenção
 * do `Switch`, e pelo mesmo motivo. Numa lista de itens do cardápio, quem
 * nomeia a linha é o nome do produto, três colunas à direita: repetir "X-Burger
 * Clássico" ao lado de cada caixa escreveria o mesmo texto duas vezes na mesma
 * linha. O rótulo continua OBRIGATÓRIO e vira o nome acessível — sem ele, o
 * leitor de tela anuncia quarenta caixas idênticas e nenhuma delas diz de qual
 * item é.
 *
 * Escondido, o alvo volta a ser o quadrado, e por isso ele ganha o recuo que o
 * leva aos 44px do toque em vez dos 18px do desenho.
 *
 * O RÓTULO ESCONDIDO VIRA `aria-label`, E NÃO UM TEXTO `sr-only` — a mesma
 * escolha do `Switch`, e ela não é estilística. Um `<span class="sr-only">
 * Selecionar X-Burger</span>` é TEXTO no documento: `getByText('X-Burger')`
 * passa a achar dois elementos, e toda busca por nome de produto na tela vira
 * ambígua. Foi assim que quatro testes de ponta a ponta quebraram de uma vez
 * quando esta caixa entrou na lista do cardápio. `aria-label` dá o mesmo nome
 * acessível sem acrescentar uma segunda cópia do nome ao documento.
 *
 * Por isso `label` é `string` quando `hideLabel` — `aria-label` não aceita
 * marcação, e um `ReactNode` ali viraria "[object Object]" na voz do leitor.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  hideLabel = false,
  disabled = false,
  /** Marcado em parte: usado quando ele comanda uma lista meio marcada. */
  indeterminate = false,
  id,
  'data-testid': testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Com `hideLabel`, precisa ser texto: ele vira o `aria-label` do controle. */
  label: ReactNode;
  hint?: ReactNode;
  /** Some com o texto e o transforma no nome acessível do controle. */
  hideLabel?: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  id?: string;
  'data-testid'?: string;
}) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${generated}-hint`;

  return (
    <label
      className={`ds-choice${disabled ? ' ds-choice--disabled' : ''}${
        hideLabel ? ' ds-choice--nua' : ''
      }`}
      htmlFor={controlId}
    >
      {/*
        O `data-testid` fica no <input>, e não no <label>: é o input que
        responde a `.check()` e a `.isChecked()`. Num rótulo, o mesmo id
        obrigaria todo teste a saber que existe um input escondido dentro.
      */}
      <input
        id={controlId}
        data-testid={testId}
        className="ds-choice__box ds-choice__box--check"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={hideLabel && typeof label === 'string' ? label : undefined}
        aria-describedby={hint ? hintId : undefined}
        ref={(node) => {
          // `indeterminate` não existe como atributo: só como propriedade.
          if (node) node.indeterminate = indeterminate && !checked;
        }}
        onChange={(event) => onChange(event.target.checked)}
      />

      {hideLabel ? null : (
        <span className="ds-choice__text">
          <span className="ds-choice__label">{label}</span>
          {hint ? (
            <span className="ds-choice__hint" id={hintId}>
              {hint}
            </span>
          ) : null}
        </span>
      )}
    </label>
  );
}
