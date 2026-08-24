/**
 * As recusas da troca de senha, antecipadas.
 *
 * Fica fora do `.tsx` pelo mesmo motivo de `layout/branch-heading.ts` e
 * `coupons/coupon-form.ts`: o Fast Refresh do Vite só preserva estado num
 * arquivo que exporta apenas componentes — e esta é a parte que dá para testar
 * sem montar tela nenhuma.
 */

/**
 * O mínimo é o do backend (`MIN_ADMIN_PASSWORD_LENGTH`), repetido aqui de
 * propósito: sem ele, o 422 do Pydantic seria a primeira notícia de que 8
 * caracteres não bastam — depois de digitar os três campos.
 *
 * É uma cópia, e ela pode envelhecer. O que a torna aceitável é a DIREÇÃO do
 * erro: se o backend aumentar o mínimo, a tela deixa passar e o 422 aparece
 * (chato, mas correto); se diminuir, a tela exige de mais (chato, e nada
 * quebra). Nenhuma das duas grava senha fraca, que é o que importaria.
 */
export const MINIMO_DA_SENHA = 12;

export type ErrosDaTroca = { atual?: string; nova?: string; confirmacao?: string };

/**
 * As três recusas de `change_password`, antecipadas — e a terceira é a que se
 * esquece.
 *
 * O backend responde 400 para senha atual errada, para as duas que não
 * conferem e para a senha nova IGUAL à atual. A última não é preciosismo: com
 * uma senha temporária, repetir a que veio no papel deixaria valendo uma
 * credencial que atravessou WhatsApp, telefone e o balcão — e
 * `must_change_password` sairia satisfeito, sem nada ter mudado.
 *
 * A SENHA ATUAL ERRADA NÃO DÁ PARA ANTECIPAR: só o bcrypt sabe. Ela chega como
 * 400 e vai para o aviso do topo, com a frase do backend.
 */
export function validarTroca(
  atual: string,
  nova: string,
  confirmacao: string,
): ErrosDaTroca {
  const erros: ErrosDaTroca = {};

  if (atual === '') erros.atual = 'Digite a senha com que você entrou.';

  if (nova === '') erros.nova = 'Escolha a senha nova.';
  else if (nova.length < MINIMO_DA_SENHA) erros.nova = `Pelo menos ${MINIMO_DA_SENHA} caracteres.`;
  else if (nova === atual) erros.nova = 'A senha nova precisa ser diferente da atual.';

  if (confirmacao === '') erros.confirmacao = 'Repita a senha nova.';
  else if (nova !== '' && confirmacao !== nova) erros.confirmacao = 'As duas não conferem.';

  return erros;
}
