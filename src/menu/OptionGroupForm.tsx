import { useState } from 'react';

import type { OptionGroupCreateBody, ProductOptionGroup } from '../api/types';
import { Switch } from '../ds/Switch';
import {
  GRUPO_DESCRICAO_MAX,
  GRUPO_NOME_MAX,
  checkGrupo,
  corpoDoGrupo,
  grupoDraftDe,
  grupoVazio,
  type GrupoDraft,
} from './option-groups';

/**
 * O formulário de um grupo de complemento — o mesmo para criar e para editar.
 *
 * UM SÓ, e não dois: as regras cruzadas (máximo ≥ mínimo, obrigatório exige
 * mínimo ≥ 1) valem igual nos dois casos, e o backend as valida igual — ele
 * confere o RESULTADO DA MESCLA na edição, exatamente como confere o corpo na
 * criação. Dois formulários seriam duas cópias da mesma validação, e é assim
 * que uma delas fica para trás.
 *
 * ----------------------------------------------------------------------------
 * "OBRIGATÓRIO" E "MÍNIMO" SÃO A MESMA DECISÃO CONTADA DUAS VEZES
 * ----------------------------------------------------------------------------
 *
 * O backend recusa grupo obrigatório com mínimo zero, e a razão dele é boa: o
 * PEDIDO seria recusado na criação sem o cardápio conseguir dizer o que falta
 * escolher. Mas quem preenche não pensa em "min_select": pensa em "o cliente
 * TEM de escolher um tamanho".
 *
 * Por isso ligar o interruptor de obrigatório SOBE o mínimo para 1 quando ele
 * está em zero. Não é a tela adivinhando: é a tela escrevendo a consequência que
 * o backend impõe, no momento em que ela é decidida — em vez de recusar o
 * formulário no clique de salvar, com o campo culpado três linhas acima.
 */
export function GrupoForm({
  inicial,
  isSaving,
  onCancel,
  onSave,
}: {
  /** Ausente = grupo novo. */
  inicial?: ProductOptionGroup;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (corpo: OptionGroupCreateBody) => void;
}) {
  const [draft, setDraft] = useState<GrupoDraft>(() =>
    inicial ? grupoDraftDe(inicial) : grupoVazio(),
  );
  const [tocou, setTocou] = useState(false);

  const check = checkGrupo(draft);
  const erro = tocou && !check.valid ? check.message : null;

  function alterar(patch: Partial<GrupoDraft>) {
    setTocou(true);
    setDraft((atual) => ({ ...atual, ...patch }));
  }

  return (
    <div className="groups__form" data-testid="grupo-form">
      <label className="field">
        <span className="field__label">Nome do grupo</span>
        <input
          className="input"
          autoFocus
          maxLength={GRUPO_NOME_MAX}
          placeholder="Ex.: Escolha o tamanho"
          value={draft.name}
          onChange={(event) => alterar({ name: event.target.value })}
          data-testid="grupo-nome"
        />
      </label>

      <label className="field">
        <span className="field__label">Explicação (opcional)</span>
        <input
          className="input"
          maxLength={GRUPO_DESCRICAO_MAX}
          placeholder="Ex.: A borda vai junto no preço."
          value={draft.description}
          onChange={(event) => alterar({ description: event.target.value })}
          data-testid="grupo-descricao"
        />
      </label>

      <div className="groups__form-linha">
        <Switch
          checked={draft.isRequired}
          disabled={isSaving}
          label="O cliente é obrigado a escolher"
          onChange={(isRequired) =>
            /*
             * Ligar sobe o mínimo para 1 — ver o bloco no topo do arquivo.
             * Desligar NÃO desce de volta: o lojista pode querer "opcional, mas
             * se escolher, escolhe pelo menos 2", e desfazer o número dele
             * seria a tela apagando uma decisão que ela não tomou.
             */
            alterar(
              isRequired && Number(draft.minSelect) < 1
                ? { isRequired, minSelect: '1' }
                : { isRequired },
            )
          }
        />
      </div>

      <div className="groups__form-linha">
        <label className="field field--curto">
          <span className="field__label">Mínimo</span>
          <input
            className="input tnum"
            inputMode="numeric"
            value={draft.minSelect}
            onChange={(event) => alterar({ minSelect: event.target.value })}
            data-testid="grupo-min"
          />
        </label>

        <label className="field field--curto">
          <span className="field__label">Máximo</span>
          <input
            className="input tnum"
            inputMode="numeric"
            value={draft.maxSelect}
            onChange={(event) => alterar({ maxSelect: event.target.value })}
            data-testid="grupo-max"
          />
        </label>
      </div>

      {inicial ? (
        <div className="groups__form-linha">
          {/*
            DESATIVAR O GRUPO É DIFERENTE DE APAGÁ-LO, e apagar não existe: o
            backend não tem DELETE aqui. Um grupo desativado some do cardápio do
            cliente e NÃO conta como exigência — inclusive para o aviso de "item
            fora de venda", que é a diferença fácil de errar.
          */}
          <Switch
            checked={draft.isActive}
            disabled={isSaving}
            label="Grupo ativo no cardápio"
            onChange={(isActive) => alterar({ isActive })}
          />
        </div>
      ) : null}

      {erro ? (
        <p className="field__error-text" role="alert" data-testid="grupo-erro-form">
          {erro}
        </p>
      ) : null}

      <div className="groups__form-acoes">
        <button type="button" className="btn" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!check.valid || isSaving}
          onClick={() => check.valid && onSave(corpoDoGrupo(check.grupo))}
          data-testid="grupo-salvar"
        >
          {isSaving ? 'Salvando…' : inicial ? 'Salvar regras' : 'Criar grupo'}
        </button>
      </div>
    </div>
  );
}
