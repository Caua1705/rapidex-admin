/**
 * ============================================================================
 * A REGRA DE CASHBACK: DA RESPOSTA PARA O FORMULÁRIO, E DE VOLTA
 * ============================================================================
 *
 * Este arquivo existe por causa de quatro coisas que o `npm run typecheck` não
 * pega — todas compilam, todas dão 200, e todas erram dinheiro:
 *
 *   1. `weekday` é 0 = SEGUNDA. O `getDay()` do JavaScript é 0 = domingo, e o
 *      painel que mandar o número do JS grava a terça de 10% na segunda.
 *   2. DIA AUSENTE DE `weekdays` HERDA `default_percent`, NUNCA ZERO — e isso é
 *      a inversão deliberada em relação ao `PUT` de horários, onde dia ausente
 *      significa dia FECHADO. Um `weekPayload`-como-o-de-horários aqui, que
 *      manda os sete dias sempre, transformaria "os outros seis herdam" em "os
 *      outros seis valem o que está na caixa".
 *   3. `weekdays` SUBSTITUI a lista inteira. Não há edição de um dia só.
 *   4. Percentual e dinheiro são STRING DE DUAS CASAS. `Numeric(5,2)` promete
 *      duas casas, e `10.00` como número JSON vira `10.0`.
 *
 * A 2 e a 3 juntas são a armadilha de verdade: elas se parecem com as regras de
 * `business-hours.ts` e significam o oposto. Lá, dia fora da lista é dia
 * fechado e por isso o corpo leva sempre os sete. Aqui, dia fora da lista é dia
 * que HERDA — e levar os sete sempre seria congelar o percentual de todos eles,
 * matando a única alavanca que a regra tem.
 */
import type {
  CashbackRule,
  CashbackRuleView,
  CashbackRuleWrite,
  CashbackWeekdayInput,
} from '../api/types';
import { WEEKDAYS } from '../store/business-hours';
import { parseDecimal } from '../store/settings-model';

export { WEEKDAYS };

/**
 * ============================================================================
 * OS DOIS TETOS DE SANIDADE — e nenhum dos dois é regra do backend
 * ============================================================================
 *
 * O banco aceita de 0 a 100 (`ck_cashback_rules_default_percent`). Cem por
 * cento de cashback é o restaurante dando o pedido inteiro de volta, e o
 * backend aceitaria isso sem piscar — a proteção contra o dedo escorregado é da
 * tela, e ela é dita aqui para não ficar espalhada em `<input max>`.
 *
 * O TETO DURO (30%) É UM GUARDA DE DIGITAÇÃO, não uma opinião comercial: é o
 * que separa "10" de "100" e "5" de "50". Acima dele a tela RECUSA salvar, com
 * o motivo escrito — não é aviso que dá para atravessar clicando.
 *
 * O AVISO (10%) É OPINIÃO, e por isso ele avisa em vez de barrar. Cashback
 * comum vive entre 3% e 10%; acima disso ainda pode ser deliberado (a campanha
 * de reabertura, o dia mais fraco da semana), e barrar o lojista de fazer o que
 * ele quis seria a tela decidindo o negócio dele.
 *
 * Os dois valem para o percentual base E para o de cada dia: o dia é a alavanca
 * que sobe, então é nele que o dedo escorrega para cima.
 */
export const TETO_PERCENTUAL = 30;
export const PERCENTUAL_INCOMUM = 10;

/** Quanto tempo o crédito dura, quando ninguém configurou nada ainda. */
const EXPIRACAO_PADRAO = 60;

/**
 * UM DIA DA GRADE.
 *
 * `percent` VAZIO NÃO É ZERO: é "este dia herda o percentual base". São os dois
 * únicos estados, e a diferença entre eles é o que a armadilha 2 cobra —
 * `''` sai do corpo, `'0'` entra como um dia que não credita nada.
 */
export type DiaDraft = {
  weekday: number;
  /** O texto do campo, na vírgula que o lojista digita. Vazio = herda. */
  percent: string;
};

/** O que o formulário edita. Tudo texto: o campo é texto, e o erro também. */
export type CashbackDraft = {
  enabled: boolean;
  defaultPercent: string;
  minRedeemBalance: string;
  expiryDays: string;
  /** Sempre os SETE dias, na ordem da grade. Quem herda vai com `percent` vazio. */
  dias: DiaDraft[];
};

/** Número da API → texto do campo. `"10.00"` vira `"10"`, `"7.50"` vira `"7,5"`. */
export function formatPercentInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numero = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numero)) return '';
  /* Sem casas decorativas: "10,00" num campo que o lojista vai reescrever é
     ruído, e ele digita "10". As duas casas são do CORPO, não do campo. */
  return String(numero).replace('.', ',');
}

/** O rascunho de quem ainda não tem regra nenhuma — `source: 'none'`. */
export function draftVazio(): CashbackDraft {
  return {
    /*
     * NASCE DESLIGADO. `source: 'none'` é "ninguém configurou", e abrir o
     * formulário já ligado faria o primeiro salvamento acender uma campanha que
     * ninguém pediu — num painel onde salvar mexe em faturamento no mesmo
     * minuto. Ligar é um ato, e ele tem de ser do lojista.
     */
    enabled: false,
    defaultPercent: '',
    minRedeemBalance: '',
    expiryDays: String(EXPIRACAO_PADRAO),
    dias: WEEKDAYS.map((dia) => ({ weekday: dia.weekday, percent: '' })),
  };
}

/**
 * A resposta → o rascunho.
 *
 * A GRADE TEM SEMPRE SETE LINHAS, mesmo que a regra traga uma. O dia sem linha
 * própria aparece com o campo VAZIO, que é como a tela escreve "herda" — e é
 * também o estado em que ele volta para o corpo, ou seja: abrir e salvar sem
 * tocar em nada devolve exatamente a mesma regra.
 */
export function draftFrom(rule: CashbackRule | null | undefined): CashbackDraft {
  if (!rule) return draftVazio();

  const porDia = new Map((rule.weekdays ?? []).map((dia) => [dia.weekday, dia.percent]));

  return {
    enabled: rule.enabled,
    defaultPercent: formatPercentInput(rule.default_percent),
    minRedeemBalance: formatPercentInput(rule.min_redeem_balance),
    expiryDays: String(rule.expiry_days),
    dias: WEEKDAYS.map((dia) => ({
      weekday: dia.weekday,
      percent: formatPercentInput(porDia.get(dia.weekday)),
    })),
  };
}

export type ProblemaDoCampo = { campo: string; message: string };

/**
 * O que impede o salvamento, se algo impedir.
 *
 * Devolve o PRIMEIRO problema, e a ordem é a da leitura da tela: o lojista
 * conserta o de cima, salva de novo, e o de baixo aparece. Uma lista de cinco
 * erros de uma vez num formulário de sete linhas é mais difícil de atravessar
 * que um de cada vez.
 */
export function problemaDoDraft(draft: CashbackDraft): ProblemaDoCampo | null {
  /*
   * DESLIGADO NÃO SE VALIDA. `enabled: false` é a forma de desligar a campanha,
   * e exigir que os números estejam certos para poder desligá-la seria pedir ao
   * lojista que arrume a casa antes de fechar a porta.
   */
  if (!draft.enabled) return null;

  const base = parseDecimal(draft.defaultPercent, { allowEmpty: false });
  if (!base.ok) return { campo: 'defaultPercent', message: base.message };
  if (base.value === null) {
    return { campo: 'defaultPercent', message: 'Diga quantos por cento voltam para o cliente.' };
  }
  const problemaBase = problemaDePercentual(base.value);
  if (problemaBase) return { campo: 'defaultPercent', message: problemaBase };

  const minimo = parseDecimal(draft.minRedeemBalance);
  if (!minimo.ok) return { campo: 'minRedeemBalance', message: minimo.message };
  if (minimo.value !== null && minimo.value < 0) {
    return { campo: 'minRedeemBalance', message: 'O saldo mínimo não pode ser negativo.' };
  }

  const dias = Number(draft.expiryDays.trim());
  if (!Number.isInteger(dias) || dias < 1) {
    return { campo: 'expiryDays', message: 'A validade é em dias inteiros, a partir de 1.' };
  }

  for (const dia of draft.dias) {
    if (dia.percent.trim() === '') continue;
    const valor = parseDecimal(dia.percent, { allowEmpty: false });
    if (!valor.ok) return { campo: `dia-${dia.weekday}`, message: valor.message };
    if (valor.value === null) continue;
    const problema = problemaDePercentual(valor.value);
    if (problema) return { campo: `dia-${dia.weekday}`, message: problema };
  }

  return null;
}

/** O teto duro, e só ele: o aviso de 10% não impede nada. */
function problemaDePercentual(valor: number): string | null {
  if (valor < 0) return 'O percentual não pode ser negativo.';
  if (valor > TETO_PERCENTUAL) {
    return `${TETO_PERCENTUAL}% é o teto desta tela. Acima disso o cashback custa mais que a margem da maioria dos pratos — se for mesmo o que você quer, fale com o suporte.`;
  }
  return null;
}

/**
 * Os percentuais fora do comum deste rascunho, para a tela avisar sem barrar.
 *
 * Devolve os RÓTULOS ("Base", "Terça-feira"), não os números: quem lê o aviso
 * precisa saber ONDE olhar, e "10,5%" sozinho não diz em qual das oito caixas
 * ele está.
 */
export function percentuaisIncomuns(draft: CashbackDraft): string[] {
  if (!draft.enabled) return [];

  const fora: string[] = [];
  const base = parseDecimal(draft.defaultPercent);
  if (base.ok && base.value !== null && base.value > PERCENTUAL_INCOMUM) fora.push('Base');

  draft.dias.forEach((dia) => {
    if (dia.percent.trim() === '') return;
    const valor = parseDecimal(dia.percent);
    if (!valor.ok || valor.value === null) return;
    if (valor.value <= PERCENTUAL_INCOMUM) return;
    fora.push(WEEKDAYS.find((d) => d.weekday === dia.weekday)?.label ?? `Dia ${dia.weekday}`);
  });

  return fora;
}

/** Dinheiro e percentual vão com duas casas, como STRING. Ver §4 do doc. */
function duasCasas(valor: number): string {
  return valor.toFixed(2);
}

/**
 * O RASCUNHO → O CORPO DO `PUT`.
 *
 * A ÚNICA FUNÇÃO QUE MONTA ESTE CORPO, e ela é a resposta às armadilhas 2 e 3:
 *
 *   - `weekdays` leva SÓ os dias que o lojista preencheu. Dia vazio SAI da
 *     lista, e sair da lista é como se escreve "este dia herda o percentual
 *     base". Mandar os sete sempre — que é o que `business-hours.weekPayload`
 *     faz, e o que a memória muscular pede — congelaria os sete no valor da
 *     caixa e mataria a herança;
 *   - a lista substitui a anterior inteira, então ela sai daqui completa em
 *     relação ao que a tela mostra, e nunca de um recorte.
 *
 * Chamar isto com um rascunho que `problemaDoDraft` reprovou é erro de
 * programação: os `?? 0` abaixo são o piso, não uma validação.
 */
export function bodyFrom(draft: CashbackDraft): CashbackRuleWrite {
  const base = parseDecimal(draft.defaultPercent);
  const minimo = parseDecimal(draft.minRedeemBalance);

  const weekdays: CashbackWeekdayInput[] = [];
  draft.dias.forEach((dia) => {
    if (dia.percent.trim() === '') return;
    const valor = parseDecimal(dia.percent);
    if (!valor.ok || valor.value === null) return;
    weekdays.push({ weekday: dia.weekday, percent: duasCasas(valor.value) });
  });

  return {
    enabled: draft.enabled,
    default_percent: duasCasas(base.ok && base.value !== null ? base.value : 0),
    min_redeem_balance: duasCasas(minimo.ok && minimo.value !== null ? minimo.value : 0),
    expiry_days: Number(draft.expiryDays.trim()) || EXPIRACAO_PADRAO,
    weekdays,
  };
}

/**
 * A FRASE QUE DIZ O QUE SALVAR VAI FAZER — e ela muda com `source`.
 *
 * É a razão de `source` existir no contrato: sem ela, a filial que herda e a
 * que tem regra própria mostram o mesmo formulário, e o lojista que ajusta a
 * terça-feira "da rede" numa tela de filial na verdade DESLIGA a herança
 * daquela loja para sempre, sem nada dizendo.
 */
export function explicacaoDaOrigem(
  view: CashbackRuleView,
  escopo: 'rede' | 'filial',
): { titulo: string; detalhe: string } {
  if (escopo === 'rede') {
    return view.source === 'none'
      ? {
          titulo: 'Nenhuma regra configurada',
          detalhe:
            'Nenhum cliente está acumulando cashback neste restaurante. O que for salvo aqui passa a valer para toda filial que não tenha regra própria.',
        }
      : {
          titulo: 'Regra da rede',
          detalhe:
            'Vale para toda filial que não tenha regra própria. Filial com sobrescrita não é alcançada por esta tela.',
        };
  }

  if (view.source === 'branch') {
    return {
      titulo: 'Esta loja tem regra própria',
      detalhe:
        'Ela parou de herdar: mudanças na regra da rede não chegam aqui. Para voltar a herdar, apague a regra desta loja.',
    };
  }

  if (view.source === 'restaurant') {
    return {
      titulo: 'Herdando a regra da rede',
      detalhe:
        'Estes valores vêm da rede. Salvar aqui CRIA uma regra só desta loja, e a partir daí mudanças na regra da rede deixam de alcançá-la.',
    };
  }

  return {
    titulo: 'Nenhuma regra configurada',
    detalhe:
      'Nem esta loja nem a rede têm cashback configurado, e ninguém está acumulando crédito. Salvar aqui vale só para esta loja.',
  };
}
