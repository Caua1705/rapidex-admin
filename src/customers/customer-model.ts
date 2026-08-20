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
 * O TELEFONE REDUZIDO AO QUE IDENTIFICA A PESSOA — só dígitos, sem o país.
 *
 * Ele existe porque o telefone é a CHAVE desta lista (o backend agrupa por
 * ele), e a mesma pessoa chega em dois formatos: o `customer_phone_snapshot`
 * gravado no pedido e o `customer_phone` agrupado da lista de clientes. Um pode
 * ter vindo como "+55 85 99999-0000" e o outro como "85999990000", e comparar
 * as duas strings cruas diria que são duas pessoas.
 *
 * O 55 do país sai só quando o que sobra é um número brasileiro inteiro (10 ou
 * 11 dígitos): a condição do que SOBRA é o que impede a regra de comer o "55"
 * de um número que por acaso comece com ele. O que não casa sai como veio — um
 * número internacional é melhor comparado inteiro do que mutilado.
 */
export function phoneDigits(phone: string): string {
  const somenteDigitos = phone.replace(/\D/g, '');
  return somenteDigitos.startsWith('55') &&
    (somenteDigitos.length === 12 || somenteDigitos.length === 13)
    ? somenteDigitos.slice(2)
    : somenteDigitos;
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
  const digits = phoneDigits(phone);

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

/**
 * "Cliente há 1 ano · 12 pedidos" — a linha do histórico no detalhe do pedido.
 *
 * ELA RESPONDE UMA PERGUNTA SÓ: esta pessoa volta sempre? É a pergunta que o
 * lojista faz ANTES de aceitar, e a resposta muda o que ele faz com o pedido.
 *
 * TRÊS CASOS, TRÊS FRASES:
 *
 *   - QUEM ESTREIA ("Primeiro pedido"). `orders_count` 1 é a primeira compra, e
 *     dizer "Cliente há 0 dias · 1 pedido" seria a mesma informação escrita da
 *     forma mais fria possível. A frase curta é a que se lê de relance.
 *   - QUEM VOLTA. "Cliente há 3 meses · 12 pedidos". A distância vem primeiro
 *     porque é ela que separa o freguês do cliente de um mês.
 *   - QUEM NÃO TEM DATA. `first_order_at` é `string | null` no contrato, e sem
 *     ela sobra a contagem. Nada é estimado para preencher o buraco.
 *
 * "DESDE HOJE" E "DESDE ONTEM" existem porque `formatSince` devolve "hoje" e
 * "ontem", e "Cliente hoje" não é português. De 2 dias em diante ela devolve
 * "há N", que encaixa direto.
 *
 * A CONTAGEM INCLUI O PEDIDO ABERTO, e é assim que a tela de Clientes conta
 * também. Subtrair um daria um número que não bate com o da outra tela, e o
 * lojista teria dois totais para a mesma pessoa.
 */
export function customerHistoryLine(customer: CustomerListItem, now: number = Date.now()): string {
  if (customer.orders_count <= 1) return 'Primeiro pedido';

  const dias = daysSince(customer.first_order_at, now);
  const pedidos = `${customer.orders_count} pedidos`;
  if (dias === null) return pedidos;

  const tempo =
    dias === 0
      ? 'desde hoje'
      : dias === 1
        ? 'desde ontem'
        : formatSince(customer.first_order_at, now);
  return `Cliente ${tempo} · ${pedidos}`;
}
