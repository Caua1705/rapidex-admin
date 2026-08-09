import { useEffect, useState } from 'react';

import { fetchProductDetail } from '../api/menu';
import type { Category, PrintSector, ProductOptionGroup } from '../api/types';
import { formatCurrency } from '../orders/format';
import { activeSectors, NO_SECTOR_LABEL } from '../print-sectors/print-sectors';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { parsePriceInput } from './menu-model';
import type { ProductDraft } from './useMenu';

/**
 * Novo item / editar item.
 *
 * Os dois interruptores são eixos diferentes e a tela diz isso em palavras:
 * "Item ativo" é estar no cardápio; "Disponível hoje" é ter na cozinha agora.
 * Quando o item está inativo, disponibilidade não se aplica — o interruptor
 * fica travado em vez de sumir, para que o motivo apareça em vez de o controle
 * simplesmente não existir.
 *
 * Grupos de complemento aparecem só para leitura: eles têm rotas próprias
 * (`/admin/products/{id}/option-groups`, `/admin/option-groups/{id}`) e editá-los
 * aqui, junto do preço, misturaria dois salvamentos independentes num botão só.
 */
export function ProductDialog({
  initial,
  categories,
  sectors,
  branchChosen,
  onClose,
  onSave,
}: {
  initial: ProductDraft;
  categories: Category[];
  /** Setores da filial aberta no cabeçalho. Só os ativos são escolhíveis. */
  sectors: readonly PrintSector[];
  /** Falso com "Todas as filiais": não há de qual filial oferecer setor. */
  branchChosen: boolean;
  onClose: () => void;
  onSave: (draft: ProductDraft, price: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[] | null>(null);

  const isEdit = initial.id !== null;
  const price = parsePriceInput(draft.price);
  const priceIsInvalid = draft.price.trim() !== '' && price === null;
  const canSave = draft.name.trim().length > 0 && price !== null && !saving;

  useEffect(() => {
    if (!initial.id) return;
    let cancelled = false;

    void (async () => {
      try {
        const detail = await fetchProductDetail(initial.id as string);
        if (!cancelled) setOptionGroups(detail.option_groups ?? []);
      } catch {
        // Os complementos são informação de apoio: não conseguir lê-los não
        // pode impedir a edição do nome e do preço, que é o que trouxe o
        // lojista até aqui.
        if (!cancelled) setOptionGroups([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial.id]);

  async function handleSave() {
    if (price === null) return;
    setSaving(true);
    const saved = await onSave(draft, price);
    setSaving(false);
    if (saved) onClose();
  }

  return (
    <Modal
      title={isEdit ? 'Editar item' : 'Novo item'}
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
          <span className="field__label">Nome do item</span>
          <input
            className="input"
            type="text"
            autoFocus
            placeholder="Ex.: X-Burger Clássico"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>

        <div className="form__grid">
          <label className="field">
            <span className="field__label">Preço</span>
            <input
              className="input mono"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={draft.price}
              aria-invalid={priceIsInvalid}
              onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            />
            {priceIsInvalid ? (
              <span className="form__error">Informe um valor como 24,90.</span>
            ) : null}
          </label>

          <label className="field">
            <span className="field__label">Categoria</span>
            <select
              className="select"
              value={draft.categoryId}
              onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Descrição</span>
          <textarea
            className="textarea"
            placeholder="Ingredientes e detalhes do item"
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>

        {/*
          Setor de impressão. "Não imprimir" é a primeira opção e o padrão de
          item novo: nem tudo passa pela produção, e um item sem setor não é um
          cadastro incompleto.

          O <select> guarda '' para representar o null do backend — value de
          <option> não carrega null. A conversão acontece aqui, num lugar só.
        */}
        <label className="field">
          <span className="field__label">Setor de impressão</span>
          <select
            className="select"
            value={draft.printSectorId ?? ''}
            disabled={!branchChosen}
            onChange={(event) => setDraft({ ...draft, printSectorId: event.target.value || null })}
            data-testid="product-print-sector"
          >
            <option value="">{NO_SECTOR_LABEL}</option>
            {activeSectors(sectors).map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </select>
          <span className="form__hint">
            {!branchChosen
              ? 'Setor é por filial: escolha uma no topo para poder definir onde este item imprime.'
              : sectors.length === 0
                ? 'Esta filial ainda não tem setor cadastrado. Crie em Minha loja › Impressão.'
                : 'Onde o pedido com este item sai impresso.'}
          </span>
        </label>

        <div className="form__row">
          <Switch
            checked={draft.isActive}
            onChange={(isActive) => setDraft({ ...draft, isActive })}
            label="Item ativo"
          />
          <div>
            <div className="form__switch-label">Item ativo</div>
            <p className="form__hint">
              Está no cardápio do cliente. Não existe excluir item — desative-o para tirar do ar sem
              apagar os pedidos que já o incluem.
            </p>
          </div>
        </div>

        <div className="form__row">
          <Switch
            checked={draft.isActive && draft.isAvailable}
            disabled={!draft.isActive}
            onChange={(isAvailable) => setDraft({ ...draft, isAvailable })}
            label="Disponível hoje"
          />
          <div>
            <div className="form__switch-label">Disponível hoje</div>
            <p className="form__hint">
              {draft.isActive
                ? 'Tem na cozinha agora. Desligar marca o item como esgotado sem tirá-lo do cardápio.'
                : 'Não se aplica: um item inativo não está à venda.'}
            </p>
          </div>
        </div>

        {isEdit ? (
          <section className="form__section">
            <h3 className="form__section-title">Grupos de complemento</h3>
            {optionGroups === null ? (
              <p className="faint">Carregando…</p>
            ) : optionGroups.length === 0 ? (
              <p className="faint">Nenhum grupo de complemento neste item.</p>
            ) : (
              <ul className="groups">
                {optionGroups.map((group) => (
                  <li key={group.id} className="groups__item">
                    <div className="groups__name">
                      {group.name}
                      <span className="faint">
                        {' '}
                        · {group.is_required ? 'obrigatório' : 'opcional'} · escolhe de{' '}
                        {group.min_select} a {group.max_select}
                      </span>
                    </div>
                    <div className="groups__options faint">
                      {(group.options ?? [])
                        .map((option) =>
                          option.additional_price > 0
                            ? `${option.name} (+${formatCurrency(option.additional_price)})`
                            : option.name,
                        )
                        .join(' · ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="form__hint">
              Complementos têm rotas próprias e não são editados junto do preço.
            </p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
