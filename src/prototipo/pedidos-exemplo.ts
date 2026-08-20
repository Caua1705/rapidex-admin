/**
 * OS MESMOS PEDIDOS NAS TRÊS DIREÇÕES.
 *
 * O exercício é comparar FORMA, não conteúdo: se cada protótipo inventasse a
 * própria lista, a diferença entre eles passaria a incluir "aquele tem mais
 * pedido atrasado", que não é uma decisão de design.
 *
 * A lista cobre de propósito os casos que decidem a leitura no pico:
 *   - pedido novo esperando aceite
 *   - novo com PAGAMENTO ONLINE PENDENTE (a cozinha não pode começar)
 *   - em preparo dentro da janela
 *   - em preparo ESTOURADO (acima da janela de 25 min)
 *   - pronto no balcão (retirada) e pronto aguardando entregador
 *   - na rua, um deles já atrasado
 *
 * Nada aqui fala com a API: é dado congelado para olhar, não para operar.
 */

export type ProtoEstagio = 'novo' | 'preparo' | 'pronto' | 'rua';
export type ProtoModalidade = 'entrega' | 'retirada';
export type ProtoPagamento = 'pago' | 'na-entrega' | 'pendente';

export type ProtoPedido = {
  id: string;
  numero: number;
  estagio: ProtoEstagio;
  /** Minutos desde que o pedido entrou — a régua da tela. */
  minutos: number;
  hora: string;
  cliente: string;
  /** Quantos itens, e o resumo do que é. */
  itens: number;
  resumo: string;
  modalidade: ProtoModalidade;
  /** Bairro na entrega; ponto de retirada na retirada. */
  destino: string;
  pagamento: ProtoPagamento;
  formaPagamento: string;
  total: number;
};

/** A promessa de preparo da loja. É contra ela que "atrasado" é medido. */
export const JANELA_MINUTOS = 25;

export const PEDIDOS: readonly ProtoPedido[] = [
  {
    id: 'p1',
    numero: 1042,
    estagio: 'novo',
    minutos: 1,
    hora: '19:42',
    cliente: 'Marina Alves',
    itens: 3,
    resumo: '2x Pizza calabresa G · 1x Guaraná 2L',
    modalidade: 'entrega',
    destino: 'Aldeota',
    pagamento: 'pago',
    formaPagamento: 'Pix',
    total: 78.4,
  },
  {
    id: 'p2',
    numero: 1041,
    estagio: 'novo',
    minutos: 4,
    hora: '19:39',
    cliente: 'Rodrigo Sena',
    itens: 2,
    resumo: '1x Combo executivo · 1x Suco de caju',
    modalidade: 'retirada',
    destino: 'Balcão',
    pagamento: 'na-entrega',
    formaPagamento: 'Dinheiro',
    total: 41.0,
  },
  {
    id: 'p3',
    numero: 1040,
    estagio: 'novo',
    minutos: 7,
    hora: '19:36',
    cliente: 'Júlia Bezerra',
    itens: 5,
    resumo: '2x Pizza portuguesa · 2x Refri lata · 1x Pudim',
    modalidade: 'entrega',
    destino: 'Meireles',
    pagamento: 'pendente',
    formaPagamento: 'Crédito online',
    total: 112.9,
  },
  {
    id: 'p4',
    numero: 1039,
    estagio: 'preparo',
    minutos: 12,
    hora: '19:31',
    cliente: 'Carlos Nogueira',
    itens: 2,
    resumo: '1x Baião de dois · 1x Água com gás',
    modalidade: 'entrega',
    destino: 'Papicu',
    pagamento: 'pago',
    formaPagamento: 'Pix',
    total: 63.5,
  },
  {
    id: 'p5',
    numero: 1038,
    estagio: 'preparo',
    minutos: 18,
    hora: '19:25',
    cliente: 'Ana Paula Ribeiro',
    itens: 4,
    resumo: '1x Camarão à baiana · 2x Cerveja long neck · 1x Sobremesa',
    modalidade: 'entrega',
    destino: 'Cocó',
    pagamento: 'pago',
    formaPagamento: 'Pix',
    total: 96.0,
  },
  {
    id: 'p6',
    numero: 1037,
    estagio: 'preparo',
    minutos: 34,
    hora: '19:09',
    cliente: 'Tiago Farias',
    itens: 1,
    resumo: '1x Escondidinho de carne de sol',
    modalidade: 'retirada',
    destino: 'Balcão',
    pagamento: 'pago',
    formaPagamento: 'Débito',
    total: 28.9,
  },
  {
    id: 'p7',
    numero: 1036,
    estagio: 'preparo',
    minutos: 41,
    hora: '19:02',
    cliente: 'Beatriz Lima',
    itens: 7,
    resumo: '3x Pizza mista · 2x Porção de fritas · 2x Refri 1L',
    modalidade: 'entrega',
    destino: 'Varjota',
    pagamento: 'na-entrega',
    formaPagamento: 'Dinheiro',
    total: 154.7,
  },
  {
    id: 'p8',
    numero: 1035,
    estagio: 'pronto',
    minutos: 22,
    hora: '19:21',
    cliente: 'Vinícius Torres',
    itens: 2,
    resumo: '1x Prato feito · 1x Caldo de feijão',
    modalidade: 'retirada',
    destino: 'Balcão',
    pagamento: 'pago',
    formaPagamento: 'Pix',
    total: 37.0,
  },
  {
    id: 'p9',
    numero: 1034,
    estagio: 'pronto',
    minutos: 26,
    hora: '19:17',
    cliente: 'Helena Castro',
    itens: 3,
    resumo: '1x Moqueca para dois · 2x Suco natural',
    modalidade: 'entrega',
    destino: 'Dionísio Torres',
    pagamento: 'pago',
    formaPagamento: 'Crédito',
    total: 88.2,
  },
  {
    id: 'p10',
    numero: 1033,
    estagio: 'rua',
    minutos: 31,
    hora: '19:12',
    cliente: 'Paulo Ricardo Menezes',
    itens: 2,
    resumo: '1x Parmegiana · 1x Refri 600ml',
    modalidade: 'entrega',
    destino: 'Benfica',
    pagamento: 'pago',
    formaPagamento: 'Pix',
    total: 71.3,
  },
  {
    id: 'p11',
    numero: 1032,
    estagio: 'rua',
    minutos: 48,
    hora: '18:55',
    cliente: 'Fernanda Duarte',
    itens: 3,
    resumo: '2x Wrap de frango · 1x Salada verde',
    modalidade: 'entrega',
    destino: 'Montese',
    pagamento: 'pago',
    formaPagamento: 'Vale-refeição',
    total: 59.9,
  },
];

/** Estourou a promessa da loja? É a única regra de alarme dos protótipos. */
export function atrasado(pedido: ProtoPedido): boolean {
  return pedido.minutos > JANELA_MINUTOS;
}

/** "1042" nunca é dinheiro; dinheiro nunca é "R$ 78.4". */
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function brl(valor: number): string {
  return moeda.format(valor);
}

/** Só o número, para as direções onde repetir "R$" em toda linha é ruído. */
export function num(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

/** "34 min" / "1h08" — o campo que decide a prioridade no pico. */
export function decorrido(minutos: number): string {
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
}

/**
 * O relógio do console. É o mesmo dado de `decorrido`, escrito para VARREDURA:
 * numa coluna de trinta linhas o que se lê é a coluna, não o número, e por
 * isso ele é curto, alinhado à direita e sem espaço interno — "41m" e "1m" na
 * mesma casa decimal.
 *
 * A primeira tentativa foi "00:41", em hh:mm de largura fixa; ela alinhava e
 * mentia — quem bate o olho lê quarenta e um SEGUNDOS antes de lembrar que a
 * régua é minuto.
 */
export function cronometro(minutos: number): string {
  if (minutos < 60) return `${minutos}m`;
  return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
}

export type ProtoGrupo = {
  estagio: ProtoEstagio;
  titulo: string;
  /** O rótulo curto do console, onde a faixa tem 22px de altura. */
  curto: string;
  pedidos: ProtoPedido[];
};

const TITULOS: Record<ProtoEstagio, { titulo: string; curto: string }> = {
  novo: { titulo: 'Novos', curto: 'Novos' },
  preparo: { titulo: 'Em preparo', curto: 'Preparo' },
  pronto: { titulo: 'Prontos', curto: 'Prontos' },
  rua: { titulo: 'Na rua', curto: 'Rua' },
};

export const ORDEM_ESTAGIOS: readonly ProtoEstagio[] = ['novo', 'preparo', 'pronto', 'rua'];

export function tituloDe(estagio: ProtoEstagio): string {
  return TITULOS[estagio].titulo;
}

/**
 * Os pedidos por estágio, na ordem do turno, com os grupos VAZIOS já fora.
 *
 * É aqui que o problema 3 morre para as três direções: o grupo sem pedido não
 * chega até a tela, então nenhuma delas precisa decidir como desenhar uma
 * faixa que diz "0". O contador de todos os estágios — inclusive os zerados —
 * continua existindo, mas na barra do topo, onde custa altura nenhuma.
 */
export function grupos(pedidos: readonly ProtoPedido[] = PEDIDOS): ProtoGrupo[] {
  return ORDEM_ESTAGIOS.map((estagio) => ({
    estagio,
    titulo: TITULOS[estagio].titulo,
    curto: TITULOS[estagio].curto,
    // Dentro do grupo, o mais velho primeiro: é a ordem em que a cozinha
    // trabalha, e a mesma que `porUrgencia` usa na direção sem agrupamento.
    pedidos: pedidos
      .filter((pedido) => pedido.estagio === estagio)
      .sort((a, b) => b.minutos - a.minutos),
  })).filter((grupo) => grupo.pedidos.length > 0);
}

/** Quantos em cada estágio, zerados incluídos — é o que a barra do topo diz. */
export function contagem(pedidos: readonly ProtoPedido[] = PEDIDOS): Record<ProtoEstagio, number> {
  return {
    novo: pedidos.filter((p) => p.estagio === 'novo').length,
    preparo: pedidos.filter((p) => p.estagio === 'preparo').length,
    pronto: pedidos.filter((p) => p.estagio === 'pronto').length,
    rua: pedidos.filter((p) => p.estagio === 'rua').length,
  };
}

/** Ordenado por estágio e, dentro dele, do mais velho para o mais novo. */
export function porUrgencia(pedidos: readonly ProtoPedido[] = PEDIDOS): ProtoPedido[] {
  return [...pedidos].sort((a, b) => {
    const passo = ORDEM_ESTAGIOS.indexOf(a.estagio) - ORDEM_ESTAGIOS.indexOf(b.estagio);
    return passo !== 0 ? passo : b.minutos - a.minutos;
  });
}
