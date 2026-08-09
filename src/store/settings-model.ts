/**
 * Leitura e escrita dos números dos formulários de Minha loja.
 *
 * POR QUE NÃO REUSA `parsePriceInput` DO CARDÁPIO: lá, campo vazio e texto
 * inválido dão o mesmo `null`, e isso basta — preço de produto é obrigatório.
 * Aqui os dois casos são OPOSTOS: vazio significa "não configurado" e é um
 * valor legítimo a mandar como `null` (é assim que se apaga uma taxa máxima),
 * enquanto texto inválido tem que travar o salvamento. Um `null` só não
 * distingue as duas coisas, então o resultado é marcado.
 */

export type ParsedNumber = { ok: true; value: number | null } | { ok: false; message: string };

/**
 * Texto do campo → número, aceitando a vírgula decimal do Brasil.
 *
 * O ponto é tratado como separador de milhar ("1.234,50"), igual ao cardápio:
 * quem digita preço no balcão escreve assim.
 */
export function parseDecimal(raw: string, { allowEmpty = true } = {}): ParsedNumber {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return allowEmpty ? { ok: true, value: null } : { ok: false, message: 'Preencha este campo.' };
  }

  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { ok: false, message: 'Use apenas números.' };
  if (value < 0) return { ok: false, message: 'O valor não pode ser negativo.' };
  return { ok: true, value };
}

/** O mesmo, para campo que só aceita inteiro (minutos). */
export function parseInteger(raw: string, { allowEmpty = true } = {}): ParsedNumber {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return allowEmpty ? { ok: true, value: null } : { ok: false, message: 'Preencha este campo.' };
  }

  if (!/^\d+$/.test(trimmed)) return { ok: false, message: 'Use apenas números inteiros.' };
  return { ok: true, value: Number(trimmed) };
}

/**
 * Coordenada geográfica: aceita negativo (o Brasil inteiro é latitude
 * negativa) e exige que o número esteja na faixa válida — uma latitude de 100
 * não existe, e mandá-la faria o Google medir a distância a partir do nada.
 */
export function parseCoordinate(raw: string, kind: 'latitude' | 'longitude'): ParsedNumber {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };

  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value)) return { ok: false, message: 'Use apenas números.' };

  const limit = kind === 'latitude' ? 90 : 180;
  if (value < -limit || value > limit) {
    return { ok: false, message: `A ${kind} vai de -${limit} a ${limit}.` };
  }
  return { ok: true, value };
}

/** Número da API → texto do campo, no formato que o lojista digita. */
export function formatDecimalInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(2).replace('.', ',');
}

export function formatIntegerInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(value);
}

/** Coordenada mantém as casas que vieram: arredondar move a loja no mapa. */
export function formatCoordinateInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(value);
}

/**
 * O tempo estimado é uma FAIXA: mínimo e máximo andam juntos.
 *
 * Só um dos dois preenchido é meio caminho — o app do cliente mostra "25 a ?" —
 * e um máximo abaixo do mínimo inverte a faixa. As duas conferências ficam
 * aqui, e não espalhadas no formulário, porque valem para a dupla e não para
 * cada campo isolado.
 */
export function checkEstimatedRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min === null || max === null) {
    return 'Informe os dois lados da faixa: o mínimo e o máximo.';
  }
  if (max < min) return 'O tempo máximo não pode ser menor que o mínimo.';
  return null;
}
