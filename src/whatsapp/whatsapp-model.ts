import type {
  WhatsAppBranchLine,
  WhatsAppChannel,
  WhatsAppChannelCreate,
  WhatsAppChannelStatus,
} from '../api/types';

/**
 * ============================================================================
 * O QUE A TELA DE WHATSAPP PRECISA SABER, SEM REACT NO CAMINHO
 * ============================================================================
 *
 * Duas perguntas moram aqui, e a segunda é a que faz a tela existir.
 *
 * 1. O CADASTRO — o rascunho de conexão, o que o backend recusa antes de o
 *    lojista clicar, e o corpo que sai.
 *
 * 2. A HERANÇA, LOJA A LOJA — "por qual número ESTA loja fala, e o que isso
 *    significa". A lista de canais NÃO responde isso: uma filial sem linha
 *    própria aparece nela como ausência, e pode estar herdando o número do
 *    restaurante e funcionando perfeitamente. Sem esta tradução, o dono
 *    desliga a campanha achando que ela nunca esteve no ar.
 *
 * ----------------------------------------------------------------------------
 * A DISTINÇÃO QUE ESTE ARQUIVO EXISTE PARA NÃO PERDER
 * ----------------------------------------------------------------------------
 *
 * "NUNCA CONECTOU" E "CONECTOU E CAIU" SÃO A MESMA AUSÊNCIA NA TELA e são
 * consertos opostos na vida real. A primeira é uma loja que nunca teve número:
 * o que falta é cadastrar. A segunda é uma loja que TINHA e parou, e nela o
 * dono tem um cliente de ontem que recebeu aviso e um de hoje que não recebeu —
 * e nenhum erro em lugar nenhum, porque o pedido segue em silêncio.
 *
 * O backend as separa em dois lugares e nós lemos os dois:
 *
 *   `source: 'none'` + nenhuma linha de restaurante  →  NUNCA CONECTOU
 *   `source: 'none'` + linha do restaurante caída    →  o padrão dela caiu
 *   `source: 'branch'` + `can_send: false`           →  o número DELA caiu
 *
 * ----------------------------------------------------------------------------
 * A FRASE DO ESTADO VEM DO BACKEND, SEMPRE
 * ----------------------------------------------------------------------------
 *
 * `status_label` e `status_action` chegam prontos, e nada aqui os reconstrói a
 * partir do enum. O código serve para o painel DECIDIR (qual botão desenhar,
 * qual etiqueta vestir); a frase serve para a pessoa LER, e são coisas
 * diferentes. Uma tela que monta o texto a partir do `status` cai no `default`
 * do `switch` dela no dia em que entrar um quarto estado — que é exatamente
 * onde a mensagem errada mora.
 */

/**
 * OS TETOS DE CAMPO, do Pydantic e não do contrato.
 *
 * `Field(max_length=…)` de `AdminWhatsAppChannelCreate` vira `"type": "string"`
 * seco no `/openapi.json`: o painel recebe `string` e não sabe o teto (skill
 * `rapidex-api` §4.8). Eles são escritos à mão, num lugar só, com a classe de
 * origem nomeada — e conferir na tela não é desconfiança do backend, é o
 * lojista ver o limite ANTES de clicar e a mensagem sair em português.
 *
 * `access_token` tem `min_length=1` e NÃO tem teto: ele é o que a Meta emitir,
 * e um número inventado aqui recusaria uma credencial válida.
 */
export const LIMITES = {
  wabaId: 64,
  phoneNumberId: 64,
  displayPhoneNumber: 32,
} as const;

/**
 * O valor do seletor que significa "a linha do RESTAURANTE".
 *
 * `branch_id` nulo é deliberado no contrato: é o número que toda filial sem o
 * seu próprio herda. Vazio e não `'null'` porque é assim que o `Select` do
 * painel representa "nenhum" em toda tela — ver `TODAS_AS_FILIAIS` em
 * `users-model.ts`.
 */
export const LINHA_DO_RESTAURANTE = '';

export type CanalDraft = {
  /** `LINHA_DO_RESTAURANTE` ou o id de uma filial. */
  branchId: string;
  displayPhoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
};

export type CampoDoCanal = keyof CanalDraft;

export function rascunhoNovo(branchId = LINHA_DO_RESTAURANTE): CanalDraft {
  return {
    branchId,
    displayPhoneNumber: '',
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
  };
}

/**
 * O rascunho de RECONEXÃO — o mesmo número, credencial nova.
 *
 * Conectar o mesmo `phone_number_id` de novo não é erro: é o `upsert` que
 * troca o token, religa o canal e limpa a desconexão. É o caminho da rotação de
 * token e o da volta depois de um `DELETE`.
 *
 * O TOKEN NASCE VAZIO, e não é esquecimento: ele não volta em rota nenhuma,
 * nem parcial nem mascarado. Quem reconecta tem um token novo em mãos — ele só
 * existe porque o lojista religou o acesso do lado da Meta.
 *
 * O `waba_id` também nasce vazio, e pelo mesmo motivo: o que a leitura devolve
 * é `waba_id_masked` (`••••7890`), e mandar a máscara de volta cadastraria uma
 * conta que não existe.
 */
export function rascunhoDeReconexao(canal: WhatsAppChannel): CanalDraft {
  return {
    branchId: canal.branch_id ?? LINHA_DO_RESTAURANTE,
    displayPhoneNumber: canal.display_phone_number,
    phoneNumberId: canal.phone_number_id,
    wabaId: '',
    accessToken: '',
  };
}

export type ProblemaDoCanal = { campo: CampoDoCanal; message: string };

/**
 * O primeiro campo que o backend recusaria, na ORDEM em que a tela os mostra.
 *
 * Um por vez e não uma lista: o formulário tem quatro campos e o foco vai para
 * o primeiro recusado. Apontar os quatro de uma vez num diálogo desta altura é
 * pintar o formulário inteiro de vermelho para quem só não digitou o token.
 */
export function problemaDoRascunho(draft: CanalDraft): ProblemaDoCanal | null {
  const numero = draft.displayPhoneNumber.trim();
  if (numero === '') {
    return { campo: 'displayPhoneNumber', message: 'Escreva o número, como ele aparece na Meta.' };
  }
  if (numero.length > LIMITES.displayPhoneNumber) {
    return {
      campo: 'displayPhoneNumber',
      message: `O número cabe em ${LIMITES.displayPhoneNumber} caracteres.`,
    };
  }

  const phoneNumberId = draft.phoneNumberId.trim();
  if (phoneNumberId === '') {
    return { campo: 'phoneNumberId', message: 'Copie o ID do número no painel da Meta.' };
  }
  if (phoneNumberId.length > LIMITES.phoneNumberId) {
    return {
      campo: 'phoneNumberId',
      message: `O ID do número cabe em ${LIMITES.phoneNumberId} caracteres.`,
    };
  }

  const wabaId = draft.wabaId.trim();
  if (wabaId === '') {
    return { campo: 'wabaId', message: 'Copie o ID da conta do WhatsApp Business.' };
  }
  if (wabaId.length > LIMITES.wabaId) {
    return { campo: 'wabaId', message: `O ID da conta cabe em ${LIMITES.wabaId} caracteres.` };
  }

  if (draft.accessToken.trim() === '') {
    return { campo: 'accessToken', message: 'Cole o token de acesso da Business Manager.' };
  }

  return null;
}

/**
 * O corpo do `POST`. Tudo aparado, e a filial vazia vira `null` EXPLÍCITO.
 *
 * Nulo aqui não é "campo não preenchido": é a escolha de cadastrar a queda do
 * restaurante, o número que toda filial sem o seu próprio herda. É a mesma
 * regra de `printing_sector_id` (skill `rapidex-api` §5).
 */
export function corpoDoRascunho(draft: CanalDraft): WhatsAppChannelCreate {
  return {
    branch_id: draft.branchId === LINHA_DO_RESTAURANTE ? null : draft.branchId,
    display_phone_number: draft.displayPhoneNumber.trim(),
    phone_number_id: draft.phoneNumberId.trim(),
    waba_id: draft.wabaId.trim(),
    access_token: draft.accessToken.trim(),
  };
}

/* ==========================================================================
 * AS LINHAS DE CANAL
 * ======================================================================= */

/** A linha do RESTAURANTE — a queda que toda filial sem número próprio herda. */
export function linhaDoRestaurante(canais: readonly WhatsAppChannel[]): WhatsAppChannel | null {
  return canais.find((canal) => canal.branch_id === null) ?? null;
}

/**
 * Onde este canal vale, escrito para quem lê a lista.
 *
 * A linha do restaurante NÃO se chama "sem filial": ela é a que mais explica a
 * tela, porque é dela que sai o número de toda loja que não tem o seu.
 */
export function lugarDoCanal(canal: WhatsAppChannel): string {
  if (canal.branch_id === null) return 'Restaurante (padrão das filiais)';
  return canal.branch_name ?? 'Filial';
}

/**
 * Dá para RECONECTAR este canal pelo painel?
 *
 * Nos dois estados fora do ar, sim — inclusive no `disconnected_by_meta`, e
 * aqui está a sutileza: o botão existe, mas ele não é o conserto. O conserto é
 * religar a Cloud API no aplicativo da loja, e é o que `status_action` diz.
 * Esconder o botão deixaria quem JÁ religou lá sem caminho de volta; mostrá-lo
 * sem a frase faria o dono clicar aqui e continuar sem receber nada.
 */
export function podeReconectar(status: WhatsAppChannelStatus): boolean {
  return status !== 'connected';
}

/**
 * Dá para DESCONECTAR este canal?
 *
 * Só o que está no ar. Um `DELETE` sobre uma linha já fora não muda nada
 * visível — `disabled` já está desligada, e `disconnected_by_meta` continuaria
 * mostrando a desconexão da Meta, que tem prioridade sobre a nossa. Um botão
 * que responde 200 e não muda a tela é o pior tipo de botão.
 */
export function podeDesconectar(status: WhatsAppChannelStatus): boolean {
  return status === 'connected';
}

/* ==========================================================================
 * A HERANÇA, LOJA A LOJA
 * ======================================================================= */

export type TipoDaSituacao =
  /** Número próprio, no ar. */
  | 'propria'
  /** Número próprio que CAIU — e esta loja não passa a usar o do restaurante. */
  | 'propria-caida'
  /** Sem número próprio: fala pelo do restaurante, e isso está certo. */
  | 'herdada'
  /** Sem número próprio, e o do restaurante — que ela herdaria — está fora. */
  | 'herdada-caida'
  /** Nunca conectou nada, e não há do que herdar. */
  | 'nunca';

export type SituacaoDaLoja = {
  tipo: TipoDaSituacao;
  /** O canal de onde sai (ou sairia) o número. Nulo só em `nunca`. */
  canal: WhatsAppChannel | null;
  /** O número legível, quando há um para mostrar. */
  numero: string | null;
  /** De onde vem o número desta loja, em uma linha. */
  resumo: string;
  /** O que isso significa para o dono. Nulo quando não há o que acrescentar. */
  detalhe: string | null;
  /**
   * Um aviso sairia por esta loja neste minuto.
   *
   * COPIADO do `can_send` do backend, nunca deduzido daqui: ele sai da MESMA
   * consulta que o envio usa (`resolve_for_branch`). Duas formas da mesma
   * pergunta divergem no dia em que alguém mexe numa — e aqui divergir
   * significa a tela dizer que está tudo certo enquanto nenhum cliente é
   * avisado.
   */
  avisa: boolean;
};

/**
 * Por qual número esta loja fala, e o que isso quer dizer.
 *
 * A leitura de `source` é a espinha, e o canal correspondente entra junto
 * porque é dele que sai a frase do estado (`status_label` / `status_action`).
 */
export function situacaoDaLoja(
  linha: WhatsAppBranchLine,
  canais: readonly WhatsAppChannel[],
): SituacaoDaLoja {
  const canal = canais.find((item) => item.id === linha.channel_id) ?? null;

  if (linha.source === 'branch') {
    if (linha.can_send) {
      return {
        tipo: 'propria',
        canal,
        numero: linha.display_phone_number ?? null,
        resumo: 'Número próprio desta loja',
        detalhe: null,
        avisa: true,
      };
    }
    /*
     * A ARMADILHA DESTA LINHA, e ela é do backend: a filial que falava por um
     * número PRÓPRIO desligado NÃO cai no do restaurante. Cair seria a loja
     * passando a falar por outro número sem ninguém ter pedido — mas quem olha
     * a tela supõe a queda, porque é o que "herança" quer dizer no resto do
     * painel.
     */
    return {
      tipo: 'propria-caida',
      canal,
      numero: linha.display_phone_number ?? null,
      resumo: 'Número próprio, fora do ar',
      detalhe:
        'Esta loja NÃO passa a usar o número do restaurante enquanto o dela estiver fora. ' +
        'Até religar, nenhum cliente dela é avisado.',
      avisa: false,
    };
  }

  if (linha.source === 'restaurant') {
    return {
      tipo: 'herdada',
      canal,
      numero: linha.display_phone_number ?? null,
      resumo: 'Herda o número do restaurante',
      detalhe: 'Esta loja não tem número próprio, e é assim que ela avisa o cliente.',
      avisa: linha.can_send,
    };
  }

  /*
   * `source: 'none'` É AS DUAS COISAS, e separá-las é metade do porquê deste
   * arquivo. Sem número próprio, o que resta é a linha do restaurante: se ela
   * existe, esta loja TINHA por onde falar e o padrão dela caiu; se não existe,
   * ninguém nunca conectou nada. Os consertos são opostos.
   */
  const queda = linhaDoRestaurante(canais);
  if (queda) {
    return {
      tipo: 'herdada-caida',
      canal: queda,
      numero: queda.display_phone_number,
      resumo: 'Herdaria o número do restaurante',
      detalhe:
        'Ela não tem número próprio, e o do restaurante — que ela usaria — está fora do ar. ' +
        'Nenhum cliente desta loja é avisado.',
      avisa: linha.can_send,
    };
  }

  return {
    tipo: 'nunca',
    canal: null,
    numero: null,
    resumo: 'Nunca conectou',
    detalhe:
      'Esta loja nunca teve número, e o restaurante também não tem um para ela herdar. ' +
      'Nenhum cliente dela recebe aviso no WhatsApp.',
    avisa: linha.can_send,
  };
}

/**
 * As lojas que ficam mudas se ESTE canal sair do ar.
 *
 * É a frase do diálogo de desconexão, e ela é o motivo de o diálogo existir:
 * desligar a linha do restaurante não cala uma loja, cala TODAS as que não têm
 * número próprio — e essa lista não está em lugar nenhum da tela senão aqui.
 */
export function lojasQueDependem(
  canal: WhatsAppChannel,
  linhas: readonly WhatsAppBranchLine[],
): string[] {
  return linhas
    .filter((linha) => linha.channel_id === canal.id && linha.can_send)
    .map((linha) => linha.branch_name);
}

/** Quantas lojas hoje não avisam ninguém. É o número que abre a tela. */
export function lojasSemAviso(linhas: readonly WhatsAppBranchLine[]): WhatsAppBranchLine[] {
  return linhas.filter((linha) => !linha.can_send);
}
