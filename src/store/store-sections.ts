/**
 * As oito seções de Minha loja — e cada uma é uma ROTA.
 *
 * Esta lista é a fonte única: as rotas (`App.tsx`) e a navegação da esquerda
 * (`StoreLayout`) leem daqui. Duas listas divergiriam no dia em que alguém
 * acrescentasse uma seção — que é exatamente o que já aconteceu com a lateral
 * do produto antes de `nav.ts` existir.
 *
 * `scope` não é enfeite: ele diz se a seção mexe no restaurante inteiro, em UMA
 * filial ou em TODAS, porque as rotas das de filial levam `{branch_id}` no path
 * e não existe id para mandar quando o cabeçalho está em "Todas as filiais".
 *
 * `all-branches` é o escopo de Operação, e ele não é o de Geral com outro nome:
 * a tela grava por filial, uma linha de cada vez, mas mostra TODAS ao mesmo
 * tempo — é a conferência que ela existe para dar. Por isso ela não adota
 * filial nenhuma no cabeçalho, e o seletor continua oferecendo "todas".
 *
 * O QUE ELE NÃO FAZ MAIS É BLOQUEAR A PÁGINA. Este campo já pediu uma filial
 * ao lojista, com cartão e um botão por loja, nas quatro seções de filial ao
 * mesmo tempo — a mesma frase em quatro rotas. Hoje ele alimenta
 * `auth/branch-scope.ts`, que RESOLVE a filial (a principal, na falta de
 * escolha) e deixa a página abrir; o que resta na tela é a linha auxiliar do
 * cabeçalho dizendo de qual filial é aquele formulário.
 */
export type StoreSectionId =
  'operacao' | 'geral' | 'valores' | 'filial' | 'horarios' | 'entrega' | 'pagamento' | 'impressao';

export type StoreSection = {
  id: StoreSectionId;
  /** O que aparece na navegação da esquerda: curto, cabe em 148px. */
  label: string;
  /** O título da página. Pode ser mais longo que o rótulo da navegação. */
  titulo: string;
  nota?: string;
  /**
   * A seção é uma LISTA, não um formulário de grade: ela tem teto próprio.
   *
   * O da coluna (1180px acima de 1100) é a medida de quatro campos lado a lado.
   * Numa linha de nome + chave, ele afastaria a chave da loja que ela abre.
   */
  estreita?: true;
  scope: 'restaurant' | 'branch' | 'all-branches';
};

export const STORE_SECTIONS: readonly StoreSection[] = [
  /*
   * OPERAÇÃO É A PRIMEIRA, e é onde /minha-loja abre. É o estado do dia — o
   * que o lojista vem conferir com pressa no sábado à noite —, enquanto Geral
   * são os padrões que ele encosta uma vez por mês.
   */
  {
    id: 'operacao',
    label: 'Operação',
    titulo: 'Operação',
    estreita: true,
    scope: 'all-branches',
  },
  {
    id: 'geral',
    label: 'Geral',
    titulo: 'Geral',
    nota: 'vale para o restaurante inteiro',
    scope: 'restaurant',
  },
  /*
   * VALORES vem logo depois de GERAL, e não junto das outras de filial: as duas
   * editam os MESMOS quatro números, uma no padrão da rede e outra na
   * sobrescrita da loja. Lado a lado na navegação, a herança se lê na ordem —
   * separadas por três seções, o lojista mexeria no padrão achando que mexia na
   * filial, e o número da vitrine não se moveria.
   */
  {
    id: 'valores',
    label: 'Valores',
    titulo: 'Valores desta filial',
    scope: 'branch',
  },
  { id: 'filial', label: 'Filial', titulo: 'Filial', scope: 'branch' },
  { id: 'horarios', label: 'Horários', titulo: 'Horários de funcionamento', scope: 'branch' },
  { id: 'entrega', label: 'Entrega', titulo: 'Entrega', scope: 'branch' },
  { id: 'pagamento', label: 'Pagamento', titulo: 'Formas de pagamento', scope: 'branch' },
  /*
   * "Impressão", e não mais "Setores de impressão": a tela deixou de ser só a
   * lista de setores e passou a ser onde a impressora é configurada de ponta a
   * ponta — o programa de impressão, as impressoras, os setores e o teste da
   * comanda. O título de antes nomeava um dos quatro blocos.
   */
  { id: 'impressao', label: 'Impressão', titulo: 'Impressão', scope: 'branch' },
];
