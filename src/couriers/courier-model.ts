/**
 * ============================================================================
 * O CADASTRO DO ENTREGADOR — nome, telefone, e nada mais
 * ============================================================================
 *
 * "Nada mais" é escolha do contrato, e vale respeitar: é o que o dono sabe do
 * motoboy, e cada campo a mais é um que ninguém preenche. Os dois corpos
 * (`AdminCourierCreate` e `AdminCourierUpdate`) são `extra="forbid"` — uma
 * chave a mais não é ignorada, é 422.
 *
 * ----------------------------------------------------------------------------
 * A FILIAL SÓ EXISTE NO POST
 * ----------------------------------------------------------------------------
 *
 * Quem serve duas lojas tem DOIS cadastros, um por filial — não há entregador
 * de duas filiais, e o telefone é único DENTRO da filial. Por isso `branch_id`
 * está no corpo de criação e não no de edição: mandá-lo num PATCH é 422 pelo
 * `extra="forbid"`, e a leitura ingênua ("o campo existe na resposta, logo o
 * PATCH aceita") é o erro que a skill de API documenta em `printing_sector_id`.
 */
import { ApiError, messageFromUnknownError } from '../api/errors';
import { formatPhone, phoneDigits } from '../customers/customer-model';
import type { Courier, CourierCreate, CourierUpdate } from '../api/types';

export type CourierDraft = {
  name: string;
  phone: string;
};

export const RASCUNHO_NOVO: CourierDraft = { name: '', phone: '' };

/**
 * OS LIMITES QUE O `/openapi.json` NÃO PUBLICA.
 *
 * `Field(min_length=…)` e `field_validator` do Pydantic não atravessam a
 * geração: o contrato diz `string` e o TypeScript concorda com qualquer coisa.
 * Estão aqui, num lugar só e com a origem nomeada, porque a alternativa é o
 * lojista descobrir a regra por um 422 no meio do cadastro.
 *
 * Origem: `src/schemas/courier_schema.py` do backend —
 * `MAX_COURIER_NAME_LENGTH = 120` e `MIN_PHONE_DIGITS = 8`.
 */
export const NOME_MAX = 120;
export const TELEFONE_MIN_DIGITOS = 8;

export type CampoDoEntregador = 'name' | 'phone';

export type CorpoDoEntregador<T> =
  { ok: true; body: T } | { ok: false; campo: CampoDoEntregador; message: string };

/**
 * A conferência dos dois campos, uma vez, para os dois corpos.
 *
 * O TELEFONE É CONTADO EM DÍGITOS, e não em caracteres. O backend cobra as
 * duas coisas — `min_length=8` sobre a string crua e `_phone_digits` sobre o
 * que sobra —, e é a segunda que pega o caso real: "(85) 9999-999" tem treze
 * caracteres e sete dígitos. Contar caracteres aqui deixaria passar o que o
 * servidor recusa, que é a definição de um falso mais frouxo, agora do lado da
 * tela.
 */
function conferir(draft: CourierDraft): CorpoDoEntregador<{ name: string; phone: string }> {
  const name = draft.name.trim();
  if (!name) return { ok: false, campo: 'name', message: 'Escreva o nome do entregador.' };
  if (name.length > NOME_MAX) {
    return { ok: false, campo: 'name', message: `O nome vai até ${NOME_MAX} caracteres.` };
  }

  const phone = phoneDigits(draft.phone);
  if (phone.length < TELEFONE_MIN_DIGITOS) {
    return {
      ok: false,
      campo: 'phone',
      message: `O telefone precisa de pelo menos ${TELEFONE_MIN_DIGITOS} dígitos.`,
    };
  }

  return { ok: true, body: { name, phone } };
}

/** O corpo do POST. A filial entra aqui, e só aqui. */
export function corpoDeCriacao(
  draft: CourierDraft,
  branchId: string,
): CorpoDoEntregador<CourierCreate> {
  const conferido = conferir(draft);
  if (!conferido.ok) return conferido;
  return { ok: true, body: { branch_id: branchId, ...conferido.body } };
}

/**
 * O corpo do PATCH: só o que MUDOU, e nunca a filial.
 *
 * O TELEFONE COMPARA POR DÍGITO. Reescrever "(85) 99999-0000" sobre o mesmo
 * número já gravado não é mudança — e mandá-lo assim mesmo faria o backend
 * conferir repetição contra a própria linha do entregador, que é um 409 sobre
 * uma edição que não editou nada.
 */
export function corpoDeEdicao(
  draft: CourierDraft,
  atual: Courier,
): CorpoDoEntregador<CourierUpdate> {
  const conferido = conferir(draft);
  if (!conferido.ok) return conferido;

  const body: CourierUpdate = {};
  if (conferido.body.name !== atual.name) body.name = conferido.body.name;
  if (conferido.body.phone !== phoneDigits(atual.phone)) body.phone = conferido.body.phone;
  return { ok: true, body };
}

/** Resposta → campos do formulário. O telefone volta legível, não em dígitos. */
export function rascunhoDe(courier: Courier): CourierDraft {
  return { name: courier.name, phone: formatPhone(courier.phone) };
}

export type ErrosDoEntregador = {
  campos: Partial<Record<CampoDoEntregador, string>>;
  geral: string | null;
};

/**
 * O erro da rota, no lugar onde ele se resolve.
 *
 * O 409 DESTAS DUAS ROTAS É SEMPRE O TELEFONE REPETIDO — é o único conflito que
 * `POST /admin/couriers` e `PATCH /admin/couriers/{id}` emitem. A frase vem
 * pronta e em português do backend; o que a tela decide é ONDE mostrá-la, e um
 * erro de campo no rodapé faz a pessoa reler o formulário inteiro procurando o
 * que está errado.
 *
 * A DECISÃO SAI DO STATUS, NÃO DO TEXTO. Casar a frase do backend seria um
 * acordo que se desfaz no dia em que alguém corrigir uma vírgula lá — e se
 * desfaz em silêncio, com o erro voltando para o rodapé.
 *
 * Os outros 409 do domínio (entregador inativo, pedido sem ninguém) são de
 * OUTRAS rotas e não passam por aqui.
 */
export function errosDoEntregador(erro: unknown): ErrosDoEntregador {
  if (erro instanceof ApiError && erro.status === 409) {
    return { campos: { phone: erro.message }, geral: null };
  }
  return { campos: {}, geral: messageFromUnknownError(erro) };
}

/**
 * O que a linha diz sobre o acesso — e o que ela NÃO promete.
 *
 * O par link+código saiu uma vez só, em claro, na resposta da geração. A tela
 * não tem como mostrá-lo de novo, então ela não oferece: "ver acesso" seria um
 * botão que decepciona, e decepcionar aqui custa uma ligação ao suporte.
 */
export function textoDoAcesso(courier: Courier): string {
  return courier.has_access ? 'Acesso gerado' : 'Sem acesso';
}
