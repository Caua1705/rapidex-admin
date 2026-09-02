/**
 * A semana de funcionamento da filial.
 *
 * A REGRA QUE MANDA NESTE ARQUIVO: o PUT substitui a semana inteira e **dia
 * ausente da lista = dia fechado**. Mandar só os dias que o lojista mexeu não
 * edita de menos — apaga o resto da semana. Por isso `weekPayload` sempre
 * devolve os 7 dias, inclusive os fechados, e é a única função que quem salva
 * deve usar para montar o corpo.
 *
 * `weekday` segue o 0 = segunda do backend (`datetime.weekday()` do Python),
 * que NÃO é o 0 = domingo do JavaScript. Trocar os dois em silêncio faria a
 * loja abrir no dia errado, então a lista de rótulos abaixo é a única fonte.
 */
import type { BusinessHour, BusinessHourInput } from '../api/types';
import { OPERATION_TIMEZONE } from '../orders/format';

/** Segunda a domingo, na ordem em que a grade aparece na tela. */
export const WEEKDAYS: readonly { weekday: number; label: string; short: string }[] = [
  { weekday: 0, label: 'Segunda-feira', short: 'Seg' },
  { weekday: 1, label: 'Terça-feira', short: 'Ter' },
  { weekday: 2, label: 'Quarta-feira', short: 'Qua' },
  { weekday: 3, label: 'Quinta-feira', short: 'Qui' },
  { weekday: 4, label: 'Sexta-feira', short: 'Sex' },
  { weekday: 5, label: 'Sábado', short: 'Sáb' },
  { weekday: 6, label: 'Domingo', short: 'Dom' },
];

/**
 * O dia de hoje na numeração do BACKEND.
 *
 * `Date#getDay()` conta 0 = domingo; o backend conta 0 = segunda. Sem esta
 * conversão, toda leitura por dia sai deslocada em um — e o erro é silencioso,
 * porque o número existe nos dois lados e nenhum dos dois reclama.
 */
export function backendWeekday(date: Date): number {
  // fuso-ok: converte a NUMERAÇÃO de uma data que quem chama já escolheu, e
  // responde no fuso dela. Para "que dia é hoje" use `weekdayDaOperacao` logo
  // abaixo — foi essa distinção que custou o prazo de preparo do dia errado.
  return (date.getDay() + 6) % 7;
}

/**
 * Que dia da semana é HOJE para a LOJA — e não para o aparelho.
 *
 * `backendWeekday(new Date())` responde no fuso do navegador, e era assim que o
 * painel lia o dia. Num aparelho com o fuso errado — o tablet de balcão em modo
 * quiosque, o notebook trazido de outro estado — o painel lê a linha de horário
 * do dia ERRADO: mostra o prazo de preparo de terça numa segunda, e a diferença
 * é silenciosa porque os dois números existem e nenhum dos dois reclama.
 *
 * É a mesma armadilha do `notaDaPausa`, e a mesma da linha 2 do CLAUDE.md com
 * uma volta a mais: lá o perigo era 0 = segunda contra 0 = domingo; aqui é QUAL
 * dia, antes ainda de numerá-lo.
 *
 * A conta passa pelo TEXTO da data no fuso da operação e não por uma soma de
 * horas: `America/Fortaleza` não tem horário de verão hoje, mas somar três
 * horas na mão é a linha que ninguém revisita no dia em que isso mudar.
 */
export function weekdayDaOperacao(now: Date = new Date()): number {
  // 'en-CA' dá AAAA-MM-DD; construir a data com "T12:00:00Z" a põe no meio do
  // dia, longe das duas bordas em que um erro de uma hora viraria outro dia.
  const diaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TIMEZONE }).format(now);
  return backendWeekday(new Date(`${diaLocal}T12:00:00Z`));
}

/**
 * A faixa de preparo que vale HOJE, lida da semana de funcionamento.
 *
 * O prazo de preparo mora na linha de horário do dia — é por isso que o PATCH
 * de prep-time devolve um `BusinessHourResponse`. Aqui é o caminho de leitura:
 * sem ele, a barra de pedidos só saberia a faixa DEPOIS do primeiro ajuste.
 *
 * Devolve `null` quando o dia não tem as duas pontas: meia faixa não é faixa, e
 * mostrar só o mínimo faria o lojista ler "25 min" como promessa fechada.
 */
export function prepTimeForDay(
  hours: readonly BusinessHour[],
  weekday: number,
): { prep_time_min: number; prep_time_max: number } | null {
  const found = hours.find(
    (hour) =>
      hour.weekday === weekday &&
      typeof hour.prep_time_min === 'number' &&
      typeof hour.prep_time_max === 'number',
  );
  if (!found) return null;

  return { prep_time_min: found.prep_time_min!, prep_time_max: found.prep_time_max! };
}

/** Uma linha da grade: o que a tela edita. */
export type DayDraft = {
  weekday: number;
  isClosed: boolean;
  /** "HH:MM" — o que o <input type="time"> devolve. */
  opensAt: string;
  closesAt: string;
};

/** Corta o segundo que o backend manda ("18:00:00" → "18:00"). */
function toInputTime(raw: string | null | undefined): string {
  if (!raw) return '';
  const match = /^(\d{2}):(\d{2})/.exec(raw.trim());
  return match ? `${match[1]}:${match[2]}` : '';
}

/** "18:00" → "18:00:00", que é o formato que o backend grava. */
function toApiTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

const CLOSED_DAY = (weekday: number): DayDraft => ({
  weekday,
  isClosed: true,
  opensAt: '',
  closesAt: '',
});

/**
 * A resposta do backend → as 7 linhas da grade.
 *
 * Dia que não veio na resposta entra FECHADO, e não em branco: é exatamente o
 * que ele significa do outro lado, e uma linha vazia faria o lojista achar que
 * o horário se perdeu.
 *
 * Se o mesmo dia vier com mais de uma faixa (almoço e jantar), a grade fica com
 * a primeira. É uma limitação real desta tela — uma linha por dia — e não um
 * descuido: a segunda faixa continua no backend até o lojista salvar, e por
 * isso `hasMultiplePeriods` avisa antes que salvar apague a outra.
 */
export function weekFromResponse(hours: readonly BusinessHour[]): DayDraft[] {
  return WEEKDAYS.map(({ weekday }) => {
    const found = hours.find((hour) => hour.weekday === weekday);
    if (!found || found.is_closed) return CLOSED_DAY(weekday);

    return {
      weekday,
      isClosed: false,
      opensAt: toInputTime(found.opens_at),
      closesAt: toInputTime(found.closes_at),
    };
  });
}

/** Algum dia tem mais de uma faixa? Então salvar por esta tela perde uma. */
export function hasMultiplePeriods(hours: readonly BusinessHour[]): boolean {
  const seen = new Set<number>();
  return hours.some((hour) => {
    if (hour.is_closed) return false;
    if (seen.has(hour.weekday)) return true;
    seen.add(hour.weekday);
    return false;
  });
}

export type WeekProblem = { weekday: number; message: string };

/**
 * O que impede de salvar.
 *
 * Só o essencial: dia aberto precisa das duas pontas. Faixa que vira a noite
 * (18:00 às 02:00) é VÁLIDA e não entra aqui — o backend a entende, e barrá-la
 * quebraria justamente as lojas que abrem à noite.
 */
export function validateWeek(week: readonly DayDraft[]): WeekProblem[] {
  const problems: WeekProblem[] = [];

  week.forEach((day) => {
    if (day.isClosed) return;

    const opens = toApiTime(day.opensAt);
    const closes = toApiTime(day.closesAt);
    if (!opens || !closes) {
      problems.push({
        weekday: day.weekday,
        message: 'Informe a hora de abrir e a de fechar, ou marque o dia como fechado.',
      });
      return;
    }
    if (opens === closes) {
      problems.push({
        weekday: day.weekday,
        message: 'Abrir e fechar não podem ser no mesmo horário.',
      });
    }
  });

  return problems;
}

/**
 * O corpo do PUT: SEMPRE os 7 dias.
 *
 * Existe como função própria — em vez de um `.map()` solto na tela — porque o
 * erro que ela previne é silencioso: mandar só os dias abertos passa no
 * TypeScript, devolve 200, e fecha o resto da semana sem avisar ninguém.
 */
export function weekPayload(week: readonly DayDraft[]): BusinessHourInput[] {
  return WEEKDAYS.map(({ weekday }) => {
    const day = week.find((candidate) => candidate.weekday === weekday);

    if (!day || day.isClosed) {
      return { weekday, is_closed: true };
    }

    return {
      weekday,
      is_closed: false,
      opens_at: toApiTime(day.opensAt),
      closes_at: toApiTime(day.closesAt),
    };
  });
}

/** "18:00 às 23:30" ou "Fechado", para a leitura de relance da grade. */
export function formatDayRange(day: DayDraft): string {
  if (day.isClosed) return 'Fechado';
  if (!day.opensAt || !day.closesAt) return 'Incompleto';
  return `${day.opensAt} às ${day.closesAt}`;
}
