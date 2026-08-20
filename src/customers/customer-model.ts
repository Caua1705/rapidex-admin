/**
 * A lógica da tela de clientes — o que se pode errar sem o compilador ver.
 *
 * A tela em si só monta linhas; o que mora aqui é a leitura de "há quanto
 * tempo" e a do telefone, que são as duas coisas que o lojista confere de
 * relance e as duas que ficariam erradas em silêncio.
 */
import { OPERATION_TIMEZONE } from '../orders/format';
import type { CustomerListItem } from '../api/types';

/**
 * A CHAVE DA LINHA É O TELEFONE.
 *
 * `AdminCustomerListItem` não tem `id` — o backend agrupa por telefone, e é o
 * telefone que identifica a pessoa nesta lista. Usar o índice do array como
 * chave do React faria as linhas trocarem de identidade a cada "Carregar
 * mais", que é como uma lista paginada começa a piscar conteúdo errado.
 */
export function customerKey(customer: CustomerListItem): string {
  return customer.customer_phone;
}

/**
 * O DIA DA OPERAÇÃO de um instante ISO, em AAAA-MM-DD.
 *
 * Existe porque "há quantos dias" não é uma divisão por 86.400.000: um pedido
 * das 23h de ontem e um das 01h de hoje têm duas horas de diferença e são dois
 * DIAS diferentes para quem opera a loja. A conta é feita entre dias-calendário
 * no fuso da operação (America/Fortaleza), não entre carimbos de tempo.
 */
function operationDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TIMEZONE }).format(date);
}

/** Meio-dia UTC do dia: uma âncora que nenhum fuso empurra para o dia vizinho. */
function noonOf(day: string): number {
  return Date.parse(`${day}T12:00:00Z`);
}

/**
 * Quantos dias da operação separam o instante de agora. `null` quando não dá
 * para saber (o campo é `string | null` no contrato — cliente sem pedido
 * registrado existe).
 *
 * Nunca negativo: um carimbo à frente do relógio local é problema de relógio,
 * e "há −2 dias" não é uma frase que ajude ninguém.
 */
export function daysSince(
  isoDate: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  const diff = noonOf(operationDay(new Date(now))) - noonOf(operationDay(date));
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.round(diff / 86_400_000));
}

/**
 * "hoje", "ontem", "há 12 dias", "há 3 meses", "há 2 anos".
 *
 * A tela pergunta "a quem vale a pena chamar de volta", e essa pergunta se
 * responde comparando distâncias, não lendo datas: numa lista de cinquenta
 * linhas de `12/03/2026`, achar quem sumiu custa uma subtração por linha.
 *
 * O mês tem 30 dias e o ano tem 365 de propósito. Não é imprecisão escondida:
 * a partir de "há 2 meses" a diferença entre 60 e 61 dias não muda decisão
 * nenhuma, e é a coluna de PRIMEIRO pedido que carrega a data exata.
 */
export function formatSince(isoDate: string | null | undefined, now: number = Date.now()): string {
  const days = daysSince(isoDate, now);
  if (days === null) return '—';
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'há 1 mês' : `há ${months} meses`;

  const years = Math.floor(days / 365);
  return years === 1 ? 'há 1 ano' : `há ${years} anos`;
}

/**
 * "(85) 99999-0000".
 *
 * O telefone é o ÚNICO canal de contato que esta tela tem — e-mail e CPF não
 * vêm da rota, de propósito. Ele é lido em voz alta para discar, então sai
 * agrupado; um bloco de onze dígitos corridos obriga a pessoa a contar com o
 * dedo na tela.
 *
 * ELE NÃO LEVA `.tnum` (§1 da skill de design): telefone está na lista literal
 * do que não é número comparável descendo uma coluna.
 *
 * O que não casa com 10 ou 11 dígitos sai como veio. Um número internacional,
 * ou um cadastro velho pela metade, é melhor exibido cru do que remontado
 * errado num formato brasileiro que ele não tem.
 */
export function formatPhone(phone: string): string {
  const somenteDigitos = phone.replace(/\D/g, '');

  /*
   * O 55 do país sai ANTES da conta, e só quando o que sobra é um número
   * brasileiro inteiro (10 ou 11 dígitos). Um cadastro salvo como
   * "+5585999990000" tem treze dígitos e cairia no passe-adiante abaixo,
   * saindo na tela como um bloco corrido — que é exatamente o que esta função
   * existe para evitar. A condição do que sobra é o que impede a regra de
   * comer o "55" de um número que por acaso comece com ele.
   */
  const digits =
    somenteDigitos.startsWith('55') &&
    (somenteDigitos.length === 12 || somenteDigitos.length === 13)
      ? somenteDigitos.slice(2)
      : somenteDigitos;

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * O nome que aparece na linha.
 *
 * Cliente sem nome cadastrado existe (compra por telefone, no balcão), e a
 * linha em branco leria como falha de carregamento. O telefone já está na
 * linha de baixo, então aqui vale dizer o que a ausência é.
 */
export function customerName(customer: CustomerListItem): string {
  return customer.customer_name.trim() || 'Sem nome';
}
