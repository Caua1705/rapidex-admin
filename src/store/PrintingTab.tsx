import { useState } from 'react';

import type { PrintSector } from '../api/types';
import { checkSectorName } from '../print-sectors/print-sectors';
import { usePrintSectors } from '../print-sectors/usePrintSectors';
import { EditIcon, PlusIcon } from '../ui/icons';
import { Switch } from '../ui/Switch';

/**
 * Os setores de impressão da filial.
 *
 * Setor é o lugar físico onde o pedido sai impresso — chapa, bar, sobremesa.
 * Ele é POR FILIAL: o "Chapa" da Aldeota e o "Chapa" da Zona Norte são duas
 * linhas diferentes, com impressoras diferentes. Por isso esta aba é de escopo
 * de filial e depende do seletor do cabeçalho.
 *
 * Desativar em vez de excluir, como no cardápio: os produtos guardam o id do
 * setor, e apagá-lo deixaria o cardápio inteiro apontando para um id órfão.
 * Desativado, ele some das escolhas e continua explicando o que já foi gravado.
 */
export function PrintingTab({ branchId }: { branchId: string }) {
  const printing = usePrintSectors(branchId);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function handleCreate() {
    const check = checkSectorName(newName, printing.sectors);
    if (!check.valid) return setProblem(check.message);

    setProblem(null);
    if (await printing.create(check.name)) setNewName('');
  }

  async function handleRename(sector: PrintSector, raw: string) {
    const check = checkSectorName(raw, printing.sectors, { ignoreId: sector.id });
    if (!check.valid) {
      setProblem(check.message);
      return;
    }

    setProblem(null);
    // Nome igual ao que já está: fecha a edição sem gastar uma requisição.
    if (check.name === sector.name) {
      setEditingId(null);
      return;
    }
    if (await printing.rename(sector.id, check.name)) setEditingId(null);
  }

  if (printing.isLoading) return <p className="muted store__loading">Carregando os setores…</p>;

  return (
    <div className="store-form">
      {(problem ?? printing.errorMessage) ? (
        <p className="alert alert--error" role="alert" data-testid="store-error">
          {problem ?? printing.errorMessage}
        </p>
      ) : null}

      <section className="store-form__section">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Setores de impressão</h2>
          <span className="faint">Onde cada pedido sai impresso nesta filial.</span>
        </div>

        {printing.sectors.length === 0 ? (
          <p className="faint store-form__hint">
            Nenhum setor nesta filial ainda. Crie o primeiro — depois é no Cardápio que se diz qual
            produto imprime em qual setor.
          </p>
        ) : (
          <ul className="sectors">
            {printing.sectors.map((sector) => (
              <li
                className={`sectors__row${sector.is_active ? '' : ' sectors__row--off'}`}
                key={sector.id}
                data-testid={`print-sector-${sector.id}`}
              >
                {editingId === sector.id ? (
                  <SectorNameField
                    initial={sector.name}
                    isSaving={printing.pendingIds.includes(sector.id)}
                    onCancel={() => {
                      setEditingId(null);
                      setProblem(null);
                    }}
                    onSave={(value) => void handleRename(sector, value)}
                  />
                ) : (
                  <>
                    <span className="sectors__name">{sector.name}</span>

                    <button
                      type="button"
                      className="btn btn--sm icon-btn"
                      onClick={() => {
                        setEditingId(sector.id);
                        setProblem(null);
                      }}
                      aria-label={`Renomear ${sector.name}`}
                      title="Renomear setor"
                      data-testid={`print-sector-rename-${sector.id}`}
                    >
                      <EditIcon />
                    </button>
                  </>
                )}

                <span className="sectors__state faint">
                  {sector.is_active ? 'Ativo' : 'Desativado'}
                </span>

                <Switch
                  checked={sector.is_active}
                  disabled={printing.pendingIds.includes(sector.id)}
                  label={`${sector.name}: ${sector.is_active ? 'desativar' : 'ativar'}`}
                  onChange={(next) => void printing.setActive(sector.id, next)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="store-form__section">
        <h2 className="store-form__heading">Novo setor</h2>

        <div className="sectors__new">
          <label className="field sectors__new-field">
            <span className="field__label">Nome do setor</span>
            <input
              className="input"
              value={newName}
              placeholder="Chapa, Bar, Sobremesa…"
              onChange={(event) => {
                setNewName(event.target.value);
                setProblem(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              data-testid="print-sector-new-name"
            />
          </label>

          <button
            type="button"
            className="btn btn--primary"
            disabled={newName.trim() === '' || printing.isCreating}
            onClick={() => void handleCreate()}
            data-testid="print-sector-create"
          >
            <PlusIcon />
            {printing.isCreating ? 'Criando…' : 'Criar setor'}
          </button>
        </div>
      </section>
    </div>
  );
}

/** O campo que aparece no lugar do nome enquanto se renomeia a linha. */
function SectorNameField({
  initial,
  isSaving,
  onCancel,
  onSave,
}: {
  initial: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initial);

  return (
    <span className="sectors__edit">
      <input
        className="input sectors__edit-input"
        value={draft}
        autoFocus
        aria-label={`Novo nome para ${initial}`}
        disabled={isSaving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSave(draft);
          }
          // Escape desiste sem gravar: quem abriu a edição por engano não fica
          // preso nela.
          if (event.key === 'Escape') onCancel();
        }}
        data-testid="print-sector-rename-input"
      />
      <button
        type="button"
        className="btn btn--sm btn--primary"
        disabled={isSaving}
        onClick={() => onSave(draft)}
        data-testid="print-sector-rename-save"
      >
        {isSaving ? 'Salvando…' : 'Salvar'}
      </button>
      <button type="button" className="btn btn--sm" disabled={isSaving} onClick={onCancel}>
        Cancelar
      </button>
    </span>
  );
}
