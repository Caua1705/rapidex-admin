import { useId, useRef, useState, type FormEvent } from 'react';

import type { WhatsAppBranchLine, WhatsAppChannel } from '../api/types';
import { Field, Input, Select } from '../ds';
import { AlertIcon } from '../ds/icons';
import { Modal } from '../ui/Modal';
import {
  LIMITES,
  LINHA_DO_RESTAURANTE,
  problemaDoRascunho,
  type CampoDoCanal,
  type CanalDraft,
} from './whatsapp-model';
import './ConnectChannelDialog.css';

/**
 * Conectar um número — e RECONECTAR, que é a mesma rota.
 *
 * A ORDEM DOS CAMPOS É A ORDEM DA CONVERSA: por onde este número fala (a loja),
 * qual é o número (o que o lojista reconhece), e só então os dois ids e o token
 * — que ele não reconhece, e vai copiar do painel da Meta com a outra aba
 * aberta. Pôr o token em cima faria a primeira coisa da tela ser a única que
 * exige sair dela.
 *
 * ----------------------------------------------------------------------------
 * A RECONEXÃO NÃO É OUTRO DIÁLOGO, E ISSO É DE PROPÓSITO
 * ----------------------------------------------------------------------------
 *
 * Conectar o mesmo `phone_number_id` de novo É reconectar: o backend troca o
 * token, religa o canal e limpa a desconexão. Um segundo diálogo "reconectar"
 * seria um formulário idêntico chamando a mesma rota, e o dia em que um dos
 * dois ganhasse um campo seria o dia em que o outro passaria a mandar corpo
 * incompleto.
 *
 * O que muda entre os dois é o que fica TRAVADO: na reconexão, a loja e o ID do
 * número são a identidade da linha que está voltando. Trocar a loja ali não
 * "move" o número — responde 409 "este número já é o da filial X", que é uma
 * recusa correta e uma frase que ninguém entende no meio de um formulário que
 * parecia aceitar a troca.
 *
 * ----------------------------------------------------------------------------
 * O TOKEN NASCE VAZIO EM AMBOS, E NÃO É ESQUECIMENTO
 * ----------------------------------------------------------------------------
 *
 * Ele não volta em rota nenhuma, nem parcial nem mascarado — a mesma regra do
 * access token do Mercado Pago e da senha temporária do lojista. Quem reconecta
 * tem um token novo em mãos, e é justamente por isso que ele existe: o token
 * novo só foi emitido porque a pessoa religou o acesso do lado da Meta.
 */
export function ConnectChannelDialog({
  initial,
  modo,
  canal,
  lojas,
  onClose,
  onSave,
  isSaving,
}: {
  initial: CanalDraft;
  modo: 'novo' | 'reconexao';
  /** A linha que está voltando, na reconexão. Nula no cadastro novo. */
  canal: WhatsAppChannel | null;
  lojas: readonly WhatsAppBranchLine[];
  onClose: () => void;
  /** Devolve a frase da recusa, ou nulo quando gravou. */
  onSave: (draft: CanalDraft) => Promise<string | null>;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [erroDoServidor, setErroDoServidor] = useState<string | null>(null);
  /*
   * O erro só aparece depois da primeira tentativa. Acender "cole o token" no
   * instante em que o diálogo abre é acusar o lojista de um campo que ele ainda
   * não teve chance de preencher.
   */
  const [tentou, setTentou] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();

  const reconectando = modo === 'reconexao';
  const problema = problemaDoRascunho(draft);
  /** A frase de recusa deste campo, quando é ele o primeiro que o backend barraria. */
  function erroDe(campo: CampoDoCanal): string | null {
    if (!tentou || !problema || problema.campo !== campo) return null;
    return problema.message;
  }

  /*
   * O SELETOR DE LOJA SÓ EXISTE COM MAIS DE UMA. Com uma só, a linha do
   * RESTAURANTE é a forma certa e a única — é o que o contrato diz com todas as
   * letras ("restaurante de uma loja só usa essa forma"), e um seletor com duas
   * opções que dão no mesmo lugar é uma decisão inventada para o lojista tomar.
   * Mesma decisão do "mesmo item em outra loja" no diálogo do Cardápio.
   */
  const mostraLoja = lojas.length > 1;

  function mexer(mudanca: Partial<CanalDraft>) {
    setDraft((atual) => ({ ...atual, ...mudanca }));
    /* Mexeu, a recusa do servidor deixa de valer: ela descreve o corpo que FOI
       mandado, não o que está na tela agora. Um "este número já é da filial X"
       que sobrevive à troca do número faz o lojista achar que não adiantou. */
    setErroDoServidor(null);
  }

  async function submeter(evento: FormEvent) {
    evento.preventDefault();
    setTentou(true);

    if (problema) {
      /* O foco vai para o primeiro campo recusado — num diálogo que rola no
         telefone, o erro pode estar fora da tela quando o botão é apertado. */
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
      title={reconectando ? `Conectar de novo ${draft.displayPhoneNumber}` : 'Conectar um número'}
      onClose={onClose}
      footer={
        <>
          {erroDoServidor ? (
            <p className="alert alert--error canal__erro-geral" role="alert">
              {erroDoServidor}
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
            data-testid="whatsapp-salvar"
          >
            {isSaving ? 'Conectando…' : reconectando ? 'Conectar de novo' : 'Conectar'}
          </button>
        </>
      }
    >
      <form id={formId} ref={formRef} className="canal" onSubmit={submeter} noValidate>
        {/*
          O QUE `status_action` MANDA FAZER, ANTES DO FORMULÁRIO.

          Na desconexão pela Meta, o conserto NÃO é nosso: o acesso da Cloud API
          foi removido no aplicativo da loja, e nenhum botão daqui religa isso.
          Quem chega neste diálogo sem ter religado lá vai conectar, ver
          "Conectado" e continuar sem avisar cliente nenhum. A frase é a do
          backend, palavra por palavra — a tela não a monta a partir do estado.
        */}
        {canal?.status_action ? (
          <p className="alert alert--warn canal__acao" data-testid="whatsapp-acao">
            <AlertIcon size={14} aria-hidden="true" />
            <span>
              <strong>{canal.status_label}.</strong> {canal.status_action}
            </span>
          </p>
        ) : null}

        {mostraLoja ? (
          <Field
            label="Por onde este número fala"
            required
            hint={
              reconectando
                ? 'Não muda numa reconexão: é a mesma linha voltando. Para mover o número de loja, desconecte-o aqui e conecte-o lá.'
                : 'No restaurante, ele vira o padrão: toda loja sem número próprio passa a falar por ele.'
            }
          >
            <Select
              value={draft.branchId}
              onChange={(value) => mexer({ branchId: value })}
              disabled={reconectando}
              options={[
                { value: LINHA_DO_RESTAURANTE, label: 'Restaurante (padrão das filiais)' },
                ...lojas.map((loja) => ({ value: loja.branch_id, label: loja.branch_name })),
              ]}
              data-testid="whatsapp-loja"
            />
          </Field>
        ) : null}

        <Field
          label="Número"
          required
          hint="Como ele aparece na Meta, com o código do país. É o que o cliente vê chegando."
          error={erroDe('displayPhoneNumber')}
        >
          <Input
            value={draft.displayPhoneNumber}
            onValueChange={(value) => mexer({ displayPhoneNumber: value })}
            placeholder="+55 85 99999-0000"
            maxLength={LIMITES.displayPhoneNumber}
            autoFocus={!reconectando}
            data-testid="whatsapp-numero"
          />
        </Field>

        <Field
          label="ID do número"
          required
          hint="O “Phone number ID”, no painel da Meta. Não é o telefone."
          error={erroDe('phoneNumberId')}
        >
          <Input
            value={draft.phoneNumberId}
            onValueChange={(value) => mexer({ phoneNumberId: value })}
            /*
              TRAVADO NA RECONEXÃO porque é ELE que identifica a linha: é por
              este campo que o backend decide entre "reconectar" e "cadastrar
              outro número". Alterado aqui, o que parecia uma troca de token
              vira um cadastro novo, e o 409 chega depois.
            */
            readOnly={reconectando}
            disabled={reconectando}
            autoComplete="off"
            spellCheck={false}
            maxLength={LIMITES.phoneNumberId}
            data-testid="whatsapp-phone-number-id"
          />
        </Field>

        <Field
          label="ID da conta do WhatsApp Business"
          required
          hint="O “WhatsApp Business Account ID” (WABA). O painel guarda só os quatro últimos dígitos para você conferir depois."
          error={erroDe('wabaId')}
        >
          <Input
            value={draft.wabaId}
            onValueChange={(value) => mexer({ wabaId: value })}
            autoComplete="off"
            spellCheck={false}
            maxLength={LIMITES.wabaId}
            autoFocus={reconectando}
            data-testid="whatsapp-waba-id"
          />
        </Field>

        {/*
          O TOKEN APARECE ENQUANTO É DIGITADO, e é decisão, não descuido.

          Ele é colado de outra aba, tem centenas de caracteres, e uma caixa de
          bolinhas não deixa conferir a colagem. O erro que ela esconderia é o
          pior desta tela: token errado grava, a linha diz "Conectado", e os
          avisos falham em silêncio — sem tela vermelha, sem erro, com o pedido
          seguindo normalmente. Quem abre este diálogo é o DONO, num diálogo que
          ele mesmo acabou de abrir.

          A partir do envio ele não é lido de volta por rota nenhuma: fica
          cifrado no banco e some daqui quando o diálogo fecha.
        */}
        <Field
          label="Token de acesso"
          required
          hint="O painel guarda cifrado e nunca mais o mostra — nem para você. Perdeu, gere outro na Meta e conecte de novo."
          error={erroDe('accessToken')}
        >
          <Input
            value={draft.accessToken}
            onValueChange={(value) => mexer({ accessToken: value })}
            autoComplete="off"
            spellCheck={false}
            data-testid="whatsapp-token"
          />
        </Field>
      </form>
    </Modal>
  );
}
