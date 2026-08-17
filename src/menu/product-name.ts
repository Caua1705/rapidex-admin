/**
 * O nome do item, partido em BASE e QUALIFICADOR.
 *
 * O PROBLEMA É DE VARREDURA, NÃO DE CADASTRO. Um açougue tem, na mesma
 * categoria, "Picanha Suína", "Picanha Suína (400g)" e "Picanha Suína (1kg)":
 * três linhas cujos primeiros catorze caracteres são idênticos, todas em
 * semibold, e o que as separa está escondido no fim da string. O olho lê o
 * começo de cada linha e não distingue nenhuma das três — a lista inteira vira
 * uma coluna de repetições.
 *
 * Tirando o que está entre parênteses do nome e devolvendo-o à parte, a tela
 * pode desenhá-lo como uma marca própria ao lado do nome: a única coisa que
 * muda entre as três linhas passa a ser a única com forma diferente.
 *
 * SÓ VALE QUANDO A BASE SE REPETE NA LISTA. "Coca-Cola (lata)" sozinha numa
 * categoria já se distingue de "Guaraná" — arrancar o parêntese dela seria
 * mexer no nome de um item que não tem problema nenhum a resolver, e a tela
 * passaria a mostrar um nome diferente do que está cadastrado sem motivo.
 */

/**
 * Unidades que valem a pena separar do número. A lista é curta de propósito:
 * fora dela, o texto do parêntese sai como o lojista escreveu.
 */
const UNITS = new Set(['g', 'kg', 'mg', 'ml', 'l', 'cm', 'un', 'und', 'kcal']);

/** "400g" → 400 + "g". O que não casar sai intocado. */
const MEASURE = /^(\d+(?:[.,]\d+)?)\s*([a-zà-ú]+)$/i;

/**
 * O parêntese do FIM do nome, e só ele.
 *
 * O teto de 20 caracteres é o que separa um qualificador de uma observação:
 * "(400g)" é o que distingue duas linhas; "(consulte os sabores do dia)" é
 * texto de cardápio, e arrancá-lo do nome esconderia informação em vez de
 * organizá-la. Também exige algo ANTES do parêntese — um nome que é só
 * "(promoção)" não tem base para sobrar.
 */
const TRAILING_PARENTHETICAL = /^(.+?)\s*\(([^()]{1,20})\)$/;

export type ProductNameParts = {
  /** O nome sem o parêntese final. É ele que se repete entre as variações. */
  base: string;
  /** O que estava entre parênteses, normalizado. `null` quando não havia. */
  qualifier: string | null;
};

function normalizeQualifier(raw: string): string {
  const match = MEASURE.exec(raw);
  if (!match) return raw;

  const amount = match[1] ?? '';
  const lower = (match[2] ?? '').toLowerCase();
  // Fora da lista de unidades, "1kg" e "1 Kilo" não são a mesma coisa: só a
  // primeira vira "1 kg". A segunda sai como está.
  if (!UNITS.has(lower)) return raw;
  return `${amount} ${lower}`;
}

export function splitProductName(name: string): ProductNameParts {
  const trimmed = name.trim();
  const match = TRAILING_PARENTHETICAL.exec(trimmed);
  if (!match) return { base: trimmed, qualifier: null };

  const base = (match[1] ?? '').trim();
  const qualifier = normalizeQualifier((match[2] ?? '').trim());
  // Parêntese vazio não qualifica nada; devolve o nome inteiro.
  if (base === '' || qualifier === '') return { base: trimmed, qualifier: null };
  return { base, qualifier };
}

/** Chave de comparação da base: sem caixa e sem acento, como se digita errado. */
function baseKey(base: string): string {
  return base
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Quais itens da lista devem mostrar o qualificador à parte.
 *
 * Devolve um mapa `id → qualificador` com SÓ os itens cuja base é dividida com
 * pelo menos um outro item da lista. Quem não repete o nome sai do mapa e a
 * tela desenha o nome inteiro, do jeito que está cadastrado.
 */
export function qualifiersByProduct(
  products: readonly { id: string; name: string }[],
): Record<string, string> {
  const parts = new Map<string, ProductNameParts>();
  const idsByBase = new Map<string, string[]>();

  products.forEach((product) => {
    const split = splitProductName(product.name);
    parts.set(product.id, split);
    const key = baseKey(split.base);
    const ids = idsByBase.get(key);
    if (ids) ids.push(product.id);
    else idsByBase.set(key, [product.id]);
  });

  const qualifiers: Record<string, string> = {};
  idsByBase.forEach((ids) => {
    if (ids.length < 2) return;
    ids.forEach((id) => {
      const qualifier = parts.get(id)?.qualifier;
      if (qualifier) qualifiers[id] = qualifier;
    });
  });
  return qualifiers;
}
