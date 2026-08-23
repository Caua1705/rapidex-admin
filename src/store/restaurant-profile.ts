/**
 * ============================================================================
 * OS DOIS TEXTOS DA MARCA — e a distinção entre eles é a tela inteira
 * ============================================================================
 *
 * `description` é VITRINE: sai em `RestaurantPublicResponse`, o cliente a lê no
 * cardápio e decide pedir por ela. Anúncio ali é o uso certo. Teto de 1000.
 *
 * `assistant_notes` é PROMPT: entra no contexto do assistente de IA como
 * "Sobre a casa: …" e não sai em resposta pública nenhuma. O que serve ali é o
 * oposto do anúncio — o que a casa faz, o que ela não faz, o que o atendente
 * precisa saber para não inventar. Teto de 300.
 *
 * Os dois eram O MESMO CAMPO até a revisão `20260823_0034` do backend. Foram
 * separados para que a tela pudesse instruir "não escreva anúncio aqui" sem
 * mentir sobre o que acontece com o texto — e é por isso que este arquivo
 * carrega a regra dos dois juntos, e não uma função genérica de campo de texto.
 *
 * ----------------------------------------------------------------------------
 * O TETO É 422, ENTÃO A CONTAGEM TEM DE SER A MESMA DO BACKEND
 * ----------------------------------------------------------------------------
 *
 * `maxLength` do Pydantic mede a string que CHEGOU. Como a tela apara o texto
 * antes de mandar (`textoGravavel`), o contador precisa medir o texto aparado —
 * senão ele diz 300/300 e o backend responde 422 por causa de um espaço no fim,
 * que é o pior desfecho possível para um contador: ele existe justamente para
 * PREVER a recusa.
 *
 * E NÃO EXISTE `maxLength` NO CAMPO. Ele impede digitar mas não impede colar:
 * colar 500 num campo de 300 descarta 200 em silêncio, que é exatamente a
 * queixa que separou estes dois campos. Aqui o texto passa do teto, o contador
 * acende e o Salvar recusa com a frase antes de o backend recusar com o número.
 *
 * ----------------------------------------------------------------------------
 * O TEXTO LEGADO — o caso que a Response deixa entrar
 * ----------------------------------------------------------------------------
 *
 * Os tetos existem só em `AdminRestaurantProfileUpdate`. A Response não os
 * declara, então um texto gravado antes da separação dos campos CHEGA na tela
 * acima do teto, sem ninguém ter digitado nada.
 *
 * A regra que sai daqui tem duas metades, e as duas importam:
 *
 *   - ele NÃO invalida o formulário. Campo vermelho na abertura acusa o lojista
 *     de um erro que não é dele, e trava a gravação do OUTRO campo por tabela;
 *   - ele TAMBÉM não passa em silêncio. Enquanto ninguém o toca, ele fica fora
 *     do corpo do PATCH (edição parcial: campo ausente não mexe), continua no
 *     ar como está, e a tela escreve na cara que ele está acima do teto e
 *     quantos caracteres faltam cortar.
 *
 * No instante em que o lojista encosta nele, ele vira campo alterado como
 * qualquer outro: acima do teto, erro e Salvar recusa.
 */
import type { RestaurantProfile, RestaurantProfileUpdate } from '../api/types';

/** Teto de `description` no corpo do PATCH. Acima disso, 422. */
export const DESCRICAO_MAX = 1000;

/** Teto de `assistant_notes` no corpo do PATCH. Acima disso, 422. */
export const NOTAS_MAX = 300;

export type ProfileDraft = {
  /** A vitrine: o cliente lê no cardápio. */
  descricao: string;
  /** O contexto do assistente: ninguém além dele lê. */
  notas: string;
};

export const PROFILE_VAZIO: ProfileDraft = { descricao: '', notas: '' };

/**
 * O texto como ele vai para o backend: aparado nas pontas.
 *
 * É a mesma função que a contagem usa, e essa coincidência é o ponto — ver o
 * cabeçalho.
 */
export function textoGravavel(valor: string): string {
  return valor.trim();
}

/** Nulo na resposta é "não há texto", nunca herança: acima do restaurante não há de quem herdar. */
export function draftDoPerfil(profile: RestaurantProfile): ProfileDraft {
  return {
    descricao: profile.description ?? '',
    notas: profile.assistant_notes ?? '',
  };
}

/**
 * O estado de um dos dois campos — o que a tela precisa saber para desenhá-lo.
 *
 * `bloqueia` é `alterado && acima`, e não só `acima`: é aqui que mora a regra do
 * texto legado descrita no cabeçalho.
 */
export type EstadoDoTexto = {
  /** Quantos caracteres o backend vai medir. */
  contagem: number;
  /** Quantos passam do teto. Zero quando cabe. */
  excedente: number;
  /** O lojista mexeu neste campo nesta visita? */
  alterado: boolean;
  /** Passou do teto E foi mexido: o Salvar recusa. */
  bloqueia: boolean;
  /** Passou do teto e NÃO foi mexido: veio assim do backend. */
  legado: boolean;
};

export function estadoDoTexto(atual: string, original: string, teto: number): EstadoDoTexto {
  const texto = textoGravavel(atual);
  const contagem = texto.length;
  const excedente = Math.max(0, contagem - teto);
  const alterado = texto !== textoGravavel(original);

  return {
    contagem,
    excedente,
    alterado,
    bloqueia: alterado && excedente > 0,
    legado: !alterado && excedente > 0,
  };
}

/**
 * O CORPO DO PATCH: só o que mudou.
 *
 * Devolve `null` quando não há nada a gravar — e quem chama usa isso como o
 * "sujo" da barra de salvar, para não haver duas contas de "há algo a salvar"
 * podendo divergir.
 *
 * VAZIO VIRA `null`, E `null` APAGA. Não é "voltar a herdar" como na filial:
 * acima do restaurante não há de quem herdar, e o backend é explícito — sem
 * `assistant_notes` o prompt sai sem a linha "Sobre a casa", e não com a
 * descrição no lugar dela.
 */
export function profilePayload(
  draft: ProfileDraft,
  baseline: ProfileDraft,
): RestaurantProfileUpdate | null {
  const body: RestaurantProfileUpdate = {};

  const descricao = estadoDoTexto(draft.descricao, baseline.descricao, DESCRICAO_MAX);
  if (descricao.alterado) body.description = textoGravavel(draft.descricao) || null;

  const notas = estadoDoTexto(draft.notas, baseline.notas, NOTAS_MAX);
  if (notas.alterado) body.assistant_notes = textoGravavel(draft.notas) || null;

  return descricao.alterado || notas.alterado ? body : null;
}

/**
 * A recusa que chega ANTES do 422 — e com o número que falta cortar.
 *
 * "Texto muito longo" manda o lojista contar caracteres à mão. O que ele
 * precisa saber é quantos sobram.
 */
export function problemaDoPerfil(draft: ProfileDraft, baseline: ProfileDraft): string | null {
  const descricao = estadoDoTexto(draft.descricao, baseline.descricao, DESCRICAO_MAX);
  if (descricao.bloqueia) {
    return `Descrição: ${corte(descricao.excedente)} — o teto é ${DESCRICAO_MAX}.`;
  }

  const notas = estadoDoTexto(draft.notas, baseline.notas, NOTAS_MAX);
  if (notas.bloqueia) {
    return `Anotações para o assistente: ${corte(notas.excedente)} — o teto é ${NOTAS_MAX}.`;
  }

  return null;
}

/** "corte 1 caractere" / "corte 112 caracteres". */
export function corte(excedente: number): string {
  return `corte ${excedente} ${excedente === 1 ? 'caractere' : 'caracteres'}`;
}
