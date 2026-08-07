/** Formatação e rótulos da tela de pedidos. */

/**
 * Fuso da operação, igual ao PLATFORM_TIMEZONE do backend.
 *
 * Horário e "hoje" saem daqui e não do relógio do computador: um painel aberto
 * numa máquina com fuso errado mostraria o pedido na hora errada e o filtro de
 * hoje pegaria o dia do servidor, não o dia do lojista.
 */
export const OPERATION_TIMEZONE = 'America/Fortaleza';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: OPERATION_TIMEZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: OPERATION_TIMEZONE,
});

/** O total vem como number no JSON; o backend calcula, aqui só se exibe. */
export function formatCurrency(value: number | string): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return currencyFormatter.format(numeric);
}

export function formatTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  return timeFormatter.format(date);
}

export function formatDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

/** "há 12 min" — o que mais importa num pedido é há quanto tempo ele espera. */
export function formatElapsed(
  isoDate: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${String(minutes % 60).padStart(2, '0')}`;
  return `${Math.floor(hours / 24)}d`;
}

export const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: 'Entrega',
  pickup: 'Retirada',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  cash: 'Dinheiro',
  voucher: 'Voucher',
  meal_voucher: 'Vale-refeição',
  other: 'Outro',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  on_delivery: 'Paga na entrega',
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  failed: 'Pagamento recusado',
  refunded: 'Estornado',
};

export function labelFor(
  dictionary: Record<string, string>,
  key: string | null | undefined,
): string {
  if (!key) return '—';
  return dictionary[key] ?? key;
}

/** Data de hoje no fuso da operação, no formato AAAA-MM-DD que a API espera. */
export function todayInOperationTimezone(now: Date = new Date()): string {
  // 'en-CA' porque o formato dele já é AAAA-MM-DD; montar na mão a partir de
  // getFullYear/getMonth usaria o fuso da máquina, que é justamente o que
  // queremos evitar.
  return new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TIMEZONE }).format(now);
}

/** Data de N dias atrás, no mesmo formato. */
export function daysAgoInOperationTimezone(days: number, now: Date = new Date()): string {
  return todayInOperationTimezone(new Date(now.getTime() - days * 86_400_000));
}
