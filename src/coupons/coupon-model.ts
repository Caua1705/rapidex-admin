/**
 * O que a tela de Cupons sabe sobre uma campanha — sem React, sem tela.
 *
 * Quatro coisas moram aqui, e as quatro existem porque a tela não pode
 * deduzi-las de novo em cada lugar que precisa delas:
 *
 *   1. A TRAVA DA ARTE — `bodyFrom` monta o corpo, e o tipo e o valor do
 *      desconto saem SEMPRE da arte escolhida, nunca do rascunho.
 *   2. A SITUAÇÃO — cinco estados, na ordem em que o backend recusa o cupom.
 *   3. AS ARTES QUE SOBRAM — o cruzamento que impede o 409 da arte repetida.
 *   4. QUEM VÊ E COMO CHEGA — `visibility` mais a presença do código, que são
 *      dois eixos independentes e juntos decidem por onde o cliente pega o
 *      cupom.
 */
import type {
  Coupon,
  CouponCreate,
  CouponDiscountType,
  CouponTemplate,
  CouponVisibility,
  CustomerSegment,
} from '../api/types';
import { SEGMENT_LABEL } from '../customers/customer-segment';
import { OPERATION_TIMEZONE } from '../orders/format';
import {
  formatDecimalInput,
  formatIntegerInput,
  parseDecimal,
  parseInteger,
} from '../store/settings-model';

/* ==========================================================================
 * O RASCUNHO
 * ======================================================================= */

/**
 * O formulário, em texto.
 *
 * NÃO HÁ `discountType` NEM `discountValue` AQUI, e a ausência é o desenho
 * inteiro da tela: se eles existissem como campo, existiria o caminho de
 * escolher a arte de 10% e digitar 7%. Eles saem de `templateId` em
 * `bodyFrom`, e de lugar nenhum mais.
 *
 * `code` É TEXTO E PODE FICAR VAZIO — e o vazio é uma ESCOLHA, não um campo
 * por preencher: cupom sem código aplica sozinho no checkout. `bodyFrom` o
 * traduz para `null`, que é o que o backend lê como automático.
 */
export type CouponDraft = {
  /** Nulo em campanha nova. É o que separa POST de PATCH. */
  id: string | null;
  templateId: string;
  title: string;
  code: string;
  description: string;
  visibility: CouponVisibility;
  /**
   * Vazio quando a visibilidade não é `segment`.
   *
   * O banco tem o CHECK `(visibility = 'segment') = (target_segment IS NOT
   * NULL)`, nos DOIS sentidos, e o Pydantic o espelha: alvo preenchido num
   * cupom público é 422, não um campo ignorado. Por isso `bodyFrom` o zera
   * fora de `segment` em vez de confiar no que a tela está mostrando.
   */
  targetSegment: CustomerSegment | '';
  /** AAAA-MM-DD, como o `input type="date"` devolve. */
  validFrom: string;
  validUntil: string;
  minOrderValue: string;
  /** Só existe em arte percentual — ver `aceitaTeto`. */
  maxDiscountAmount: string;
  totalUsageLimit: string;
  usageLimitPerCustomer: string;
  cooldownDays: string;
  firstOrderOnly: boolean;
  isActive: boolean;
};

/** Os campos do rascunho que podem receber erro — a chave do mapa de erros. */
export type CouponField = keyof Omit<CouponDraft, 'id'>;

/* ==========================================================================
 * DATA: O LOJISTA PENSA EM DIA, O CONTRATO PEDE INSTANTE
 * ======================================================================= */

/**
 * O fuso da operação, fixo, escrito como deslocamento.
 *
 * `valid_from` e `valid_until` são `datetime` no contrato e o lojista escolhe
 * DIA. A conversão não pode passar por `new Date('2026-09-30')` e sair
 * formatando: ali o navegador aplica o fuso DELE, e um painel aberto em Lisboa
 * gravaria a campanha começando no dia anterior ao que o lojista viu na tela.
 *
 * `-03:00` é literal e não uma conta: `America/Fortaleza` não tem horário de
 * verão (o país o extinguiu em 2019, e o Nordeste nunca o teve), então o
 * deslocamento é o mesmo o ano inteiro. Escrevê-lo assim mantém a conversão
 * exata e testável, sem depender do relógio de quem roda o teste.
 */
const DESLOCAMENTO_DA_OPERACAO = '-03:00';

/**
 * O dia em que a campanha COMEÇA, à meia-noite da operação.
 *
 * Sem hora, `2026-09-01` viraria meia-noite UTC — 21h do dia 31 de agosto em
 * Fortaleza —, e a campanha da promoção de setembro abriria três horas antes,
 * ainda em agosto.
 */
export function inicioDoDia(dia: string): string {
  return `${dia}T00:00:00${DESLOCAMENTO_DA_OPERACAO}`;
}

/**
 * O dia em que a campanha TERMINA, no último segundo dele.
 *
 * Este é o que mais custa errado. `valid_until` é comparado com `>` no
 * backend (`if current > valid_until: expired`), então mandar
 * `2026-09-30T00:00:00` faz o cupom "até 30/09" morrer à meia-noite que ABRE o
 * dia 30 — o lojista anuncia o mês inteiro e perde o último dia, que costuma
 * ser o de maior movimento da campanha.
 */
export function fimDoDia(dia: string): string {
  return `${dia}T23:59:59${DESLOCAMENTO_DA_OPERACAO}`;
}

/**
 * O caminho de volta: instante do contrato → o dia da OPERAÇÃO.
 *
 * Pelo mesmo motivo de `todayInOperationTimezone`, o formato sai do `en-CA`
 * com `timeZone` em vez de `getFullYear`/`getMonth`: um cupom que termina às
 * 23:59 de Fortaleza é 02:59 do dia SEGUINTE em UTC, e um painel que lesse a
 * data no fuso da máquina mostraria a campanha durando um dia a mais.
 */
export function diaDaOperacao(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TIMEZONE }).format(data);
}

/** `2026-09-30` → `30/09`. Vazio devolve vazio: não se inventa data. */
export function diaCurto(dia: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  return partes ? `${partes[3]}/${partes[2]}` : '';
}

/* ==========================================================================
 * O DESCONTO — que é da ARTE, não do lojista
 * ======================================================================= */

export const TIPO_LABEL: Record<CouponDiscountType, string> = {
  percent: 'Percentual',
  fixed: 'Valor fixo',
  free_delivery: 'Frete grátis',
};

/**
 * A ordem dos grupos no seletor, e ela não é alfabética.
 *
 * Percentual primeiro porque é a campanha mais comum, frete grátis por último
 * porque é a que tem a ressalva (só vale em entrega). O catálogo vai crescer
 * para vinte ou trinta artes — sem agrupamento, uma parede de imagem não se
 * navega, e é para isso que esta constante existe.
 */
export const ORDEM_DOS_TIPOS: readonly CouponDiscountType[] = ['percent', 'fixed', 'free_delivery'];

/**
 * O TIPO DA ARTE, ESTREITADO — ou nada.
 *
 * `CouponTemplateResponse.discount_type` é `str` no contrato (o backend o
 * declara assim; quem o limita aos três valores é um CHECK do banco), então
 * estreitá-lo é trabalho da tela — a mesma situação de `role` em
 * `auth/permissions.ts`, e a mesma escolha: FALHAR FECHADO.
 *
 * Um quarto tipo criado na plataforma devolve `null`, a arte não entra em
 * grupo nenhum do seletor e o lojista não a escolhe. A alternativa — um `as`
 * cego — deixaria a arte aparecer, o formulário abrir, e o 422 chegar no
 * salvar, sobre um campo que a tela nem tem.
 */
export function tipoDaArte(arte: CouponTemplate): CouponDiscountType | null {
  return ORDEM_DOS_TIPOS.includes(arte.discount_type as CouponDiscountType)
    ? (arte.discount_type as CouponDiscountType)
    : null;
}

/** "10", "10.00" e "10.5" viram "10", "10" e "10,5" — sem centavo inútil. */
function numeroEnxuto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (!Number.isFinite(numero)) return '';
  return String(numero).replace('.', ',');
}

function dinheiro(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (!Number.isFinite(numero)) return '';
  return `R$ ${numero.toFixed(2).replace('.', ',')}`;
}

/**
 * O desconto em uma expressão curta — a coluna da lista e o rótulo da arte.
 *
 * `maxDiscountAmount` entra entre parênteses porque ele MUDA o que o cliente
 * recebe: "20%" e "20% (até R$ 15)" são campanhas diferentes num pedido de
 * R$ 200, e a lista que mostrasse só "20%" esconderia justamente o teto que o
 * lojista pôs para se proteger.
 */
export function textoDoDesconto(
  tipo: CouponDiscountType,
  valor: string | number | null | undefined,
  teto?: string | number | null,
): string {
  if (tipo === 'free_delivery') return 'Frete grátis';
  if (tipo === 'percent') {
    const base = `${numeroEnxuto(valor)}%`;
    return teto ? `${base} (até ${dinheiro(teto)})` : base;
  }
  return dinheiro(valor);
}

/** O mesmo, lido de uma arte do catálogo. Tipo desconhecido não tem rótulo. */
export function descontoDaArte(arte: CouponTemplate): string {
  const tipo = tipoDaArte(arte);
  return tipo ? textoDoDesconto(tipo, arte.discount_value) : '';
}

/**
 * O QUE A ARTE DESCONTA, dito como frase — o rótulo do cartão do seletor.
 *
 * O prefixo não é enfeite. Sem ele o cartão mostra a imagem (que já diz "10%
 * OFF"), o nome ("10% OFF") e o valor ("10%"): três vezes o mesmo texto, e o
 * terceiro lê como repetição em vez de afirmação. Com "Desconta 10%" ele passa
 * a dizer outra coisa — o que ESTA campanha vai tirar do pedido, que é a única
 * informação do cartão que o backend vai obedecer.
 *
 * E ele ganha sentido de verdade na arte cujo nome NÃO é o valor: "Primeiro
 * pedido" está cadastrada como `fixed` de R$ 10, e "Desconta R$ 10,00" é a
 * única coisa na tela que diz isso.
 */
export function textoDoQueDesconta(arte: CouponTemplate): string {
  const tipo = tipoDaArte(arte);
  if (!tipo) return '';
  /* "Desconta frete grátis" não é português. O frete é a taxa, e é ela que sai. */
  if (tipo === 'free_delivery') return 'Desconta a taxa de entrega';
  return `Desconta ${textoDoDesconto(tipo, arte.discount_value)}`;
}

/** O mesmo, lido de uma campanha gravada. */
export function descontoDoCupom(cupom: Coupon): string {
  return textoDoDesconto(cupom.discount_type, cupom.discount_value, cupom.max_discount_amount);
}

/** Teto de desconto só é aceito em percentual — o backend responde 422 fora dele. */
export function aceitaTeto(tipo: CouponDiscountType | null): boolean {
  return tipo === 'percent';
}

/* ==========================================================================
 * QUEM VÊ O CUPOM — e por onde ele chega
 * ======================================================================= */

/**
 * A ordem das três opções, e ela vai do mais aberto para o mais fechado.
 *
 * Não é alfabética nem a do enum: quem abre o formulário está decidindo QUANTA
 * gente alcança, e a escada crescente de restrição é a forma dessa decisão.
 * `public` primeiro também porque é o default do backend e a campanha comum.
 */
export const ORDEM_DAS_VISIBILIDADES: readonly CouponVisibility[] = [
  'public',
  'segment',
  'private',
];

/**
 * O rótulo de cada uma. Substantivo curto — ele vive numa célula de tabela.
 *
 * `Record<CouponVisibility, string>` trava a lista no enum GERADO: um quarto
 * valor no contrato vira erro de compilação aqui, e não uma linha sem etiqueta
 * na tela do lojista. Mesma regra de `SEGMENT_LABEL` em Clientes.
 */
export const VISIBILIDADE_LABEL: Record<CouponVisibility, string> = {
  public: 'Público',
  segment: 'Por segmento',
  private: 'Privado',
};

/**
 * O QUE CADA UMA FAZ, dito pelo que o CLIENTE vê — não pelo nome do campo.
 *
 * As três frases saem de `CouponService._can_see`, que é o único lugar do
 * backend que lê `visibility`, e cada uma guarda uma consequência que o lojista
 * não tem como adivinhar do rótulo:
 *
 *   - `public` é o único que aparece para quem NÃO está logado. Nos outros dois
 *     o convidado nem sabe que a campanha existe — de propósito: devolver "entre
 *     na conta para usar" num cupom privado anunciaria a existência dele.
 *   - `segment` compara com a classe RFV do cliente, que é calculada pelo
 *     backend e MUDA sozinha: quem estava "Em risco" e voltou a pedir sai da
 *     campanha sem ninguém mexer nela.
 *   - `private` exige RESGATE: a pessoa digita o código no Clube (ou no
 *     checkout) e o cupom passa a ser dela. Sem código digitado ele não existe
 *     para ninguém — daí a regra de `validarRascunho` que impede privado sem
 *     código.
 */
export const VISIBILIDADE_AJUDA: Record<CouponVisibility, string> = {
  public:
    'Aparece na lista de cupons do app para todo mundo, inclusive para quem não entrou na conta.',
  segment:
    'Aparece só para quem está na classe escolhida. A classe é calculada pelo Rapidex e muda sozinha conforme o cliente pede ou some.',
  private:
    'Não aparece para ninguém. Só chega a quem digitar o código — é o cupom que você manda por fora, no panfleto ou no direct.',
};

/** O alvo só existe em `segment` — nos outros dois o backend responde 422. */
export function aceitaSegmento(visibilidade: CouponVisibility): boolean {
  return visibilidade === 'segment';
}

/**
 * QUEM VÊ ESTA CAMPANHA, em uma expressão — a coluna da lista.
 *
 * O segmento entra no texto porque "Por segmento" sozinho não responde à
 * pergunta que a coluna existe para responder: duas campanhas segmentadas lado
 * a lado, uma para "Fiel" e outra para "Perdido", são coisas diferentes e a
 * etiqueta as mostraria idênticas.
 *
 * ALVO DESCONHECIDO NÃO INVENTA RÓTULO: `target_segment` é anulável no contrato
 * e o CHECK do banco garante que ele existe em `segment`, mas uma classe RFV
 * nova na plataforma chegaria aqui sem par em `SEGMENT_LABEL`. Nesse caso sobra
 * o rótulo da visibilidade, que continua verdadeiro.
 */
export function textoDeQuemVe(cupom: Coupon): string {
  const base = VISIBILIDADE_LABEL[cupom.visibility];
  if (cupom.visibility !== 'segment') return base;
  const alvo = cupom.target_segment ? SEGMENT_LABEL[cupom.target_segment] : null;
  return alvo ?? base;
}

/**
 * COMO O CLIENTE PEGA O CUPOM — a linha auxiliar embaixo do nome, na lista.
 *
 * É o par de `textoDeQuemVe` e responde outra pergunta: aquela diz QUEM
 * enxerga, esta diz o que a pessoa faz para usar. São eixos independentes —
 * existe cupom público automático e cupom público com código —, e mostrar só um
 * dos dois deixaria o lojista sem saber por que o desconto está saindo sem
 * ninguém digitar nada.
 */
export function textoDoCodigo(cupom: Coupon): string {
  return cupom.code ?? 'aplica sozinho';
}

/* ==========================================================================
 * A SITUAÇÃO — cinco estados, na ordem em que o backend recusa
 * ======================================================================= */

export type Situacao = 'programado' | 'ativo' | 'expirado' | 'esgotado' | 'desligado';

export const SITUACAO_LABEL: Record<Situacao, string> = {
  programado: 'Programado',
  ativo: 'Ativo',
  expirado: 'Expirado',
  esgotado: 'Esgotado',
  desligado: 'Desligado',
};

/**
 * EM QUE PÉ ESTÁ A CAMPANHA.
 *
 * A ordem das perguntas é a MESMA de `CouponService.evaluate`, e isso não é
 * capricho: um cupom desligado E expirado precisa dizer a mesma coisa nas duas
 * telas, senão o lojista religa a campanha na nossa e o checkout continua
 * recusando pela outra razão. A ordem lá é
 * `inactive` → `not_started` → `expired` → `total_limit`.
 *
 * A VISIBILIDADE NÃO ENTRA NESTA CONTA, e a ausência é a mudança de
 * `20260828_0043`. Enquanto existia `is_public`, o `false` caía em DESLIGADO
 * junto com `is_active: false` — e caía com razão, porque `evaluate` recusava
 * `not_public` na prévia E no fechamento: o cupom era inusável por caminho
 * nenhum. As três visibilidades de hoje são todas USÁVEIS; o que muda é por
 * onde o cliente chega. Um cupom privado marcado "Desligado" diria que a
 * campanha está fora do ar quando ela está valendo para quem tem o código.
 *
 * O interruptor é `is_active`, um só. Quem vê é outra coluna.
 *
 * ESGOTADO vem por último, e é por isso que ele só aparece dentro do prazo:
 * uma campanha que estourou o limite em julho e venceu em agosto lê "Expirado",
 * que é o que o checkout diria.
 */
export function situacaoDoCupom(cupom: Coupon, agora: Date = new Date()): Situacao {
  if (!cupom.is_active) return 'desligado';

  const instante = agora.getTime();
  const inicio = new Date(cupom.valid_from).getTime();
  const fim = new Date(cupom.valid_until).getTime();

  if (Number.isFinite(inicio) && instante < inicio) return 'programado';
  if (Number.isFinite(fim) && instante > fim) return 'expirado';

  const limite = cupom.total_usage_limit;
  if (limite !== null && limite !== undefined && (cupom.total_usage_count ?? 0) >= limite) {
    return 'esgotado';
  }

  return 'ativo';
}

/**
 * "37 de 100" — e "37 usos" quando não há teto.
 *
 * `total_usage_count` é anulável no contrato (o service o preenche por fora, e
 * um `model_validate` novo que o esqueça devolve nulo em vez de estourar).
 * Nulo é lido como zero: mostrar "— de 100" faria o lojista achar que a
 * contagem quebrou, quando o caso real é uma campanha que ninguém usou.
 */
export function textoDeUso(cupom: Coupon): string {
  const usados = cupom.total_usage_count ?? 0;
  const limite = cupom.total_usage_limit;
  if (limite === null || limite === undefined) {
    return usados === 1 ? '1 uso' : `${usados} usos`;
  }
  return `${usados} de ${limite}`;
}

/* ==========================================================================
 * A ARTE QUE SAIU DO AR
 * ======================================================================= */

/**
 * A plataforma desativou a arte desta campanha.
 *
 * `GET /admin/coupon-templates` devolve SÓ artes ativas, então um
 * `coupon_template_id` sem par na lista não é dado faltando — é a arte fora do
 * catálogo. E o efeito é maior do que uma imagem que não carrega:
 * `update_admin` valida a arte sobre o resultado da MESCLA, então esta campanha
 * responde 400 "Template de cupom invalido" a qualquer PATCH, inclusive a um
 * `{ is_active: false }` que não chega perto de arte nenhuma.
 *
 * Ou seja: o lojista não consegue nem DESLIGAR o cupom sem escolher outra arte
 * na mesma chamada. A tela precisa dizer isso — e é por isso que este predicado
 * existe em vez de a lista simplesmente mostrar um quadrado vazio.
 *
 * (Pendência do backend: desligar não deveria depender da arte. Enquanto isso,
 * o diálogo obriga a troca e o corpo sai completo, que é a saída que existe.)
 */
export function arteDesativada(cupom: Coupon, artes: readonly CouponTemplate[]): boolean {
  return !artes.some((arte) => arte.id === cupom.coupon_template_id);
}

export function arteDoCupom(
  cupom: Coupon,
  artes: readonly CouponTemplate[],
): CouponTemplate | null {
  return artes.find((arte) => arte.id === cupom.coupon_template_id) ?? null;
}

/* ==========================================================================
 * O SELETOR DE ARTE
 * ======================================================================= */

export type GrupoDeArtes = { tipo: CouponDiscountType; label: string; artes: CouponTemplate[] };

/**
 * AS ARTES QUE ESTE RESTAURANTE AINDA PODE USAR, agrupadas por tipo.
 *
 * Existe `UNIQUE (restaurant_id, coupon_template_id)` no banco: uma arte, uma
 * campanha, por restaurante. Sem este cruzamento o lojista escolhe uma arte
 * ocupada, preenche o formulário inteiro e leva 409 no salvar — e a mensagem do
 * 409 manda mexer na arte, não no código, o que só se descobre depois de tentar
 * trocar o código e tomar o mesmo erro de novo.
 *
 * A EXCEÇÃO É A EDIÇÃO: a arte da própria campanha continua na lista
 * (`mantendo`), senão o campo abriria vazio e o lojista teria de reescolher
 * arte para corrigir uma data.
 *
 * Grupo vazio não é devolvido — um cabeçalho "Frete grátis" sem nenhuma imagem
 * embaixo anuncia o nada, que é a mesma regra do agrupamento vazio no quadro de
 * pedidos.
 */
export function artesDisponiveis(
  artes: readonly CouponTemplate[],
  cupons: readonly Coupon[],
  mantendo: string | null = null,
): GrupoDeArtes[] {
  const ocupadas = new Set(
    cupons.map((cupom) => cupom.coupon_template_id).filter((id) => id !== mantendo),
  );

  return ORDEM_DOS_TIPOS.map((tipo) => ({
    tipo,
    label: TIPO_LABEL[tipo],
    artes: artes
      .filter((arte) => tipoDaArte(arte) === tipo && !ocupadas.has(arte.id))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR')),
  })).filter((grupo) => grupo.artes.length > 0);
}

/** Quantas artes sobraram no total — o estado vazio do seletor depende disso. */
export function contarArtes(grupos: readonly GrupoDeArtes[]): number {
  return grupos.reduce((soma, grupo) => soma + grupo.artes.length, 0);
}

/* ==========================================================================
 * RASCUNHO ↔ CORPO
 * ======================================================================= */

/**
 * Campanha nova: começa hoje, dura o mês, e nasce ligada.
 *
 * NASCE PÚBLICA, que é o default do backend e a campanha que o lojista quase
 * sempre está criando. Abrir em "Privado" faria a opção segura ser a de menos
 * alcance — e uma campanha que ninguém vê é o defeito mais caro desta tela,
 * porque ela não acusa nada: some da vitrine em silêncio.
 */
export function rascunhoNovo(hoje: string): CouponDraft {
  return {
    id: null,
    templateId: '',
    title: '',
    code: '',
    description: '',
    visibility: 'public',
    targetSegment: '',
    validFrom: hoje,
    validUntil: hoje,
    minOrderValue: '',
    maxDiscountAmount: '',
    totalUsageLimit: '',
    usageLimitPerCustomer: '',
    cooldownDays: '',
    firstOrderOnly: false,
    isActive: true,
  };
}

/**
 * A campanha gravada → o formulário.
 *
 * `min_order_value` é obrigatório no contrato e chega `"0.00"` quando não há
 * mínimo. O campo abre VAZIO nesse caso: "0,00" escrito num campo de valor
 * mínimo lê como uma regra que alguém configurou, e o lojista fica procurando
 * como apagá-la.
 */
export function rascunhoDe(cupom: Coupon): CouponDraft {
  const semMinimo = Number(cupom.min_order_value) === 0;
  return {
    id: cupom.id,
    templateId: cupom.coupon_template_id,
    title: cupom.title,
    /* Sem código, o campo abre VAZIO — que é o estado que significa
       "aplica sozinho". Ver `bodyFrom`. */
    code: cupom.code ?? '',
    description: cupom.description ?? '',
    visibility: cupom.visibility,
    targetSegment: cupom.target_segment ?? '',
    validFrom: diaDaOperacao(cupom.valid_from),
    validUntil: diaDaOperacao(cupom.valid_until),
    minOrderValue: semMinimo ? '' : formatDecimalInput(cupom.min_order_value),
    maxDiscountAmount: formatDecimalInput(cupom.max_discount_amount),
    totalUsageLimit: formatIntegerInput(cupom.total_usage_limit),
    usageLimitPerCustomer: formatIntegerInput(cupom.usage_limit_per_customer),
    cooldownDays: formatIntegerInput(cupom.cooldown_days),
    firstOrderOnly: cupom.first_order_only,
    isActive: cupom.is_active,
  };
}

/** Texto do campo → o inteiro do corpo. Vazio é `null` — "sem limite". */
function inteiroOuNulo(raw: string): number | null {
  const lido = parseInteger(raw);
  return lido.ok ? lido.value : null;
}

/**
 * DINHEIRO SOBE COMO STRING DE DUAS CASAS.
 *
 * `Numeric(12,2)` do outro lado, e `50.10` como número JSON chega
 * `50.099999` — o mesmo motivo de `min_ticket` em Clientes e do percentual do
 * cashback. Um mínimo de R$ 50,10 que chega 50,099999 aceita um pedido de
 * R$ 50,0999 que o lojista achava que estava barrando.
 */
function dinheiroOuNulo(raw: string): string | null {
  const lido = parseDecimal(raw);
  if (!lido.ok || lido.value === null) return null;
  return lido.value.toFixed(2);
}

/**
 * O CORPO — e a linha que dá razão de existir a esta tela inteira.
 *
 * `discount_type` e `discount_value` SAEM DA ARTE. Não há caminho neste arquivo
 * em que eles saiam do rascunho, e é isso que impede a vitrine de anunciar 10%
 * enquanto o checkout desconta 7%. O backend confere o TIPO contra o template
 * (`_ensure_template_agrees`) e **não confere o VALOR** — o comentário dele é
 * explícito sobre o estrago: "nada falha, nada é logado, e quem descobre é o
 * cliente na tela de pagamento".
 *
 * O TETO É ZERADO FORA DE PERCENTUAL AQUI, e não só escondido na tela. O campo
 * some do formulário quando a arte não é percentual, mas o rascunho pode
 * carregar o texto de antes — trocar uma arte de 20% por uma de R$ 5 sem esta
 * linha mandaria `max_discount_amount` junto e o backend responderia 422 num
 * campo que o lojista não está mais vendo.
 *
 * O CORPO VAI COMPLETO, inclusive no PATCH, com `null` explícito no que está
 * vazio. Não é desleixo: `update_admin` revalida a MESCLA inteira, então um
 * campo omitido continua valendo o que estava gravado — e um `total_usage_limit`
 * que o lojista APAGOU precisa virar `null`, não sumir do corpo e continuar 100.
 *
 * O CÓDIGO VAZIO SOBE COMO `null`, e é aqui que "aplica sozinho" acontece. Os
 * dois cuidados desta linha:
 *
 *   - o backend RECUSA código só de espaços em vez de convertê-lo (`code não
 *     pode ser só espaços; omita o campo…`), justamente porque a diferença
 *     decide comportamento de produto — então a tela apara antes de mandar;
 *   - no PATCH, `null` EXPLÍCITO é o que TIRA o código de uma campanha que
 *     tinha um. `exclude_unset=True` do outro lado significa que a ausência do
 *     campo preservaria o código gravado — o lojista apagaria "SETEMBRO" na
 *     tela e continuaria com SETEMBRO no banco. Mesma regra de
 *     `printing_sector_id`: nulo é escolha, não vazio.
 *
 * O ALVO É ZERADO FORA DE `segment`, pelo mesmo motivo do teto de desconto: o
 * rascunho pode carregar a classe escolhida antes de o lojista voltar para
 * "Público", e `target_segment` num cupom público é 422 sobre um campo que a
 * tela não está mais mostrando.
 */
export function bodyFrom(rascunho: CouponDraft, arte: CouponTemplate): CouponCreate | null {
  /*
   * Arte de tipo desconhecido não vira corpo. Ela não aparece no seletor (ver
   * `tipoDaArte`), então este `null` é o caminho que só existe para não haver
   * um `as` cego aqui dentro — e para o dia em que a plataforma criar um quarto
   * tipo, quando a tela recusa em vez de mandar um corpo que o backend nega.
   */
  const tipo = tipoDaArte(arte);
  if (!tipo) return null;

  return {
    coupon_template_id: arte.id,
    discount_type: tipo,
    discount_value: tipo === 'free_delivery' ? '0.00' : (arte.discount_value ?? '0.00'),
    code: rascunho.code.trim().toUpperCase() || null,
    title: rascunho.title.trim(),
    description: rascunho.description.trim() || null,
    valid_from: inicioDoDia(rascunho.validFrom),
    valid_until: fimDoDia(rascunho.validUntil),
    min_order_value: dinheiroOuNulo(rascunho.minOrderValue) ?? '0.00',
    max_discount_amount: aceitaTeto(tipo) ? dinheiroOuNulo(rascunho.maxDiscountAmount) : null,
    total_usage_limit: inteiroOuNulo(rascunho.totalUsageLimit),
    usage_limit_per_customer: inteiroOuNulo(rascunho.usageLimitPerCustomer),
    cooldown_days: inteiroOuNulo(rascunho.cooldownDays),
    first_order_only: rascunho.firstOrderOnly,
    is_active: rascunho.isActive,
    visibility: rascunho.visibility,
    target_segment: aceitaSegmento(rascunho.visibility) ? rascunho.targetSegment || null : null,
  };
}
