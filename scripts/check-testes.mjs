/*
 * ============================================================================
 * TESTE QUE NÃO AFIRMA NADA DE VERDADE
 * ============================================================================
 *
 * ISTO EXISTE POR UM CASO REAL, e ele é meu: `src/zz-tz-probe.test.ts`, uma
 * sonda descartável com `expect(1).toBe(1)`, foi commitada por engano em
 * `8c85416` e passou a rodar dentro de uma suíte de mil casos. Ninguém viu —
 * porque um teste verde a mais não se distingue dos outros mil, e o número
 * total só cresceu.
 *
 * Um teste assim é pior que um teste ausente. Ausente ninguém conta; presente,
 * ele entra na contagem que a rodada usa para dizer que cobriu.
 *
 * ----------------------------------------------------------------------------
 * AS QUATRO FORMAS, E AS DUAS ÚLTIMAS SÃO AS QUE ENGANAM
 * ----------------------------------------------------------------------------
 *
 *   1. `expect(1).toBe(1)` — os dois lados o MESMO texto, seja um literal ou
 *      uma leitura pura (`expect(cupom.id).toBe(cupom.id)`). Óbvia quando se
 *      olha, invisível quando se conta.
 *   2. teste com corpo vazio.
 *   3. teste que MONTA e não confere: chama a função, guarda o resultado, e
 *      nenhuma asserção. Parece teste, ocupa a linha do relatório, e a única
 *      coisa que ele prova é que a função não lança.
 *   4. `expect(x);` sem matcher — a chamada morre no argumento e não afirma
 *      nada. É a que mais se parece com um teste de verdade.
 *
 * ----------------------------------------------------------------------------
 * O QUE ELE NÃO PODE ACUSAR, e por que a calibragem importa
 * ----------------------------------------------------------------------------
 *
 * Falso positivo aqui custa mais que falso negativo: ele manda mexer num teste
 * que está certo. Quatro padrões que PARECEM tautologia e não são, e contra os
 * quais a régua foi conferida ANTES de entrar no portão:
 *
 *   - `expect(1).not.toBe(2)` — negação afirma alguma coisa;
 *   - `expect(2 + 2).toBe(4)` — mesma FORMA, valores diferentes;
 *   - `expect(f).toThrow()` — afirma por outro caminho, sem `toBe`;
 *   - `expect(rng()).toBe(rng())` — CHAMADA dos dois lados fica de fora de
 *     propósito: pode ser teste legítimo de idempotência, e `fila.pop()` tem
 *     efeito colateral. A ausência de `(` é o que torna a regra 1 segura.
 *
 * A calibragem foi medida, e não presumida: arquivos-isca com as formas ruins
 * e as boas acusaram exatamente as ruins, e a régua rodada contra o commit
 * `8c85416` — o que tinha a sonda — a encontra.
 *
 * Roda no `npm run lint`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function arquivos(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, out);
    else if (/\.(test\.tsx?|spec\.ts)$/.test(nome)) out.push(p);
  }
  return out;
}

/** Os argumentos de topo de uma chamada, respeitando aninhamento e literais. */
function args(src, abre) {
  let nivel = 0;
  let atual = '';
  const out = [];
  let aspas = null;
  const BARRA = String.fromCharCode(92);
  for (let i = abre; i < src.length; i += 1) {
    const c = src[i];
    if (aspas) {
      if (c === BARRA) {
        atual += c + src[i + 1];
        i += 1;
        continue;
      }
      if (c === aspas) aspas = null;
      atual += c;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      aspas = c;
      atual += c;
      continue;
    }
    if ('([{'.includes(c)) {
      nivel += 1;
      if (nivel === 1) continue;
    }
    if (')]}'.includes(c)) {
      nivel -= 1;
      if (nivel === 0) {
        out.push(atual);
        return out;
      }
    }
    if (c === ',' && nivel === 1) {
      out.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  return null;
}

/**
 * O índice do `)` que fecha a chamada aberta em `abre`, ou `-1`.
 *
 * Conta o aninhamento e pula o que está dentro de literal de texto — as duas
 * coisas que fazem `indexOf(')')` responder o parêntese errado.
 */
function fimDaChamada(src, abre) {
  let nivel = 0;
  let aspas = null;
  const BARRA = String.fromCharCode(92);
  for (let i = abre; i < src.length; i += 1) {
    const c = src[i];
    if (aspas) {
      if (c === BARRA) {
        i += 1;
        continue;
      }
      if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      aspas = c;
      continue;
    }
    if (c === '(') nivel += 1;
    if (c === ')') {
      nivel -= 1;
      if (nivel === 0) return i;
    }
  }
  return -1;
}

/** O corpo `{...}` que começa em `abre`. */
function bloco(src, abre) {
  let nivel = 0;
  for (let i = abre; i < src.length; i += 1) {
    if (src[i] === '{') nivel += 1;
    if (src[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return src.slice(abre, i + 1);
    }
  }
  return '';
}

const achados = [];
let casos = 0;
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const raizes = ['src', 'e2e'];

for (const raiz of raizes) {
  for (const arquivo of arquivos(join(projectRoot, raiz))) {
    const rel = relative(projectRoot, arquivo).split(sep).join('/');
    const src = readFileSync(arquivo, 'utf8');
    const linhaDe = (i) => src.slice(0, i).split('\n').length;

    // --- 1. TAUTOLOGIA: expect(X).toBe(X) / toEqual(X) com os dois lados iguais
    const reExpect = /(?<![.\w])expect\s*\(/g;
    let m;
    while ((m = reExpect.exec(src))) {
      const abre = m.index + m[0].length - 1;
      const a = args(src, abre);
      if (!a || a.length !== 1) continue;
      const alvo = a[0].trim();

      /*
       * O FECHA-PARÊNTESES É CONTADO, e não procurado com `indexOf`.
       *
       * `expect(soma()).toBe(1)` e `expect('a)b').toBe('a)b')` têm um `)` no
       * meio do argumento; o primeiro que aparece não é o da chamada. Com
       * `indexOf` os dois passavam despercebidos — falso NEGATIVO, que é o erro
       * barato desta régua, mas não é motivo para deixá-lo.
       */
      const fecha = fimDaChamada(src, abre);
      if (fecha < 0) continue;
      const cauda = src.slice(fecha, fecha + 200);
      const mm =
        /^\)\s*\.\s*(?:resolves\s*\.\s*|rejects\s*\.\s*)?(not\s*\.\s*)?(toBe|toEqual|toStrictEqual)\s*\(/.exec(
          cauda,
        );
      if (!mm) continue;
      const esperado = args(src, fecha + mm[0].length - 1);
      if (!esperado || esperado.length !== 1) continue;
      const valor = esperado[0].trim();

      const literal = /^(true|false|null|undefined|-?\d+(\.\d+)?|'.*'|".*"|`[^`]*`)$/s;
      /*
       * Leitura pura: identificador ou acesso a propriedade, SEM chamada.
       * `expect(cupom.id).toBe(cupom.id)` é tão tautológico quanto
       * `expect(1).toBe(1)`, e escapava da régua de literal.
       *
       * A ausência de `(` é o que torna isto seguro: `expect(rng()).toBe(rng())`
       * pode ser um teste legítimo de idempotência, e `expect(fila.pop())` tem
       * efeito colateral — os dois ficam de fora de propósito.
       */
      const leituraPura = /^[A-Za-z_$][\w$]*(?:(?:\.[\w$]+)|(?:\[\d+\]))*$/;

      // Tautologia: os dois lados são o MESMO texto, sem `not`.
      if (!mm[1] && alvo === valor && (literal.test(alvo) || leituraPura.test(alvo))) {
        achados.push({
          rel,
          linha: linhaDe(m.index),
          tipo: 'tautologia',
          texto: `expect(${alvo}).${mm[2]}(${valor})`,
        });
      }
    }

    // --- 2. TESTE VAZIO ou sem nenhum `expect`
    const reIt =
      /(?<![.\w])(it|test)(?:\.\w+)?\s*\(\s*(['"`])((?:[^\\]|\\.)*?)\2\s*,\s*(?:async\s*)?\(\s*[^)]*\)\s*=>\s*\{/g;
    while ((m = reIt.exec(src))) {
      const abreBloco = src.indexOf('{', m.index + m[0].length - 1);
      const corpo = bloco(src, abreBloco);
      const linha = linhaDe(m.index);
      const nome = m[3];
      casos += 1;

      const semExpect = !/(?<![.\w])expect\s*\(/.test(corpo);
      const semAssercaoAlguma = semExpect && !/\b(assert|toThrow|toHaveBeenCalled)/.test(corpo);
      const corpoUtil = corpo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/[\s{}]/g, '');

      if (corpoUtil === '') {
        achados.push({ rel, linha, tipo: 'teste vazio', texto: nome });
      } else if (semAssercaoAlguma) {
        achados.push({ rel, linha, tipo: 'sem asserção nenhuma', texto: nome });
      }
    }

    // --- 3. `expect(...)` sem matcher (a chamada morre no argumento)
    const reSemMatcher = /(?<![.\w])expect\s*\([^;]*?\)\s*;/g;
    while ((m = reSemMatcher.exec(src))) {
      const trecho = m[0];
      if (/\.\s*(to|resolves|rejects|not)/.test(trecho)) continue;
      achados.push({
        rel,
        linha: linhaDe(m.index),
        tipo: 'expect sem matcher',
        texto: trecho.trim().slice(0, 70),
      });
    }
  }
}

achados.sort((a, b) => a.rel.localeCompare(b.rel) || a.linha - b.linha);

if (achados.length > 0) {
  console.error('Teste que não afirma nada de verdade:\n');
  for (const a of achados) {
    console.error(`  ${a.rel}:${a.linha}  ${a.tipo} — ${a.texto}`);
  }
  console.error(
    '\nUm teste assim é pior que um teste ausente: ausente ninguém conta;' +
      ' presente, ele entra na contagem que a rodada usa para dizer que cobriu.',
  );
  process.exit(1);
}

console.log(`Testes: os ${casos} casos de src/ e e2e/ afirmam alguma coisa.`);
