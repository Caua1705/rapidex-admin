/**
 * As seis seções de Minha loja — e agora cada uma é uma ROTA.
 *
 * Esta lista é a fonte única: as rotas (`App.tsx`) e a navegação da esquerda
 * (`StoreLayout`) leem daqui. Duas listas divergiriam no dia em que alguém
 * acrescentasse uma seção — que é exatamente o que já aconteceu com a lateral
 * do produto antes de `nav.ts` existir.
 *
 * `scope` não é enfeite: ele diz se a seção mexe no restaurante inteiro ou em
 * UMA filial, porque as rotas das de filial levam `{branch_id}` no path e não
 * existe id para mandar quando o cabeçalho está em "Todas as filiais".
 *
 * O QUE ELE NÃO FAZ MAIS É BLOQUEAR A PÁGINA. Este campo já pediu uma filial
 * ao lojista, com cartão e um botão por loja, nas quatro seções de filial ao
 * mesmo tempo — a mesma frase em quatro rotas. Hoje ele alimenta
 * `auth/branch-scope.ts`, que RESOLVE a filial (a principal, na falta de
 * escolha) e deixa a página abrir; o que resta na tela é a linha auxiliar do
 * cabeçalho dizendo de qual filial é aquele formulário.
 */
export type StoreSectionId =
  'geral' | 'filial' | 'horarios' | 'entrega' | 'pagamento' | 'impressao';

export type StoreSection = {
  id: StoreSectionId;
  /** O que aparece na navegação da esquerda: curto, cabe em 148px. */
  label: string;
  /** O título da página. Pode ser mais longo que o rótulo da navegação. */
  titulo: string;
  nota?: string;
  scope: 'restaurant' | 'branch';
};

export const STORE_SECTIONS: readonly StoreSection[] = [
  {
    id: 'geral',
    label: 'Geral',
    titulo: 'Geral',
    nota: 'vale para o restaurante inteiro',
    scope: 'restaurant',
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
