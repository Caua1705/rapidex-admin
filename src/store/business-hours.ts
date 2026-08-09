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
