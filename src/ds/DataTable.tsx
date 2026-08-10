import type { ReactNode } from 'react';

import './DataTable.css';

/**
 * Tabela responsiva.
 *
 *   <DataTable
 *     caption="Formas de pagamento da filial"
 *     columns={[
 *       { key: 'label', header: 'Forma' },
 *       { key: 'tipo', header: 'Tipo' },
 *       { key: 'acoes', header: 'Ações', align: 'end', headerHidden: true },
 *     ]}
 *     rows={metodos.map((m) => ({ id: m.id, label: m.label, tipo: …, acoes: … }))}
 *   />
 *
 * NO CELULAR ELA DEIXA DE SER TABELA. Cada linha vira um bloco empilhado em
 * que o cabeçalho da coluna aparece ao lado do valor — porque uma tabela de
 * cinco colunas em 390px ou rola na horizontal (e a primeira coluna some, que
 * é justamente a que identifica a linha) ou espreme o texto até quebrar letra
 * a letra. A semântica de tabela continua lá para o leitor de tela nos dois
 * casos: quem muda é o `display`, não o markup.
 *
 * A `caption` não é opcional: sem ela, quem escuta a tela entra numa tabela
 * sem saber do que ela é. Ela pode ser visualmente escondida, nunca ausente.
 */
export type Column<Row> = {
  key: keyof Row & string;
  header: string;
  /** Cabeçalho só para o leitor de tela — coluna de ação, por exemplo. */
  headerHidden?: boolean;
  align?: 'start' | 'end';
  /** Largura fixa no desktop. Sem isto, a coluna acompanha o conteúdo. */
  width?: string;
};

export function DataTable<Row extends { id: string }>({
  caption,
  captionHidden = false,
  columns,
  rows,
  empty,
}: {
  caption: string;
  captionHidden?: boolean;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  /** O que aparece no lugar da tabela quando não há nenhuma linha. */
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <table className="ds-tabela">
      <caption className={captionHidden ? 'sr-only' : 'ds-tabela__caption'}>{caption}</caption>

      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={column.align === 'end' ? 'ds-tabela__fim' : undefined}
              style={column.width ? { width: column.width } : undefined}
            >
              <span className={column.headerHidden ? 'sr-only' : undefined}>{column.header}</span>
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td
                key={column.key}
                className={column.align === 'end' ? 'ds-tabela__fim' : undefined}
                /*
                 * No celular o cabeçalho da coluna reaparece ao lado do valor,
                 * por `content: attr(data-col)`. É o que mantém "Tipo: Pix"
                 * legível quando a tabela deixa de ter cabeçalho visível.
                 */
                data-col={column.headerHidden ? undefined : column.header}
              >
                {row[column.key] as ReactNode}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
