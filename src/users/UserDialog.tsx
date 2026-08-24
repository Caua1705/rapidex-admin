import { useId, useRef, useState, type FormEvent } from 'react';

import type { AdminUserDetail, Branch, PapelDePessoa } from '../api/types';
import { branchName } from '../layout/branch-heading';
import { Field, Input, Select } from '../ds';
import { AlertIcon } from '../ds/icons';
import { Modal } from '../ui/Modal';
import {
  motivoParaNaoRebaixar,
  opcoesDePapel,
  PAPEL_RESUMO,
  TODAS_AS_FILIAIS,
  validarRascunho,
  type ErrosDoUsuario,
  type UserDraft,
  type UserField,
} from './users-model';
import './UserDialog.css';

const SEM_ERRO: ErrosDoUsuario = { campos: {}, geral: null };

/**
 * Cadastrar alguém / editar quem já existe.
 *
 * A ORDEM DOS CAMPOS É A ORDEM DA CONVERSA: quem é a pessoa (nome), como ela
 * entra (e-mail), o que ela pode (cargo) e onde (filial). O cargo vem antes da
 * filial porque ele decide se a filial existe — no proprietário ela não é lida
 * por ninguém.
 *
 * O QUE NÃO ESTÁ AQUI, E NÃO É ESQUECIMENTO:
 *
 * **A senha.** Quem a escolhe é o servidor, e o motivo não é de senha: com o
 * dono digitando a senha da equipe, ele passa a CONHECER a credencial de outra
 * pessoa — e o `admin:{email}` que o histórico do pedido grava deixa de
 * identificar quem de fato agiu.
 *
 * **O interruptor de ativo.** Desativar tem efeito imediato e tem três guardas;
 * ele mora na LINHA da lista, junto do aviso do que acontece. Escondido no meio
 * de um formulário, ele viraria um campo que se mexe sem querer ao consertar um
 * nome.
 *
 * **O e-mail, na EDIÇÃO.** `AdminUserUpdate` não tem o campo. O UNIQUE é global
 * e `order_status_history.changed_by` guarda `admin:{email}` como texto — um
 * e-mail trocado reescreveria a autoria do que já aconteceu. Ele aparece, sem
 * poder ser editado, com o motivo escrito: some-lo faria a pessoa procurar.
 */
export function UserDialog({
  initial,
  original,
  branches,
  meuId,
  usuarios,
  onClose,
  onSave,
  isSaving,
}: {
  initial: UserDraft;
  /** A ficha gravada, na edição. Nulo no cadastro novo. */
  original: AdminUserDetail | null;
  branches: readonly Branch[];
  meuId: string | null;
  usuarios: readonly AdminUserDetail[];
  onClose: () => void;
  onSave: (draft: UserDraft) => Promise<ErrosDoUsuario | null>;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [erroDoServidor, setErroDoServidor] = useState<ErrosDoUsuario>(SEM_ERRO);
  /*
   * Os erros só aparecem depois da primeira tentativa. Acender "o e-mail é
   * obrigatório" no instante em que o diálogo abre é acusar o lojista de um
   * campo que ele ainda não teve chance de preencher.
   */
  const [tentou, setTentou] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();

  const isEdit = original !== null;
  const errosLocais = validarRascunho(draft);
  const campos: Partial<Record<UserField, string>> = {
    ...(tentou ? errosLocais : {}),
    ...erroDoServidor.campos,
  };

  /*
   * O ÚLTIMO DONO ATIVO NÃO MUDA DE CARGO, e o seletor inteiro é travado com o
   * motivo escrito — não uma opção riscada, e não um erro depois do clique.
   * É a mesma guarda de `_ensure_keeps_an_active_owner`, antecipada: rebaixar
   * o único dono deixa o restaurante sem quem cadastre gente, e o conserto
   * disso é `docker exec`.
   */
  const cargoTravado = isEdit ? motivoParaNaoRebaixar(original, usuarios) : null;

  /*
   * REBAIXAR A SI MESMO É PERMITIDO — com dois donos ativos, o backend aceita —
   * e a tela não o impede. O que ela faz é dizer o que vai acontecer: você sai
   * desta tela no instante em que salvar, e quem devolve o cargo é o outro
   * dono. Impedir seria inventar uma regra que o backend não tem.
   */
  const rebaixandoASiMesmo =
    isEdit && original.id === meuId && original.role === 'owner' && draft.role !== 'owner';

  /*
   * A FILIAL SÓ EXISTE COM MAIS DE UMA LOJA, e no proprietário nem isso: quem é
   * dono enxerga todas por definição (`build_admin_scope` ignora a filial dele),
   * e um seletor ali anunciaria um limite que não existe. É a mesma decisão do
   * "mesmo item em outra loja" no diálogo do Cardápio, que não aparece em
   * restaurante de uma loja só.
   */
  const mostraFilial = branches.length > 1 && draft.role !== 'owner';

  function mexer(mudanca: Partial<UserDraft>) {
    setDraft((atual) => ({ ...atual, ...mudanca }));
    /*
     * Mexeu, o erro do servidor sobre aquele campo deixa de valer: ele descreve
     * o corpo que FOI mandado, não o que está na tela agora. Um "e-mail já em
     * uso" que sobrevive à digitação do e-mail novo faz o lojista achar que não
     * adiantou trocar.
     */
    setErroDoServidor((atual) => {
      const restantes = { ...atual.campos };
      for (const chave of Object.keys(mudanca) as (keyof UserDraft)[]) {
        if (chave !== 'id') delete restantes[chave as UserField];
      }
      return { campos: restantes, geral: atual.geral };
    });
  }

  async function submeter(evento: FormEvent) {
    evento.preventDefault();
    setTentou(true);

    if (Object.keys(errosLocais).length > 0) {
      /* O foco vai para o primeiro campo recusado — sem isso, num formulário
         que rola, o erro pode estar fora da tela quando o botão é apertado. */
      window.requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    const falha = await onSave(draft);
    if (falha) setErroDoServidor(falha);
    else onClose();
  }

  return (
    <Modal
      title={isEdit ? `Editar ${original.name}` : 'Novo usuário'}
      onClose={onClose}
      footer={
        <>
          {erroDoServidor.geral ? (
            <p className="alert alert--error usuario__erro-geral" role="alert">
              {erroDoServidor.geral}
            </p>
          ) : null}
          <button type="button" className="btn" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn--primary"
            disabled={isSaving}
            data-testid="usuario-salvar"
          >
            {isSaving ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar'}
          </button>
        </>
      }
    >
      <form id={formId} ref={formRef} className="usuario" onSubmit={submeter} noValidate>
        <Field label="Nome" required error={campos.name ?? null}>
          <Input
            value={draft.name}
            onValueChange={(value) => mexer({ name: value })}
            placeholder="Maria Souza"
            maxLength={200}
            autoFocus={!isEdit}
            data-testid="usuario-nome"
          />
        </Field>

        {isEdit ? (
          <Field
            label="E-mail"
            hint="O e-mail não muda: ele é o que o histórico de cada pedido guarda como autor. Quem trocou de endereço vira um cadastro novo, e este se desativa."
          >
            <Input value={draft.email} readOnly disabled data-testid="usuario-email" />
          </Field>
        ) : (
          <Field
            label="E-mail"
            required
            hint="É com ele que a pessoa entra no painel. Precisa ser dela — o histórico de cada pedido guarda quem agiu por este endereço."
            error={campos.email ?? null}
          >
            <Input
              type="email"
              value={draft.email}
              onValueChange={(value) => mexer({ email: value })}
              placeholder="maria@pizzariadoze.com.br"
              autoComplete="off"
              maxLength={255}
              data-testid="usuario-email"
            />
          </Field>
        )}

        <Field
          label="Cargo"
          required
          hint={cargoTravado ?? PAPEL_RESUMO[draft.role]}
          error={campos.role ?? null}
        >
          <Select
            value={draft.role}
            onChange={(value) => mexer({ role: value as PapelDePessoa })}
            options={opcoesDePapel()}
            disabled={cargoTravado !== null}
            data-testid="usuario-cargo"
          />
        </Field>

        {rebaixandoASiMesmo ? (
          <p className="alert alert--warn usuario__aviso" role="alert" data-testid="usuario-aviso-rebaixa">
            <AlertIcon size={14} aria-hidden="true" />
            <span>
              Você está deixando de ser proprietário. Ao salvar, esta tela some para você — quem
              pode devolver o cargo é o outro proprietário.
            </span>
          </p>
        ) : null}

        {mostraFilial ? (
          <Field
            label="Filial"
            hint="Preso a uma loja, essa pessoa só enxerga os pedidos, o cardápio e os números dela. Em “Todas as filiais”, ela enxerga o restaurante inteiro."
            error={campos.branchId ?? null}
          >
            <Select
              value={draft.branchId}
              onChange={(value) => mexer({ branchId: value })}
              options={[
                { value: TODAS_AS_FILIAIS, label: 'Todas as filiais' },
                ...branches.map((branch) => ({ value: branch.id, label: branchName(branch) })),
              ]}
              data-testid="usuario-filial"
            />
          </Field>
        ) : null}

        {/*
          O QUE ACONTECE DEPOIS DE CADASTRAR, dito ANTES — a senha aparece uma
          vez só, e quem não souber disso vai descobrir com o diálogo já aberto
          e o telefone na outra mão.
        */}
        {!isEdit ? (
          <p className="t-aux usuario__depois" data-testid="usuario-depois">
            Ao cadastrar, o painel gera uma <strong>senha temporária de uso único</strong> e a
            mostra uma vez só — para você passar a quem vai usar a conta. No primeiro acesso, essa
            pessoa é obrigada a trocá-la, e a partir daí ninguém mais a conhece.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
