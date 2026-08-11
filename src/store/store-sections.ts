/**
 * As seis seções de Minha loja — e agora cada uma é uma ROTA.
 *
 * Esta lista é a fonte única: as rotas (`App.tsx`) e a navegação da esquerda
 * (`StoreLayout`) leem daqui. Duas listas divergiriam no dia em que alguém
 * acrescentasse uma seção — que é exatamente o que já aconteceu com a lateral
 * do produto antes de `nav.ts` existir.
 *
 * `scope` não é enfeite: ele diz se a seção mexe no restaurante inteiro ou em
 * UMA filial. As de filial não têm o que editar com "Todas as filiais"
 * escolhida no cabeçalho — não existe id para mandar no PATCH — e é este campo
 * que faz a página pedir uma filial em vez de mostrar um formulário que não
 * salva.
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
  { id: 'impressao', label: 'Impressão', titulo: 'Setores de impressão', scope: 'branch' },
];
