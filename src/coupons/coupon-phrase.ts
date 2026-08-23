/**
 * A FRASE-RESUMO — o que esta tela tem de melhor.
 *
 * Um formulário de cupom é uma dúzia de campos independentes, e o lojista só
 * descobre o que eles somam quando o primeiro cliente reclama. A frase monta
 * essa soma em português, do que ele acabou de preencher, e se refaz enquanto
 * ele mexe:
 *
 *   "Frete grátis, só em entrega, em pedidos de R$ 60,00 ou mais em produtos,
 *    de 23/08 a 30/09, 100 usos no total, 1 por cliente, só para quem nunca
 *    pediu aqui."
 *
 * ELA NÃO É ENFEITE: resolve três armadilhas que o lojista descobriria depois,
 * e cada uma delas é uma linha de `CouponService.evaluate` que a tela não tem
 * como mostrar de outro jeito.
 *
 *   1. `min_order_value` é comparado com o SUBTOTAL (`if subtotal < minimum`).
 *      A taxa de entrega não ajuda a alcançar o mínimo — daí "em produtos".
 *   2. `free_delivery` desconta a taxa INTEIRA, e na retirada a taxa é zero
 *      (`if order_type == "pickup": fee = ZERO`). O cupom é aceito e desconta
 *      R$ 0,00: não é bloqueado, só não vale nada — daí "só em entrega".
 *   3. `first_order_only` olha `customer_has_valid_order(cliente, ESTE
 *      restaurante)`. É primeiro pedido NESTA loja, não na plataforma — daí
 *      "nunca pediu aqui", e nunca "novos clientes".
 *
 * O QUE CABE NA FRASE E O QUE VIRA NOTA: a frase diz o QUE acontece, curto o
 * bastante para ser lido de uma vez; a nota diz POR QUE, e só aparece quando a
 * armadilha está armada. Enfiar as três explicações na frase a transformaria
 * num parágrafo, e um parágrafo ninguém relê a cada tecla.
 */
import type { CouponTemplate } from '../api/types';
import { diaCurto, textoDoDesconto, tipoDaArte, type CouponDraft } from './coupon-model';

export type ResumoDoCupom = {
  /** A frase pronta, com ponto final. */
  frase: string;
  /** As ressalvas que a frase não comporta. Vazio quando nenhuma se aplica. */
  notas: string[];
};

/**
 * Texto do campo → número, ou nada.
 *
 * A vírgula decimal é a que o lojista digita, e o ponto é separador de milhar —
 * a mesma leitura de `parseDecimal`. Aqui ela devolve NÚMERO e não texto porque
 * `textoDoDesconto` formata dinheiro a partir de número: passar "15,00" cru
 * para ele daria `Number("15,00") = NaN` e o teto sumiria da frase sem nada
 * acender, que é o pior defeito possível numa frase que existe para conferir.
 */
function numeroDoCampo(raw: string): number | null {
  const limpo = raw.trim();
  if (limpo === '') return null;
  const numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function dinheiroDoCampo(raw: string): string | null {
  const numero = numeroDoCampo(raw);
  return numero === null ? null : `R$ ${numero.toFixed(2).replace('.', ',')}`;
}

function inteiroDoCampo(raw: string): number | null {
  const limpo = raw.trim();
  if (!/^\d+$/.test(limpo)) return null;
  const numero = Number(limpo);
  return numero > 0 ? numero : null;
}

/**
 * O resumo do que o lojista preencheu.
 *
 * SEM ARTE NÃO HÁ FRASE, e ela devolve `null`: o desconto é a primeira palavra
 * e ele vem da arte. Uma frase que começasse em "em pedidos de R$ 60,00 ou
 * mais" descreveria uma campanha sem dizer o que ela desconta — pior que
 * nenhuma, porque parece completa.
 */
export function resumoDoCupom(
  rascunho: CouponDraft,
  arte: CouponTemplate | null,
): ResumoDoCupom | null {
  const tipo = arte ? tipoDaArte(arte) : null;
  if (!arte || !tipo) return null;

  const partes: string[] = [];
  const notas: string[] = [];

  /* 1. O desconto — sempre a primeira palavra, sempre vindo da arte. */
  const teto = tipo === 'percent' ? numeroDoCampo(rascunho.maxDiscountAmount) : null;
  partes.push(textoDoDesconto(tipo, arte.discount_value, teto));

  if (tipo === 'free_delivery') {
    partes.push('só em entrega');
    notas.push(
      'Em pedido de retirada a taxa de entrega é zero — o cupom é aceito e desconta R$ 0,00. ' +
        'Ele não é bloqueado, apenas não vale nada ali.',
    );
  }

  /* 2. O mínimo, que é do SUBTOTAL. */
  const minimo = dinheiroDoCampo(rascunho.minOrderValue);
  if (minimo) {
    partes.push(`em pedidos de ${minimo} ou mais em produtos`);
    notas.push(
      'O mínimo é comparado com o subtotal dos produtos. A taxa de entrega não conta para ' +
        'alcançá-lo.',
    );
  }

  /* 3. O prazo. "Até" quando começa no mesmo dia; "de … a …" quando é campanha
     marcada para depois — a diferença é o que torna visível um cupom que ainda
     não está valendo. */
  const de = diaCurto(rascunho.validFrom);
  const ate = diaCurto(rascunho.validUntil);
  if (de && ate) partes.push(de === ate ? `só em ${ate}` : `de ${de} a ${ate}`);
  else if (ate) partes.push(`até ${ate}`);

  /* 4. Os limites de uso. */
  const total = inteiroDoCampo(rascunho.totalUsageLimit);
  if (total) partes.push(total === 1 ? '1 uso no total' : `${total} usos no total`);

  const porCliente = inteiroDoCampo(rascunho.usageLimitPerCustomer);
  if (porCliente) {
    partes.push(porCliente === 1 ? '1 vez por cliente' : `${porCliente} vezes por cliente`);
  }

  const intervalo = inteiroDoCampo(rascunho.cooldownDays);
  if (intervalo) {
    partes.push(intervalo === 1 ? 'com 1 dia entre um uso e outro' : `com ${intervalo} dias entre um uso e outro`);
  }

  /* 5. Quem pode usar. */
  if (rascunho.firstOrderOnly) {
    partes.push('só para quem nunca pediu aqui');
    notas.push(
      '"Nunca pediu aqui" é nesta loja, não na plataforma: quem já comprou em outro ' +
        'restaurante do Rapidex continua contando como primeiro pedido seu.',
    );
  }

  return { frase: `${partes.join(', ')}.`, notas };
}
