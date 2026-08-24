/**
 * A parte de `OneTimeSecret` que não é componente.
 *
 * Fica em arquivo próprio pelo mesmo motivo de `ds/maturation.ts` e
 * `ds/status.ts`: o Fast Refresh do Vite só preserva estado num arquivo que
 * exporta apenas componentes. E, como as duas de lá, é a parte que dá para
 * testar sem montar nada.
 */

/**
 * Cinco caracteres por bloco: o compasso de quem soletra ao telefone.
 *
 * A senha temporária tem 20 caracteres, então dá quatro blocos exatos. O
 * tamanho não é sorteio — é o mesmo agrupamento do cartão de crédito e do
 * código de barras, e a razão é a memória de trabalho de quem escuta: acima de
 * cinco símbolos, quem anota perde o lugar antes de terminar o grupo.
 */
const TAMANHO_DO_BLOCO = 5;

/**
 * O segredo partido em blocos, na ordem.
 *
 * O RESTO ENTRA INTEIRO no último bloco: um valor de 22 caracteres vira
 * 5-5-5-5-2, e não 5-5-5-5-2 com um bloco vazio atrás. Hoje a única entrada tem
 * 20 caracteres e a conta fecha redonda, mas o backend pode mudar o tamanho da
 * senha sem avisar a tela — e um bloco vazio no fim seria um espaço que quem
 * está ditando leria como parte do valor.
 */
export function blocosDe(value: string): string[] {
  const blocos: string[] = [];
  for (let inicio = 0; inicio < value.length; inicio += TAMANHO_DO_BLOCO) {
    blocos.push(value.slice(inicio, inicio + TAMANHO_DO_BLOCO));
  }
  return blocos;
}
