/**
 * O NOME DE CADA PAPEL EM PORTUGUÊS, num lugar só.
 *
 * Esta tabela morava privada dentro de `layout/AppShell.tsx`, onde ela servia a
 * um leitor só: a linha da conta no canto da barra. A tela de Usuários precisa
 * dela em três lugares (a coluna de cargo, o seletor do formulário e a frase do
 * diálogo de senha), e copiá-la para lá seria a segunda fonte de verdade —
 * aquela em que "Atendente" e "Balcão" convivem porque ninguém reconciliou.
 *
 * O `Record<PapelDePessoa, string>` é o que trava a tabela contra o CONTRATO:
 * `PapelDePessoa` sai do Literal gerado (`owner | manager | attendant`), então
 * um papel novo do backend vira erro de `npm run typecheck` aqui — e não uma
 * célula em branco na coluna de cargo.
 *
 * O `print_agent` NÃO TEM RÓTULO, e a ausência é a mesma decisão do resto do
 * painel: ele não entra no painel (`podeEntrarNoPainel`) e não vem em
 * `GET /admin/users`. Um rótulo para ele seria um nome de cargo para uma
 * máquina, exatamente onde a tela fala de gente.
 */
import type { PapelDePessoa } from '../api/types';

export const ROLE_LABELS: Record<PapelDePessoa, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  attendant: 'Atendente',
};

/**
 * A ordem em que os papéis aparecem em lista e em seletor: do mais alcance para
 * o menos.
 *
 * Ela é derivada da tabela acima em vez de ser uma segunda lista — mas a ORDEM
 * é a de declaração, e por isso a tabela é escrita de propósito nessa
 * sequência. `Object.keys` de um objeto com chaves de texto preserva a ordem de
 * inserção, e é a única coisa que este arquivo pede da tabela além dos rótulos.
 */
export const PAPEIS_DE_PESSOA = Object.keys(ROLE_LABELS) as PapelDePessoa[];

/**
 * O rótulo de um `role` que veio como `string` do contrato.
 *
 * `AdminUserResponse.role` e `AdminUserDetailResponse.role` são texto livre no
 * OpenAPI (o backend os declara como `str`), então estreitar é trabalho da
 * tela — a mesma situação de `papelDe()` em `permissions.ts`.
 *
 * PAPEL DESCONHECIDO DEVOLVE O PRÓPRIO CÓDIGO, e não um traço nem um vazio: se
 * o backend criar um quinto papel, é melhor a coluna dizer `supervisor` do que
 * fingir que a pessoa não tem cargo. Aqui isso é rótulo, não autorização — quem
 * falha fechado é `pode()`.
 */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role as PapelDePessoa] ?? role;
}
