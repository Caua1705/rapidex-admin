import { useState } from 'react';

import type { PrintSector } from '../api/types';
import { activeSectors, NO_SECTOR_LABEL } from '../print-sectors/print-sectors';
import { Modal } from '../ui/Modal';

/**
 * Aplicar um setor de impressão à categoria inteira.
 *
 * É a razão de a funcionalidade existir: configurar item por item uma categoria
 * de 80 lanches é o tipo de tarefa em que o erro não aparece na hora — aparece
 * no primeiro pedido que não saiu na chapa.
 *
 * SOBRESCREVE TODOS, inclusive os itens que já tinham outro setor. É isso que
 * conserta uma categoria configurada errada, e é justamente por isso que a
 * contagem aparece ANTES de confirmar: "isto vai alterar 80 itens" é a
 * informação que separa a ação certa da ação lamentada.
 */
export function ApplySectorDialog({
  categoryName,
  productCount,
  configuredCount,
  inspectedCount,
  sectors,
  isSaving,
  onClose,
  onConfirm,
}: {
  categoryName: string;
  /** Quantos itens a categoria tem, para o lojista ver o tamanho da ação. */
  productCount: number;
  /** Destes, quantos JÁ têm setor — é o que a ação vai sobrescrever. */
  configuredCount: number;
  /**
   * Sobre quantos itens a contagem acima foi feita.
   *
   * A lista é paginada, então nem sempre é a categoria inteira. Quando for
   * menor que `productCount`, o texto diz isso em vez de afirmar um número que
   * não foi contado — é a diferença entre informar e chutar.
   */
  inspectedCount: number;
  sectors: readonly PrintSector[];
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (printSectorId: string | null) => void;
}) {
  // '' representa o null do backend — <option> não carrega null.
  const [choice, setChoice] = useState('');

  const escolhíveis = activeSectors(sectors);
  const alvo = choice === '' ? NO_SECTOR_LABEL : escolhíveis.find((s) => s.id === choice)?.name;
  /** A paginação não trouxe a categoria toda: o "já configurados" é de amostra. */
  const contagemParcial = inspectedCount < productCount;

  return (
    <Modal
      title={`Aplicar setor a “${categoryName}”`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={isSaving || productCount === 0}
            onClick={() => onConfirm(choice === '' ? null : choice)}
            data-testid="apply-sector-confirm"
          >
            {isSaving
              ? 'Aplicando…'
              : `Aplicar a ${productCount} ${productCount === 1 ? 'item' : 'itens'}`}
          </button>
        </>
      }
    >
      <div className="form">
        <label className="field">
          <span className="field__label">Setor de impressão</span>
          <select
            className="select"
            value={choice}
            autoFocus
            onChange={(event) => setChoice(event.target.value)}
            data-testid="apply-sector-select"
          >
            <option value="">{NO_SECTOR_LABEL}</option>
            {escolhíveis.map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </select>
        </label>

        {/*
          O aviso é direto e sem eufemismo, como o resto do painel: quem já tem
          setor definido à mão vai ser sobrescrito, e o lojista precisa saber
          disso antes e não depois.

          O NÚMERO QUE IMPORTA é o segundo. "80 itens" é o tamanho da ação;
          "12 já configurados" é o tamanho do estrago se a ação estiver errada
          — são os que alguém apontou à mão e vão ser sobrescritos.
        */}
        <p className="alert alert--warn" data-testid="apply-sector-warning">
          Todos os {productCount} {productCount === 1 ? 'item' : 'itens'} de “{categoryName}” passam
          a imprimir em <strong>{alvo}</strong> — inclusive os que já tinham outro setor.
          {configuredCount > 0 ? (
            <>
              {' '}
              <strong>
                {configuredCount} {configuredCount === 1 ? 'já tem' : 'já têm'} setor definido
              </strong>
              {contagemParcial ? ` (contados entre os ${inspectedCount} já carregados)` : ''} e{' '}
              {configuredCount === 1 ? 'será trocado' : 'serão trocados'}.
            </>
          ) : contagemParcial ? (
            ` Nenhum dos ${inspectedCount} itens já carregados tem setor definido.`
          ) : (
            ' Nenhum deles tem setor definido hoje.'
          )}
        </p>

        {productCount === 0 ? (
          <p className="faint">Esta categoria não tem itens para aplicar.</p>
        ) : null}
      </div>
    </Modal>
  );
}
