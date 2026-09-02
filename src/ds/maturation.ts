/**
 * A régua da barra de maturação.
 *
 * Mora fora do componente por dois motivos: um arquivo que exporta componente
 * E função quebra o hot reload do Vite, e esta conta é a única regra de negócio
 * do design system — ela merece teste próprio.
 *
 * OS DOIS LIMITES: 50% e 85% da janela de preparo da loja.
 *
 *   até 50%   no prazo          verde de `pronto`
 *   50 a 85%  dentro da janela   âmbar de `pendente` — é a hora de olhar
 *   acima     estourando         vermelho de `cancelado`
 *
 * O vermelho aqui é a exceção que a regra do sistema prevê: é alarme, não
 * estado normal. Um pedido que passou de 85% da janela prometida É um problema,
 * e na churrascaria do piloto — 90 a 100 minutos de preparo — isso quer dizer
 * que o cliente já está esperando há uma hora e meia.
 */
export type Faixa = 'ok' | 'atencao' | 'estourando';

export const LIMITE_ATENCAO = 0.5;
export const LIMITE_ESTOURO = 0.85;

/**
 * Quanto da janela já passou, preso entre 0 e 1. `null` = não há o que desenhar.
 *
 * SÃO DOIS DESCONHECIDOS, E OS DOIS VALEM `null`:
 *
 *   - **sem janela** — a filial não tem prazo de preparo gravado. Já era assim,
 *     e a régua devolvia 0, que o componente lia como "vazia" por acidente;
 *   - **sem minutos** — o pedido não tem `created_at` (`string | null` no
 *     contrato). Antes, `OrderLine` fazia `?? 0` e ZERO É O PEDIDO MAIS FRESCO
 *     POSSÍVEL: a barra nascia vazia e verde para um pedido cuja hora de entrada
 *     ninguém sabe.
 *
 * A Cozinha, sobre o MESMO dado, já respondia `level: 'unknown'` e um travessão
 * (`kitchen/wait-time.ts`). Duas telas discordando sobre o mesmo pedido, e a
 * que mentia era a lista — a que se olha no meio do turno.
 *
 * Mesma família do `new Date(null)`, que é a época e não `NaN`: um ausente que
 * vira um valor VÁLIDO e se mistura aos de verdade.
 */
export function razaoDeMaturacao(
  elapsedMinutes: number | null,
  windowMinutes: number | null,
): number | null {
  if (elapsedMinutes === null) return null;
  if (!windowMinutes || windowMinutes <= 0) return null;
  return Math.min(Math.max(elapsedMinutes / windowMinutes, 0), 1);
}

export function faixaDe(razao: number): Faixa {
  if (razao >= LIMITE_ESTOURO) return 'estourando';
  if (razao >= LIMITE_ATENCAO) return 'atencao';
  return 'ok';
}
