/**
 * ============================================================================
 * O CORPO RECEBIDO, CONFERIDO CONTRA O SCHEMA DO CONTRATO
 * ============================================================================
 *
 * `e2e/contrato.ts` fechou a deriva de FORMA: a rota é `keyof paths`, o corpo
 * da RESPOSTA é tipado pelo contrato, e um status que ele não declara vira
 * `never`. O que ficou aberto, e está escrito em
 * `scratchpad/falso-contra-o-contrato.md`, é a deriva de REGRA no sentido
 * inverso: **o falso aceitava qualquer corpo que o painel mandasse.**
 *
 * Um `name` de 300 caracteres, um `additional_price` negativo, um `weekday: 9`,
 * um enum com um sexto valor — tudo isso o dublê engolia com 200, e produção
 * responderia 422. A suíte fica verde e o defeito chega ao lojista. É a mesma
 * família do §4.10 da skill `rapidex-api`, e a metade que faltava dela.
 *
 * ----------------------------------------------------------------------------
 * POR QUE UM VALIDADOR ESCRITO AQUI, E NÃO UMA BIBLIOTECA
 * ----------------------------------------------------------------------------
 *
 * O contrato é OpenAPI 3.1, cujo dialeto é JSON Schema 2020-12. O `ajv` que
 * está na árvore é o 6.x, de draft-07, e veio de carona por outra dependência —
 * usar o que calhou de estar instalado é como o portão passa a depender de um
 * detalhe que ninguém escolheu.
 *
 * E o que precisa ser conferido é PEQUENO E FECHADO. Resolvendo todos os
 * `$ref` a partir dos `requestBody` de `/admin`, o contrato inteiro usa
 * dezenove palavras-chave, e nenhuma delas é das difíceis: não há `allOf`,
 * `oneOf`, `if/then`, `$defs` nem referência circular.
 *
 * ----------------------------------------------------------------------------
 * A DECISÃO QUE FAZ ISTO SER HONESTO: PALAVRA DESCONHECIDA É ERRO
 * ----------------------------------------------------------------------------
 *
 * Um validador caseiro que IGNORA o que não entende é pior que nenhum: ele
 * aprova em silêncio exatamente a regra nova que o backend acabou de escrever,
 * e ninguém descobre. Aqui, uma palavra-chave fora de `CONHECIDAS` derruba a
 * validação com o nome dela na mensagem — e `src/contrato-conhecido.test.ts` cobra a lista
 * inteira contra o contrato versionado, então o dia em que o backend usar
 * `oneOf` o portão fica vermelho ANTES de alguém depender disso.
 */

/**
 * As palavras-chave que este validador entende.
 *
 * Três grupos: as que RESTRINGEM (e são o assunto), as que só DESCREVEM (o
 * validador as ignora de propósito, e a lista diz que a omissão é decisão), e
 * `default`, que descreve o que o servidor faz quando o campo não vem — nunca o
 * que ele aceita.
 */
export const CONHECIDAS = new Set([
  // restringem
  'type',
  'properties',
  'required',
  'anyOf',
  'enum',
  'const',
  'items',
  'maxItems',
  'minItems',
  'maxLength',
  'minLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'pattern',
  'additionalProperties',
  // descrevem, e não restringem
  'title',
  'description',
  'format',
  'default',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
]);

/** As que só descrevem: presentes, mas sem efeito sobre o que é aceito. */
const SO_DESCREVEM = new Set([
  'title',
  'description',
  'format',
  'default',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
]);

type Schema = Record<string, unknown>;

/** O documento inteiro, para resolver `$ref`. */
export type Contrato = { components?: { schemas?: Record<string, Schema> } };

function resolver(schema: Schema, contrato: Contrato): Schema {
  const ref = schema['$ref'];
  if (typeof ref !== 'string') return schema;

  const nome = ref.split('/').pop() ?? '';
  const alvo = contrato.components?.schemas?.[nome];
  if (!alvo) throw new Error(`schema.ts: $ref sem alvo no contrato: ${ref}`);
  return alvo;
}

/**
 * `type` em 3.1 pode ser lista (`["string","null"]`). Um valor casa quando casa
 * com QUALQUER um dos tipos declarados.
 */
function casaTipo(tipo: string, valor: unknown): boolean {
  switch (tipo) {
    case 'null':
      return valor === null;
    case 'boolean':
      return typeof valor === 'boolean';
    case 'string':
      return typeof valor === 'string';
    // O 3.1 separa os dois, e a separação importa: `sort_order` é `integer`, e
    // um 1.5 ali é 422 em produção.
    case 'integer':
      return typeof valor === 'number' && Number.isInteger(valor);
    case 'number':
      return typeof valor === 'number' && Number.isFinite(valor);
    case 'array':
      return Array.isArray(valor);
    case 'object':
      return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
    default:
      throw new Error(`schema.ts: tipo que este validador não conhece: ${tipo}`);
  }
}

/**
 * Os problemas do valor contra o schema. Lista vazia = corpo aceito.
 *
 * Devolve TODOS os problemas, e não o primeiro: um corpo com dois campos
 * errados corrigido um por vez custa duas execuções do e2e.
 */
export function problemasDoCorpo(
  valor: unknown,
  schema: Schema,
  contrato: Contrato,
  caminho = 'corpo',
): string[] {
  const alvo = resolver(schema, contrato);

  const desconhecidas = Object.keys(alvo).filter(
    (chave) => chave !== '$ref' && !CONHECIDAS.has(chave),
  );
  if (desconhecidas.length > 0) {
    // Erro, e não aviso. Ver o cabeçalho: ignorar o que não se entende é
    // aprovar em silêncio a regra que o backend acabou de escrever.
    throw new Error(
      `schema.ts: o contrato usa palavra-chave que este validador não conhece em ${caminho}: ` +
        `${desconhecidas.join(', ')}. Ensine-a antes de confiar nesta conferência.`,
    );
  }

  const problemas: string[] = [];

  /*
   * `anyOf` PRIMEIRO, e ele decide sozinho.
   *
   * É a forma que o FastAPI dá a todo campo anulável e a todo `number | string`
   * de dinheiro do Rapidex. Um `anyOf` casa quando ALGUM ramo casa, e os erros
   * dos ramos que falharam não são erros do valor.
   */
  const anyOf = alvo['anyOf'];
  if (Array.isArray(anyOf)) {
    const casou = anyOf.some(
      (ramo) => problemasDoCorpo(valor, ramo as Schema, contrato, caminho).length === 0,
    );
    if (!casou) {
      problemas.push(`${caminho}: não casa com nenhuma das ${anyOf.length} formas aceitas`);
    }
    // As outras palavras deste nível (só `title`/`description` na prática)
    // não acrescentam restrição.
    return problemas;
  }

  const enumerado = alvo['enum'];
  if (Array.isArray(enumerado) && !enumerado.includes(valor)) {
    problemas.push(`${caminho}: ${JSON.stringify(valor)} não está em ${JSON.stringify(enumerado)}`);
  }

  if ('const' in alvo && valor !== alvo['const']) {
    problemas.push(`${caminho}: esperado ${JSON.stringify(alvo['const'])}`);
  }

  const tipo = alvo['type'];
  const tipos = typeof tipo === 'string' ? [tipo] : Array.isArray(tipo) ? (tipo as string[]) : null;
  if (tipos && !tipos.some((t) => casaTipo(t, valor))) {
    problemas.push(`${caminho}: esperado ${tipos.join(' | ')}, veio ${typeof valor}`);
    // Sem o tipo certo, as restrições abaixo não têm o que medir.
    return problemas;
  }

  if (typeof valor === 'string') {
    const max = alvo['maxLength'];
    const min = alvo['minLength'];
    if (typeof max === 'number' && valor.length > max) {
      problemas.push(`${caminho}: ${valor.length} caracteres, o máximo é ${max}`);
    }
    if (typeof min === 'number' && valor.length < min) {
      problemas.push(`${caminho}: ${valor.length} caracteres, o mínimo é ${min}`);
    }
    const padrao = alvo['pattern'];
    if (typeof padrao === 'string' && !new RegExp(padrao).test(valor)) {
      problemas.push(`${caminho}: não casa com o padrão ${padrao}`);
    }
  }

  if (typeof valor === 'number') {
    const min = alvo['minimum'];
    const max = alvo['maximum'];
    const exMin = alvo['exclusiveMinimum'];
    const exMax = alvo['exclusiveMaximum'];
    if (typeof min === 'number' && valor < min) problemas.push(`${caminho}: ${valor} < ${min}`);
    if (typeof max === 'number' && valor > max) problemas.push(`${caminho}: ${valor} > ${max}`);
    if (typeof exMin === 'number' && valor <= exMin) {
      problemas.push(`${caminho}: ${valor} não é maior que ${exMin}`);
    }
    if (typeof exMax === 'number' && valor >= exMax) {
      problemas.push(`${caminho}: ${valor} não é menor que ${exMax}`);
    }
  }

  if (Array.isArray(valor)) {
    const max = alvo['maxItems'];
    const min = alvo['minItems'];
    if (typeof max === 'number' && valor.length > max) {
      problemas.push(`${caminho}: ${valor.length} itens, o máximo é ${max}`);
    }
    if (typeof min === 'number' && valor.length < min) {
      problemas.push(`${caminho}: ${valor.length} itens, o mínimo é ${min}`);
    }
    const itens = alvo['items'];
    if (itens && typeof itens === 'object') {
      valor.forEach((item, i) => {
        problemas.push(...problemasDoCorpo(item, itens as Schema, contrato, `${caminho}[${i}]`));
      });
    }
  }

  if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
    const objeto = valor as Record<string, unknown>;
    const obrigatorios = alvo['required'];
    if (Array.isArray(obrigatorios)) {
      for (const campo of obrigatorios as string[]) {
        if (!(campo in objeto)) problemas.push(`${caminho}.${campo}: obrigatório e ausente`);
      }
    }

    const props = (alvo['properties'] ?? {}) as Record<string, Schema>;
    for (const [campo, sub] of Object.entries(props)) {
      if (campo in objeto) {
        problemas.push(...problemasDoCorpo(objeto[campo], sub, contrato, `${caminho}.${campo}`));
      }
    }

    /*
     * CAMPO A MAIS NÃO É ERRO, e isso é o backend, não folga nossa: o Pydantic
     * IGNORA chave desconhecida por padrão. É por isso que mandar `changed_by`
     * numa rota que já o removeu "não quebra, só não tem efeito nenhum — o que
     * é pior que quebrar" (skill `rapidex-api` §5). Fingir 422 aqui faria o
     * falso ser mais ESTRITO que produção, que é o outro jeito de mentir.
     */
    const extras = alvo['additionalProperties'];
    if (extras && typeof extras === 'object') {
      const declarados = new Set(Object.keys(props));
      for (const [campo, sub] of Object.entries(objeto)) {
        if (!declarados.has(campo)) {
          problemas.push(
            ...problemasDoCorpo(sub, extras as Schema, contrato, `${caminho}.${campo}`),
          );
        }
      }
    }
  }

  return problemas;
}

/** Só para o teste que cobra a lista: as que existem e não medem nada. */
export const APENAS_DESCRITIVAS = SO_DESCREVEM;
