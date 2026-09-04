/**
 * ============================================================================
 * OS GRUPOS DE COMPLEMENTO — as regras, sem tela e sem rede
 * ============================================================================
 *
 * O painel LIA os grupos e só sabia ligar e desligar uma opção que já existia.
 * Não criava grupo, não criava opção, não mudava `is_required`, `min_select`,
 * `max_select` nem o preço de um adicional — e as quatro rotas estavam prontas
 * no backend desde antes.
 *
 * O QUE ISSO CUSTAVA: montar uma pizza com "Escolha o tamanho" (obrigatório,
 * 1 de 1) e "Adicionais" (opcional, até 5) era um chamado para o suporte. Não é
 * caso raro — é o cardápio de qualquer pizzaria, hamburgueria ou açaí, os três
 * formatos que mais entram numa plataforma dessas. Era a diferença entre o
 * lojista montar o cardápio sozinho e o cardápio ser um serviço que alguém
 * presta para ele.
 *
 * ============================================================================
 * OS NÚMEROS SÃO ESCRITOS À MÃO, E ISSO NÃO CONTRARIA A REGRA DO CONTRATO
 * ============================================================================
 *
 * Nada de contrato se escreve à mão neste repositório. Estas regras não são
 * contrato: **elas não existem no `/openapi.json`.** O gerador publica `name`
 * como `string`, `min_select` e `max_select` como inteiros soltos, e a
 * validação cruzada mora num `model_validator` do Pydantic, que não vira
 * schema. Mesma situação de `cancel-reason.ts` e de `erro/error-report.ts`, e a
 * mesma decisão: escritas aqui, num lugar só, com a origem nomeada.
 *
 * As duas cruzadas, de `AdminOptionGroupFields.validate_selection_limits`:
 *
 *   1. `max_select >= min_select`;
 *   2. `is_required` exige `min_select >= 1` — e o backend explica por quê: um
 *      grupo obrigatório com mínimo zero faria o PEDIDO ser recusado na criação
 *      sem que o cardápio conseguisse dizer o que falta escolher.
 *
 * Conferir aqui não é desconfiança do backend: é o lojista ver o limite ANTES
 * de preencher seis campos e levar 422 no clique.
 */
import type { ProductOption, ProductOptionGroup } from '../api/types';
import { parsePriceInput } from './menu-model';

/** `name`: `min_length=1, max_length=120` no Pydantic. Não sai no contrato. */
export const GRUPO_NOME_MAX = 120;
/** `description`: `max_length=500`. Idem, e vale para grupo e para opção. */
export const GRUPO_DESCRICAO_MAX = 500;

export type GrupoDraft = {
  name: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  /** Texto, porque vem de um campo. Vira inteiro em `checkGrupo`. */
  minSelect: string;
  maxSelect: string;
  /**
   * A posição do grupo — e ela pode ser NULA.
   *
   * `sort_order` é `number | null` no contrato. Ela é CARREGADA, não
   * decidida aqui: o formulário edita nome e regras, e mexer na posição de
   * um grupo que ninguém arrastou é a tela reordenando o cardápio por conta
   * própria.
   */
  sortOrder: number | null;
};

export type OpcaoDraft = {
  name: string;
  description: string;
  /** Texto com vírgula, como todo campo de dinheiro do painel. */
  price: string;
};

/**
 * Os valores que o backend usa quando o campo não vem: 0 a 1, opcional.
 *
 * @param sortOrder A posição do grupo novo — normalmente quantos o produto já
 * tem, para ele entrar no FIM. Sem isso todo grupo nascia com `0` e dois
 * criados em seguida empatavam na primeira posição, com a ordem final
 * decidida pelo banco.
 */
export function grupoVazio(sortOrder = 0): GrupoDraft {
  return {
    name: '',
    description: '',
    isRequired: false,
    isActive: true,
    minSelect: '0',
    maxSelect: '1',
    sortOrder,
  };
}

export function opcaoVazia(): OpcaoDraft {
  return { name: '', description: '', price: '' };
}

/** O grupo da API no formato do formulário. */
export function grupoDraftDe(group: ProductOptionGroup): GrupoDraft {
  return {
    name: group.name,
    description: group.description ?? '',
    isRequired: group.is_required,
    isActive: group.is_active,
    minSelect: String(group.min_select),
    maxSelect: String(group.max_select),
    /*
     * A POSIÇÃO GRAVADA ATRAVESSA INTACTA, INCLUSIVE NULA.
     *
     * Aqui havia um `?? 0` com um comentário dizendo que nulo era "o fim da
     * lista" — e zero é o COMEÇO. Editar o nome de um grupo sem posição o
     * mandava para a frente do cardápio, sem ninguém ter arrastado nada, e o
     * comentário garantia que a próxima pessoa não olharia. Mesma família do
     * `new Date(null)`, que é a época e não `NaN`.
     */
    sortOrder: group.sort_order,
  };
}

/** O corpo que vai para o backend, já com os tipos dele. */
export type GrupoBody = {
  name: string;
  description: string | null;
  is_required: boolean;
  is_active: boolean;
  min_select: number;
  max_select: number;
  sort_order: number | null;
};

export type OpcaoBody = {
  name: string;
  description: string | null;
  additional_price: number;
  is_active: boolean;
  sort_order: number;
};

type Check<T, K extends string> =
  ({ valid: true } & Record<K, T>) | { valid: false; message: string | null };

/** Inteiro não negativo, e nada mais: "1,5" e "dois" não passam. */
function inteiro(raw: string): number | null {
  const texto = raw.trim();
  if (!/^\d+$/.test(texto)) return null;
  const valor = Number(texto);
  return Number.isSafeInteger(valor) ? valor : null;
}

/**
 * `message: null` é o campo ainda vazio: não há erro a mostrar antes de o
 * lojista digitar a primeira letra, só o botão travado. Mesma convenção de
 * `checkCancelReason`.
 */
export function checkGrupo(draft: GrupoDraft): Check<GrupoBody, 'grupo'> {
  const name = draft.name.trim();
  if (name === '') return { valid: false, message: null };
  if (name.length > GRUPO_NOME_MAX) {
    return { valid: false, message: `O nome passa de ${GRUPO_NOME_MAX} caracteres.` };
  }

  const description = draft.description.trim();
  if (description.length > GRUPO_DESCRICAO_MAX) {
    return { valid: false, message: `A descrição passa de ${GRUPO_DESCRICAO_MAX} caracteres.` };
  }

  const min = inteiro(draft.minSelect);
  const max = inteiro(draft.maxSelect);
  if (min === null) return { valid: false, message: 'O mínimo precisa ser um número inteiro.' };
  if (max === null) return { valid: false, message: 'O máximo precisa ser um número inteiro.' };
  // `ge=1` no Pydantic: um grupo que não deixa escolher nada não é um grupo.
  if (max < 1) return { valid: false, message: 'O máximo precisa ser pelo menos 1.' };
  if (max < min) {
    return { valid: false, message: 'O máximo não pode ser menor que o mínimo.' };
  }

  /*
   * A REGRA QUE O LOJISTA NÃO ADIVINHA, e por isso a frase diz o que fazer em
   * vez de só recusar. O backend a explica: obrigatório com mínimo zero faria o
   * PEDIDO ser recusado na criação, sem o cardápio conseguir dizer o que falta.
   */
  if (draft.isRequired && min < 1) {
    return {
      valid: false,
      message:
        'Grupo obrigatório precisa de mínimo 1 — senão não há o que o cliente tenha de escolher.',
    };
  }

  return {
    valid: true,
    grupo: {
      name,
      description: description === '' ? null : description,
      is_required: draft.isRequired,
      is_active: draft.isActive,
      min_select: min,
      max_select: max,
      sort_order: draft.sortOrder,
    },
  };
}

/**
 * O corpo do PATCH — E ELE LEVA O FORMULÁRIO INTEIRO.
 *
 * Não é preguiça de calcular o diff: **o backend valida o RESULTADO DA MESCLA**
 * com o que está no banco. Um PATCH que mandasse só `is_required: true` num
 * grupo cujo `min_select` gravado é 0 voltaria 422 por causa de um campo que a
 * tela não mostrou no corpo. Mandando os sete, o que o painel validou é
 * exatamente o que o backend vai validar — e some a classe inteira de "campo
 * que sumiu do corpo do PATCH".
 */
export function corpoDoGrupo(grupo: GrupoBody): GrupoBody {
  return { ...grupo };
}

/**
 * @param sortOrder A posição da opção nova no grupo — normalmente quantas já
 * existem, para ela entrar no FIM. Sem isso toda opção nasceria com `0` e a
 * ordem da lista viraria a do banco, que não é a que o lojista montou.
 */
export function checkOpcao(draft: OpcaoDraft, sortOrder = 0): Check<OpcaoBody, 'opcao'> {
  const name = draft.name.trim();
  if (name === '') return { valid: false, message: null };
  if (name.length > GRUPO_NOME_MAX) {
    return { valid: false, message: `O nome passa de ${GRUPO_NOME_MAX} caracteres.` };
  }

  const description = draft.description.trim();
  if (description.length > GRUPO_DESCRICAO_MAX) {
    return { valid: false, message: `A descrição passa de ${GRUPO_DESCRICAO_MAX} caracteres.` };
  }

  /*
   * SEM PREÇO É ZERO, e não é erro: a maior parte das opções não custa nada
   * ("Ponto da carne: mal passada"). Exigir "0" digitado seria pedágio no campo
   * que quase sempre fica vazio.
   */
  const price = draft.price.trim();
  const additional = price === '' ? 0 : parsePriceInput(price);
  if (additional === null) {
    return { valid: false, message: 'O preço adicional precisa ser um número — use vírgula.' };
  }

  return {
    valid: true,
    opcao: {
      name,
      description: description === '' ? null : description,
      /*
       * NÚMERO, e não string. O contrato aceita `number | string` na entrada,
       * e o vizinho decide: `price` do produto atravessa como número no mesmo
       * módulo (`useMenu`). Dois formatos de dinheiro no mesmo cardápio é como
       * um dos dois começa a chegar errado.
       */
      additional_price: additional,
      is_active: true,
      sort_order: sortOrder,
    },
  };
}

/**
 * A regra do grupo em português, para a linha da lista.
 *
 * "obrigatório · escolhe de 1 a 1" é verdade e não se entende. O lojista
 * precisa reconhecer o que ele configurou de relance, e as três formas que
 * importam são "escolha 1", "escolha de X a Y" e "até N".
 *
 * DESATIVADO VEM PRIMEIRO porque é o que explica a tela: um grupo desligado não
 * aparece para o cliente, e essa é a informação que responde "por que o
 * complemento sumiu do app?".
 */
/**
 * Troca UMA opção pela versão que o backend devolveu, sem tocar no resto.
 *
 * Existe porque `PATCH /admin/options/{id}` responde a OPÇÃO — ela é a verdade
 * mais fresca que a tela tem sobre aquela linha, e aplicá-la é o que permite a
 * releitura que vem depois falhar sem desmentir a gravação (ver
 * `alternarOpcao`). O que a releitura acrescenta é o efeito INDIRETO: se este
 * clique esvaziou um grupo obrigatório, quem sabe disso é o produto, não a
 * opção.
 *
 * `null` entra e sai `null`: sem lista lida não há o que trocar, e inventar um
 * grupo aqui apagaria a distinção entre "não tem" e "não deu para ler" que o §6
 * de `ausencia.md` custou para existir.
 */
export function comOpcaoTrocada(
  grupos: ProductOptionGroup[] | null,
  opcao: ProductOption,
): ProductOptionGroup[] | null {
  if (grupos === null) return null;
  return grupos.map((grupo) => {
    if (!grupo.options?.some((item) => item.id === opcao.id)) return grupo;
    return {
      ...grupo,
      options: grupo.options.map((item) => (item.id === opcao.id ? opcao : item)),
    };
  });
}

export function regraDoGrupo(group: ProductOptionGroup): string {
  const partes: string[] = [];
  if (!group.is_active) partes.push('Desativado');

  partes.push(group.is_required ? 'Obrigatório' : 'Opcional');

  if (group.is_required) {
    partes.push(
      group.min_select === group.max_select
        ? `escolha ${group.min_select}`
        : `escolha de ${group.min_select} a ${group.max_select}`,
    );
  } else {
    partes.push(`até ${group.max_select}`);
  }

  return partes.join(' · ');
}
