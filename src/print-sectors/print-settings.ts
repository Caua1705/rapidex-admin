/**
 * ============================================================================
 * COMO A COMANDA DESTA FILIAL SAI — o rodapé e quantas vias
 * ============================================================================
 *
 * Duas configurações da revisão `20260821_0029`, e elas têm REGIMES OPOSTOS na
 * mesma tela. É a coisa que este arquivo existe para não deixar embaralhar:
 *
 *   A MENSAGEM DO RODAPÉ **herda** o padrão do restaurante, como os termos
 *   comerciais de `store/branch-overrides.ts`. Ela é texto de marca, escrito
 *   uma vez para a rede.
 *
 *   AS QUATRO CONTAGENS **não herdam nada**. Elas descrevem o balcão — quantas
 *   impressoras existem, se a comanda vai grampeada no pacote, se o motoboy
 *   leva uma via —, e isso não é termo negociado pela marca. Todo o resto da
 *   configuração de impressão (setor, impressora, o próprio agente) já pende
 *   de filial sem herdar, e dar regime próprio só a estas quatro poria dois
 *   regimes na mesma tela.
 *
 * ----------------------------------------------------------------------------
 * O RODAPÉ TEM TRÊS ESTADOS, E DOIS DELES SÃO UMA CAIXA VAZIA
 * ----------------------------------------------------------------------------
 *
 * No corpo do PATCH:
 *
 *   | ausente | não mexe                                              |
 *   | `null`  | esta filial VOLTA A HERDAR a mensagem do restaurante   |
 *   | `""`    | esta filial NÃO imprime rodapé — nem o dela, nem o da marca |
 *   | texto   | esta filial imprime este texto                         |
 *
 * O terceiro estado não é refinamento: sem ele, a loja que não quer a campanha
 * da rede não teria como recusá-la — qualquer valor que gravasse sairia
 * impresso. É o mesmo caso do `service_fee_enabled = false`, escrito com texto.
 *
 * E É POR ISSO QUE O RASCUNHO NÃO GUARDA UMA STRING SÓ. Um campo de texto
 * comum tem dois estados visíveis (vazio e preenchido) para três estados de
 * dados, e a colisão cai justamente nos dois que ninguém consegue distinguir
 * olhando: "voltar a herdar" e "não imprimir nada" seriam a MESMA caixa vazia.
 * Mandar `""` onde se queria `null` desliga a campanha da rede naquela loja, e
 * o defeito não aparece no dia em que é escrito — aparece semanas depois, com
 * o lojista jurando que nunca mexeu naquilo.
 *
 * O MODO É EXPLÍCITO, ENTÃO, e o texto é só o conteúdo do terceiro. É a mesma
 * escolha de `OverridesDraft['serviceFee']`, pelo mesmo motivo: herdar não é
 * "não cobrar", e aqui herdar não é "não imprimir".
 */
import type { BranchPrintSettings, BranchPrintSettingsUpdate } from '../api/types';

/** O que a filial escolheu fazer com o rodapé. */
export type FooterMode =
  /** `null` — segue o que a marca escrever, hoje e depois. */
  | 'herda'
  /** `""` — esta loja recusou o rodapé. */
  | 'nao-imprime'
  /** texto — esta loja escreveu o dela. */
  | 'propria';

/**
 * Os tetos, escritos à mão porque o contrato não os publica — `max_length` do
 * corpo sai no /openapi.json, o de LINHAS não sai de lugar nenhum
 * (`clean_footer_message` o cobra num validador).
 *
 * Quem manda continua sendo o backend: se divergirem, o pior que acontece é a
 * tela deixar enviar algo que volta 422 e vira mensagem. Conferir aqui é para o
 * lojista ver o limite ANTES de escrever meio metro de propaganda.
 */
export const FOOTER_MAX_CHARS = 240;
export const FOOTER_MAX_LINES = 6;

/** Teto de cópias de uma via — o `CHECK` da migração, espelhado. */
export const COPIES_MAX = 5;

export type PrintSettingsDraft = {
  footerMode: FooterMode;
  /** O texto do modo `propria`. Guardado mesmo nos outros dois: trocar de modo
   *  e voltar não pode apagar o que o lojista já tinha escrito. */
  footerText: string;
  customerDelivery: number;
  productionDelivery: number;
  customerPickup: number;
  productionPickup: number;
};

export const EMPTY_PRINT_DRAFT: PrintSettingsDraft = {
  footerMode: 'herda',
  footerText: '',
  customerDelivery: 1,
  productionDelivery: 1,
  customerPickup: 1,
  productionPickup: 1,
};

/**
 * O TEXTO PRONTO PARA A BOBINA — espelho de `normalize_receipt_text`.
 *
 * Ele NÃO é aplicado ao que o lojista está digitando: normalizar a cada tecla
 * apagaria a linha em branco que ele acabou de abrir para escrever a próxima.
 * Serve para duas perguntas que a tela precisa responder antes de gravar —
 * quantas LINHAS este texto vai ter de verdade, e ele sobra alguma coisa
 * depois de limpo.
 *
 * CARACTERE DE CONTROLE É COMANDO DE IMPRESSORA, não caractere: o agente
 * escreve o conteúdo direto no fluxo ESC/POS, e um `0x1B` colado num
 * copiar-e-colar reprogramaria a impressora no meio da comanda. Quem defende
 * disso é o backend; aqui a limpeza existe só para a CONTA bater com a dele.
 */
export function normalizeReceiptText(raw: string): string {
  const unificado = raw.replace(/\r\n?/g, '\n');

  let mantido = '';
  for (const caractere of unificado) {
    if (caractere === '\n') {
      mantido += '\n';
      continue;
    }
    if (caractere === '\t') {
      mantido += ' ';
      continue;
    }
    // As mesmas categorias do backend: Cc, Cf, Zl e Zp.
    if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(caractere)) continue;
    mantido += caractere;
  }

  const linhas = mantido.split('\n').map((linha) => linha.replace(/\s+$/u, ''));
  return linhas
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .normalize('NFC')
    .trim();
}

/** Quantas linhas este texto vai ocupar na bobina, já limpo. */
export function countFooterLines(raw: string): number {
  const limpo = normalizeReceiptText(raw);
  return limpo === '' ? 0 : limpo.split('\n').length;
}

export type FooterCheck = { valid: true } | { valid: false; message: string };

/**
 * O que impede de gravar o rodapé.
 *
 * A CAIXA VAZIA NO MODO "ESCREVER" É UM ERRO, e não um `""` silencioso — é o
 * ponto inteiro deste arquivo. Quem quer desligar o rodapé tem uma opção com
 * esse nome; quem escolheu escrever e não escreveu está no meio de uma frase,
 * não pedindo para recusar a campanha da rede.
 *
 * O teto de caracteres é conferido no texto CRU, como o `max_length` do corpo;
 * o de linhas, no texto limpo, como o validador do backend.
 */
export function checkFooter(draft: PrintSettingsDraft): FooterCheck {
  if (draft.footerMode !== 'propria') return { valid: true };

  const limpo = normalizeReceiptText(draft.footerText);
  if (limpo === '') {
    return {
      valid: false,
      message: 'Escreva a mensagem desta loja, ou escolha “Não imprimir”.',
    };
  }

  if (draft.footerText.length > FOOTER_MAX_CHARS) {
    return {
      valid: false,
      message: `A mensagem passa de ${FOOTER_MAX_CHARS} caracteres (tem ${draft.footerText.length}).`,
    };
  }

  const linhas = countFooterLines(draft.footerText);
  if (linhas > FOOTER_MAX_LINES) {
    return {
      valid: false,
      message: `A mensagem pode ter no máximo ${FOOTER_MAX_LINES} linhas (tem ${linhas}).`,
    };
  }

  return { valid: true };
}

/** O que está gravado na filial vira o rascunho — e é aqui que o modo nasce. */
export function draftFromSettings(settings: BranchPrintSettings): PrintSettingsDraft {
  const gravado = settings.receipt_footer_message ?? null;

  return {
    footerMode: gravado === null ? 'herda' : gravado === '' ? 'nao-imprime' : 'propria',
    footerText: gravado ?? '',
    customerDelivery: settings.print_customer_copies_delivery,
    productionDelivery: settings.print_production_copies_delivery,
    customerPickup: settings.print_customer_copies_pickup,
    productionPickup: settings.print_production_copies_pickup,
  };
}

/** O valor que o modo escolhido representa no corpo. */
function footerValue(draft: PrintSettingsDraft): string | null {
  if (draft.footerMode === 'herda') return null;
  if (draft.footerMode === 'nao-imprime') return '';
  return draft.footerText;
}

export type PrintBodyResult =
  { ok: true; body: BranchPrintSettingsUpdate; vazio: boolean } | { ok: false; message: string };

/**
 * O corpo do PATCH — só o que MUDOU, como em toda tela de filial.
 *
 * `undefined` some do JSON e é "não mexe"; `null` é o pedido explícito de
 * voltar a herdar. As contagens NUNCA saem nulas: `null` nelas é 422 no
 * backend, porque as colunas são `NOT NULL` e não herdam nada. Para não
 * imprimir, o valor é `0`.
 */
export function bodyFromDraft(
  draft: PrintSettingsDraft,
  gravado: BranchPrintSettings,
): PrintBodyResult {
  const problema = checkFooter(draft);
  if (!problema.valid) return { ok: false, message: problema.message };

  const body: BranchPrintSettingsUpdate = {};

  const rodape = footerValue(draft);
  if (rodape !== (gravado.receipt_footer_message ?? null)) {
    body.receipt_footer_message = rodape;
  }

  const contagens = [
    [
      'print_customer_copies_delivery',
      draft.customerDelivery,
      gravado.print_customer_copies_delivery,
    ],
    [
      'print_production_copies_delivery',
      draft.productionDelivery,
      gravado.print_production_copies_delivery,
    ],
    ['print_customer_copies_pickup', draft.customerPickup, gravado.print_customer_copies_pickup],
    [
      'print_production_copies_pickup',
      draft.productionPickup,
      gravado.print_production_copies_pickup,
    ],
  ] as const;

  for (const [chave, atual, antes] of contagens) {
    if (atual === antes) continue;
    if (!Number.isInteger(atual) || atual < 0 || atual > COPIES_MAX) {
      return { ok: false, message: `As vias vão de 0 a ${COPIES_MAX}.` };
    }
    body[chave] = atual;
  }

  return { ok: true, body, vazio: Object.keys(body).length === 0 };
}

/**
 * A frase que descreve as duas contagens de um tipo de pedido, para quem NÃO
 * pode editar.
 *
 * Some o controle, não o dado — a mesma regra do nome da impressora nesta
 * tela. Quem está em pé ao lado da bobina é justamente quem pergunta "por que
 * saíram duas vias?", e é por isso que a LEITURA desta configuração é de quem
 * opera enquanto a escrita é da gerência.
 */
export function describeCopies(cliente: number, producao: number): string {
  const partes = [
    cliente === 0 ? 'sem via do cliente' : `${cliente} do cliente`,
    producao === 0 ? 'sem via da produção' : `${producao} da produção por setor`,
  ];
  return partes.join(' · ');
}
