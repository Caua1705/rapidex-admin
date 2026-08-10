/**
 * Há quanto tempo o pedido espera — a informação número um de uma tela de
 * cozinha.
 *
 * O QUE ELA RESPONDE: não "que horas o pedido entrou", mas "este aqui já
 * estourou?". Quem está na chapa não faz conta de subtração de relógio; precisa
 * que a tela já tenha feito.
 *
 * A RÉGUA É A FAIXA DE PREPARO DA FILIAL, e não um número fixo no código: 20
 * minutos é folgado para uma hamburgueria e apertado para uma pizzaria de forno
 * a lenha. A faixa vem da linha de horário do dia
 * (`GET /admin/branches/{id}/business-hours`), que é a mesma que o lojista
 * ajusta com os botões +5/−5 na tela de pedidos. Assim o alarme da cozinha e a
 * promessa feita ao cliente são o MESMO número — se fossem dois, a cozinha
 * ficaria tranquila enquanto o cliente já estava esperando além do combinado.
 *
 * Sem faixa gravada não há alarme: o cronômetro conta, mas nada fica vermelho.
 * Inventar um limite padrão pintaria de vermelho a cozinha inteira de quem
 * ainda não configurou o prazo, e um alarme que está sempre ligado não é
 * alarme.
 */
import { formatElapsed } from '../orders/format';

export type WaitLevel =
  /** Sem `created_at`: não há o que contar. */
  | 'unknown'
  /** Dentro do prazo — ou sem prazo gravado para comparar. */
  | 'ok'
  /** Entrou na janela de entrega: passou do mínimo, ainda dentro do máximo. */
  | 'due'
  /** Estourou o máximo prometido. */
  | 'late';

export type WaitReading = {
  /** Minutos inteiros de espera; `null` quando não há data. */
  minutes: number | null;
  level: WaitLevel;
  /** "agora", "12 min", "1h05" — pronto para a tela. */
  label: string;
};

export type PrepWindow = { prep_time_min: number; prep_time_max: number } | null;

/**
 * Lê a espera de um pedido.
 *
 * `now` entra por parâmetro para o cálculo ser testável sem mexer no relógio do
 * processo — e é o mesmo instante para todos os cartões de um render, senão
 * dois cartões criados no mesmo segundo mostrariam minutos diferentes.
 */
export function readWait(
  createdAt: string | null | undefined,
  prep: PrepWindow,
  now: number = Date.now(),
): WaitReading {
  if (!createdAt) return { minutes: null, level: 'unknown', label: '—' };

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return { minutes: null, level: 'unknown', label: '—' };

  /*
   * Nunca negativo. O relógio do navegador da cozinha pode estar minutos
   * adiantado em relação ao do servidor, e "−3 min" num monitor de parede lê
   * como defeito da tela — o pedido acabou de entrar, e é isso que se mostra.
   */
  const minutes = Math.max(0, Math.floor((now - created) / 60_000));
  const label = formatElapsed(createdAt, Math.max(now, created));

  return { minutes, level: levelFor(minutes, prep), label };
}

function levelFor(minutes: number, prep: PrepWindow): WaitLevel {
  if (!prep) return 'ok';
  if (minutes > prep.prep_time_max) return 'late';
  if (minutes >= prep.prep_time_min) return 'due';
  return 'ok';
}
