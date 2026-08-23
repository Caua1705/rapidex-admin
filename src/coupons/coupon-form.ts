/**
 * AS RECUSAS DO CUPOM, ANTECIPADAS — e traduzidas quando não dá para antecipar.
 *
 * Este arquivo tem duas metades que respondem à mesma pergunta ("qual campo
 * está errado?") em momentos diferentes:
 *
 *   - `validarRascunho` roda a cada tecla e trava o botão. É o que impede o
 *     lojista de preencher doze campos para descobrir no submit que a data
 *     final está antes da inicial.
 *   - `errosDaResposta` traduz o que voltou do backend. É o que sobra: a
 *     colisão de código e a de arte só o banco sabe.
 *
 * AS DUAS ESCREVEM NO MESMO MAPA, e é de propósito: o formulário destaca o
 * campo do mesmo jeito venha o erro de onde vier. Dois caminhos de erro com
 * duas aparências é como um deles deixa de ser notado.
 *
 * POR QUE O BACKEND CONSEGUE SER APONTADO CAMPO A CAMPO: `_raise_unprocessable`
 * devolve os 422 do service na MESMA forma do FastAPI —
 * `{"detail": [{"loc": ["body", campo], "msg", "type"}]}`. Sem isso a tela
 * teria de adivinhar qual das duas formas chegou antes de conseguir destacar
 * alguma coisa.
 */
import { ApiError, messageFromUnknownError } from '../api/errors';
import type { CouponTemplate } from '../api/types';
import { parseDecimal, parseInteger } from '../store/settings-model';
import { aceitaTeto, tipoDaArte, type CouponDraft, type CouponField } from './coupon-model';

export type ErrosDoCupom = {
  /** Erro por campo do formulário. */
  campos: Partial<Record<CouponField, string>>;
  /** O que não pertence a nenhum campo. Vai para o aviso do rodapé. */
  geral: string | null;
};

export const SEM_ERRO: ErrosDoCupom = { campos: {}, geral: null };

export function temErro(erros: ErrosDoCupom): boolean {
  return erros.geral !== null || Object.keys(erros.campos).length > 0;
}

/* ==========================================================================
 * A METADE QUE RODA ANTES DE MANDAR
 * ======================================================================= */

const TETO_DO_CODIGO = 100;
const TETO_DO_NOME = 200;

/**
 * O que dá para conferir sem sair da tela.
 *
 * As quatro regras do `model_validator` do backend estão todas aqui, e é por
 * isso que elas raramente chegam a ser traduzidas do outro lado:
 *
 *   - `valid_until <= valid_from`;
 *   - `max_discount_amount` fora de percentual — que a TELA torna impossível,
 *     porque o campo não existe fora de percentual e `bodyFrom` o zera;
 *   - código só de espaços;
 *   - `cooldown_days` com `usage_limit_per_customer = 1`.
 *
 * A DATA FINAL IGUAL À INICIAL É VÁLIDA, e é o detalhe que quase virou bug
 * aqui: a comparação do backend é sobre INSTANTES, e uma campanha de um dia só
 * vai de 00:00:00 a 23:59:59 do mesmo dia — `valid_until` continua maior. A
 * regra da tela é sobre DIA, então ela recusa só a data final ANTERIOR.
 */
export function validarRascunho(
  rascunho: CouponDraft,
  arte: CouponTemplate | null,
): ErrosDoCupom {
  const campos: Partial<Record<CouponField, string>> = {};

  if (!arte) campos.templateId = 'Escolha a arte que o cliente vai ver.';

  if (rascunho.title.trim() === '') campos.title = 'Dê um nome à campanha.';
  else if (rascunho.title.trim().length > TETO_DO_NOME) {
    campos.title = `No máximo ${TETO_DO_NOME} caracteres.`;
  }

  /*
   * O CÓDIGO É OBRIGATÓRIO. Ele parece opcional ("o cliente acha o cupom na
   * vitrine sem digitar"), e não é: `code` tem `min_length=1` e um validador
   * próprio que recusa só-espaços. Antes desse validador, o branco chegava ao
   * banco, batia no CHECK e voltava como "código já existe" — 409 para um cupom
   * que não existia.
   */
  const codigo = rascunho.code.trim();
  if (codigo === '') campos.code = 'O código é obrigatório.';
  else if (codigo.length > TETO_DO_CODIGO) {
    campos.code = `No máximo ${TETO_DO_CODIGO} caracteres.`;
  }

  if (rascunho.validFrom === '') campos.validFrom = 'Escolha quando a campanha começa.';
  if (rascunho.validUntil === '') campos.validUntil = 'Escolha quando a campanha termina.';
  if (
    rascunho.validFrom !== '' &&
    rascunho.validUntil !== '' &&
    rascunho.validUntil < rascunho.validFrom
  ) {
    campos.validUntil = 'A data final não pode ser anterior à inicial.';
  }

  const minimo = parseDecimal(rascunho.minOrderValue);
  if (!minimo.ok) campos.minOrderValue = minimo.message;

  /*
   * O TETO SÓ É CONFERIDO ONDE ELE EXISTE. Fora de percentual o campo não é
   * renderizado, e um erro num campo invisível trava o salvamento sem que haja
   * nada na tela para consertar.
   */
  if (aceitaTeto(arte ? tipoDaArte(arte) : null)) {
    const teto = parseDecimal(rascunho.maxDiscountAmount);
    if (!teto.ok) campos.maxDiscountAmount = teto.message;
  }

  const limites: [CouponField, string][] = [
    ['totalUsageLimit', rascunho.totalUsageLimit],
    ['usageLimitPerCustomer', rascunho.usageLimitPerCustomer],
    ['cooldownDays', rascunho.cooldownDays],
  ];
  for (const [campo, texto] of limites) {
    const lido = parseInteger(texto);
    if (!lido.ok) campos[campo] = lido.message;
    else if (lido.value === 0) campos[campo] = 'Precisa ser pelo menos 1. Deixe vazio para não limitar.';
  }

  /*
   * INTERVALO ENTRE USOS COM UM USO POR CLIENTE. O banco já recusava (o CHECK
   * `restaurant_coupons_reuse_rules_valid`), mas a recusa vinha de lá sem dizer
   * qual dos dois campos estava sobrando. Quem usa uma vez na vida não tem
   * segunda vez a esperar.
   */
  if (rascunho.cooldownDays.trim() !== '' && rascunho.usageLimitPerCustomer.trim() === '1') {
    campos.cooldownDays =
      'Com 1 uso por cliente não há segunda vez para esperar. Apague o intervalo ou aumente o limite por cliente.';
  }

  return { campos, geral: null };
}

/* ==========================================================================
 * A METADE QUE TRADUZ O QUE VOLTOU
 * ======================================================================= */

/** O nome do campo no contrato → o campo do formulário. */
const CAMPO_DO_CONTRATO: Record<string, CouponField> = {
  coupon_template_id: 'templateId',
  /*
   * `discount_type` E `discount_value` APONTAM PARA A ARTE, e não para um campo
   * de desconto — porque não existe campo de desconto nesta tela. O 422 de
   * `_ensure_template_agrees` fala de `discount_type`, e o que o lojista tem
   * para mexer é a arte escolhida. Mandá-lo procurar um campo que a tela não
   * tem seria o mesmo defeito dos 409 antes de `_raise_conflict` separá-los.
   */
  discount_type: 'templateId',
  discount_value: 'templateId',
  code: 'code',
  title: 'title',
  description: 'description',
  valid_from: 'validFrom',
  valid_until: 'validUntil',
  min_order_value: 'minOrderValue',
  max_discount_amount: 'maxDiscountAmount',
  total_usage_limit: 'totalUsageLimit',
  usage_limit_per_customer: 'usageLimitPerCustomer',
  cooldown_days: 'cooldownDays',
  first_order_only: 'firstOrderOnly',
  is_active: 'isActive',
};

/**
 * As regras que o backend valida sobre o OBJETO INTEIRO chegam sem campo.
 *
 * `model_validator(mode="after")` levanta o erro no modelo, não num campo, e o
 * `loc` que sai é só `["body"]`. Sem esta tabela as quatro regras cairiam todas
 * no aviso do rodapé, escritas como o backend as escreve — em ASCII e no
 * vocabulário do contrato ("valid_until deve ser posterior a valid_from"), que
 * não é o vocabulário de quem está olhando dois campos chamados "de" e "até".
 */
const REGRA_DO_MODELO: { padrao: RegExp; campo: CouponField; texto: string }[] = [
  {
    padrao: /valid_until/i,
    campo: 'validUntil',
    texto: 'A data final precisa ser depois da inicial.',
  },
  {
    padrao: /max_discount_amount/i,
    campo: 'maxDiscountAmount',
    texto: 'O teto de desconto só existe em campanha percentual.',
  },
  {
    padrao: /cooldown_days/i,
    campo: 'cooldownDays',
    texto:
      'Com 1 uso por cliente não há segunda vez para esperar. Apague o intervalo ou aumente o limite por cliente.',
  },
  {
    padrao: /discount_value/i,
    campo: 'templateId',
    texto: 'O valor desta arte não é aceito pelo backend. Escolha outra arte.',
  },
];

function lerLista(detalhe: unknown): { loc: unknown[]; msg: string }[] {
  if (!Array.isArray(detalhe)) return [];
  return detalhe.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const registro = item as Record<string, unknown>;
    const loc = Array.isArray(registro.loc) ? registro.loc : [];
    const msg = typeof registro.msg === 'string' ? registro.msg : '';
    return [{ loc, msg }];
  });
}

/**
 * A falha da API → o campo a destacar.
 *
 * TRÊS FAMÍLIAS, E ELAS NÃO TÊM A MESMA FORMA:
 *
 *   422  `detail` é LISTA, com `loc[1]` dizendo o campo (ou sem campo nenhum,
 *        quando a regra é do objeto inteiro — ver `REGRA_DO_MODELO`);
 *   409  `detail` é STRING, e são dois, com campos DIFERENTES. Separá-los
 *        importa: quem esbarrava na arte repetida lia "código já existe",
 *        trocava o código e tomava o mesmo erro de novo, sem saída;
 *   400  `detail` é STRING, uma só — a arte desativada. Ela vem ANTES do 422 de
 *        tipo de propósito: não adianta conferir a concordância de uma arte que
 *        saiu do catálogo.
 */
export function errosDaResposta(erro: unknown): ErrosDoCupom {
  if (!(erro instanceof ApiError)) {
    return { campos: {}, geral: messageFromUnknownError(erro) };
  }

  const corpo = (erro.body ?? {}) as Record<string, unknown>;
  const detalhe = corpo.detail;

  if (erro.status === 422) {
    const campos: Partial<Record<CouponField, string>> = {};
    const soltos: string[] = [];

    for (const item of lerLista(detalhe)) {
      const nome = typeof item.loc[1] === 'string' ? item.loc[1] : null;
      const campo = nome ? CAMPO_DO_CONTRATO[nome] : undefined;

      if (campo) {
        campos[campo] = item.msg;
        continue;
      }

      const regra = REGRA_DO_MODELO.find(({ padrao }) => padrao.test(item.msg));
      if (regra) campos[regra.campo] = regra.texto;
      else if (item.msg) soltos.push(item.msg);
    }

    if (Object.keys(campos).length > 0 || soltos.length > 0) {
      return { campos, geral: soltos.length > 0 ? soltos.join('; ') : null };
    }
  }

  if (typeof detalhe === 'string') {
    if (erro.status === 409 && /c[oó]digo de cupom/i.test(detalhe)) {
      return {
        campos: {
          code: 'Já existe um cupom com este código nesta loja. PROMO10 e promo10 contam como o mesmo.',
        },
        geral: null,
      };
    }
    if (erro.status === 409 && /arte/i.test(detalhe)) {
      return {
        campos: {
          templateId:
            'Esta arte já está em uso por outra campanha desta loja. Escolha outra — mexer no código não resolve.',
        },
        geral: null,
      };
    }
    if (erro.status === 400 && /template de cupom/i.test(detalhe)) {
      return {
        campos: {
          templateId: 'Esta arte saiu do catálogo da plataforma. Escolha outra para conseguir salvar.',
        },
        geral: null,
      };
    }
  }

  return { campos: {}, geral: erro.message };
}
