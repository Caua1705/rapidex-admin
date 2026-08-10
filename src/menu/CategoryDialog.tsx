import { useState } from 'react';

import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import type { CategoryDraft } from './useMenu';

/**
 * Nova categoria / editar categoria.
 *
 * Não há botão de excluir, e a ausência é explicada em vez de ficar por conta
 * do lojista descobrir: categoria some do cardápio do cliente sendo DESATIVADA.
 * Excluir apagaria o histórico de pedidos que aponta para ela.
 */
export function CategoryDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: CategoryDraft;
  onClose: () => void;
  onSave: (draft: CategoryDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);

  const isEdit = initial.id !== null;
  const canSave = draft.name.trim().length > 0 && !saving;

  async function handleSave() {
    setSaving(true);
    const saved = await onSave(draft);
    setSaving(false);
    if (saved) onClose();
  }

  return (
    <Modal
      title={isEdit ? 'Editar categoria' : 'Nova categoria'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="form">
        <label className="field">
          <span className="field__label">Nome da categoria</span>
          <input
            className="input"
            type="text"
            autoFocus
            placeholder="Ex.: Lanches"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>

        {isEdit ? (
          <div className="form__row">
            <Switch
              checked={draft.isActive}
              onChange={(isActive) => setDraft({ ...draft, isActive })}
              label="Categoria ativa"
            />
            <div>
              <div className="form__switch-label">Categoria ativa</div>
              <p className="field__hint">
                Categorias inativas somem do cardápio do cliente. Não existe excluir categoria —
                desativar é o que tira do ar sem apagar os pedidos que já apontam para ela.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
