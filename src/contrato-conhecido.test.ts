import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { APENAS_DESCRITIVAS, CONHECIDAS, problemasDoCorpo } from '../e2e/schema';

/**
 * ============================================================================
 * O VALIDADOR DO FALSO CONHECE TODO O CONTRATO — ou o portão fica vermelho
 * ============================================================================
 *
 * `e2e/schema.ts` confere o corpo que o painel manda contra o schema da rota, e
 * ele é escrito à mão. Um validador caseiro tem um modo de falha que uma
 * biblioteca não tem: IGNORAR em silêncio a palavra-chave que não conhece — e
 * aprovar exatamente a regra nova que o backend acabou de escrever.
 *
 * Este teste é o que impede isso. Ele varre o contrato VERSIONADO, resolve todo
 * `$ref` a partir dos `requestBody` de `/admin`, e cobra que cada palavra-chave
 * alcançada esteja em `CONHECIDAS`. O dia em que o backend usar `oneOf`,
 * `allOf` ou `if/then`, ele fica vermelho ANTES de alguém confiar numa
 * conferência que não aconteceu.
 *
 * ELE MORA EM `src/` e não em `e2e/` de propósito: assim roda no `npm test`,
 * que é rápido e roda a cada mudança — e não só no Playwright, que é o portão
 * mais caro e o último a rodar.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contrato = JSON.parse(
  readFileSync(resolve(raiz, 'e2e', 'generated', 'openapi.json'), 'utf8'),
) as {
  paths: Record<string, Record<string, { requestBody?: unknown }>>;
  components: { schemas: Record<string, Record<string, unknown>> };
};

const METODOS = ['get', 'post', 'patch', 'put', 'delete'];

/** Toda palavra-chave alcançável a partir dos corpos de request de `/admin`. */
function palavrasDosCorpos(): Set<string> {
  const vistas = new Set<string>();
  const jaAndei = new Set<unknown>();

  function anda(no: unknown): void {
    if (!no || typeof no !== 'object' || jaAndei.has(no)) return;
    jaAndei.add(no);

    const objeto = no as Record<string, unknown>;
    const ref = objeto['$ref'];
    if (typeof ref === 'string') {
      anda(contrato.components.schemas[ref.split('/').pop() ?? '']);
      return;
    }

    for (const [chave, valor] of Object.entries(objeto)) {
      vistas.add(chave);
      if (chave === 'properties') {
        for (const sub of Object.values(valor as Record<string, unknown>)) anda(sub);
      } else if (Array.isArray(valor)) {
        valor.forEach(anda);
      } else if (valor && typeof valor === 'object') {
        anda(valor);
      }
    }
  }

  for (const [rota, operacoes] of Object.entries(contrato.paths)) {
    if (!rota.startsWith('/admin')) continue;
    for (const [metodo, operacao] of Object.entries(operacoes)) {
      if (!METODOS.includes(metodo)) continue;
      const corpo = operacao.requestBody as
        { content?: Record<string, { schema?: unknown }> } | undefined;
      anda(corpo?.content?.['application/json']?.schema);
    }
  }

  return vistas;
}

describe('o contrato cru acompanha o gerado', () => {
  /*
   * Os dois artefatos saem do MESMO `npm run api:generate`, e é isso que
   * impede um de envelhecer sozinho. Este caso é a prova barata disso: uma
   * rota que existe no `.d.ts` e não no `.json` (ou o contrário) significa que
   * alguém regravou um só.
   */
  it('as rotas do JSON são as mesmas do .d.ts', () => {
    const tipos = readFileSync(resolve(raiz, 'src', 'api', 'generated', 'openapi.d.ts'), 'utf8');
    const rotas = Object.keys(contrato.paths).filter((rota) => rota.startsWith('/admin'));

    expect(rotas.length).toBeGreaterThan(50);
    for (const rota of rotas) {
      // O `.d.ts` sai do Prettier deste repositório, que usa aspas simples.
      expect(tipos, `${rota} está no JSON e não no .d.ts`).toContain(`'${rota}'`);
    }
  });
});

describe('o validador conhece o contrato inteiro', () => {
  it('nenhuma palavra-chave dos corpos de /admin é desconhecida', () => {
    const desconhecidas = [...palavrasDosCorpos()].filter(
      (p) => !CONHECIDAS.has(p) && p !== '$ref',
    );

    expect(
      desconhecidas.sort(),
      'o backend passou a usar algo que `e2e/schema.ts` não mede — ensine-o antes de confiar na conferência',
    ).toEqual([]);
  });

  /*
   * A LISTA NÃO PODE CRESCER SEM PENSAR. Uma palavra-chave marcada como "só
   * descreve" que na verdade RESTRINGE seria uma regra do backend aprovada em
   * silêncio — o modo de falha exato que este arquivo existe para fechar.
   */
  it('as descritivas são só as que de fato não restringem nada', () => {
    expect([...APENAS_DESCRITIVAS].sort()).toEqual([
      'default',
      'deprecated',
      'description',
      'examples',
      'format',
      'readOnly',
      'title',
      'writeOnly',
    ]);
    for (const descritiva of APENAS_DESCRITIVAS) expect(CONHECIDAS.has(descritiva)).toBe(true);
  });
});

/*
 * ============================================================================
 * E O VALIDADOR MEDE O QUE DIZ QUE MEDE
 * ============================================================================
 *
 * Cada caso abaixo é uma regra REAL do contrato, com a rota nomeada — não um
 * schema inventado. Um validador provado contra schemas de brinquedo é um
 * validador que ninguém sabe se funciona.
 */
describe('o que o validador recusa', () => {
  const corpoDe = (schema: string) => contrato.components.schemas[schema]!;

  it('aceita o corpo certo', () => {
    expect(
      problemasDoCorpo(
        { name: 'Bacon', additional_price: 3.5 },
        corpoDe('AdminOptionCreate'),
        contrato,
      ),
    ).toEqual([]);
  });

  /* `name`: `min_length=1, max_length=120` — e ele SAI no contrato, aqui. */
  it('recusa nome acima do teto de `AdminOptionCreate`', () => {
    const problemas = problemasDoCorpo(
      { name: 'x'.repeat(121) },
      corpoDe('AdminOptionCreate'),
      contrato,
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('o máximo é 120');
  });

  /* `additional_price`: `ge=0`. Preço negativo é 422 em produção. */
  it('recusa preço adicional negativo', () => {
    const problemas = problemasDoCorpo(
      { name: 'Bacon', additional_price: -1 },
      corpoDe('AdminOptionCreate'),
      contrato,
    );
    expect(problemas.join(' ')).toContain('não casa com nenhuma das');
  });

  it('recusa campo obrigatório ausente', () => {
    const problemas = problemasDoCorpo(
      { additional_price: 0 },
      corpoDe('AdminOptionCreate'),
      contrato,
    );
    expect(problemas).toEqual(['corpo.name: obrigatório e ausente']);
  });

  /*
   * O `anyOf` DO DINHEIRO. `additional_price` entra `number | string`, e é
   * assim que o Rapidex declara todo valor monetário de entrada. Os dois ramos
   * precisam passar, ou o validador recusaria metade dos corpos legítimos.
   */
  it('aceita dinheiro nos DOIS formatos que o contrato declara', () => {
    for (const preco of [3.5, '3.50']) {
      expect(
        problemasDoCorpo(
          { name: 'Bacon', additional_price: preco },
          corpoDe('AdminOptionCreate'),
          contrato,
        ),
      ).toEqual([]);
    }
  });

  /*
   * `integer` NÃO É `number`, e a diferença é 422 em produção: `sort_order` é
   * inteiro, e o painel manda o índice da lista.
   */
  it('recusa fracionário onde o contrato pede inteiro', () => {
    const problemas = problemasDoCorpo(
      { name: 'Bacon', sort_order: 1.5 },
      corpoDe('AdminOptionCreate'),
      contrato,
    );
    expect(problemas.join(' ')).toContain('sort_order');
  });

  /*
   * CAMPO A MAIS NÃO É ERRO — o Pydantic ignora chave desconhecida. Recusar
   * aqui faria o falso ser mais ESTRITO que produção, que é o outro jeito de
   * mentir sobre o que a API aceita.
   */
  it('não reclama de campo que o contrato não declara', () => {
    expect(
      problemasDoCorpo(
        { name: 'Bacon', changed_by: 'sistema' },
        corpoDe('AdminOptionCreate'),
        contrato,
      ),
    ).toEqual([]);
  });

  /* Palavra-chave desconhecida é ERRO, e não silêncio. É o caso que sustenta
     tudo acima: sem ele, o validador aprovaria o que não sabe medir. */
  it('explode diante de uma palavra-chave que não conhece', () => {
    expect(() => problemasDoCorpo({}, { oneOf: [] }, contrato)).toThrow(/oneOf/);
  });
});
