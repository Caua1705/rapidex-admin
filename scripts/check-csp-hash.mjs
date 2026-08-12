/*
 * O hash do script inline do tema, no vercel.json, contra o index.html.
 *
 * POR QUÊ ISTO EXISTE
 *
 * O `index.html` tem um `<script>` inline — o que aplica o tema antes do
 * primeiro pixel. Uma CSP com `script-src 'self'` bloqueia script inline, e a
 * saída seria `'unsafe-inline'`, que devolveria justamente o que a CSP existe
 * para impedir: o painel guarda o token de 12h no `localStorage`, e um XSS com
 * inline liberado o lê. Então o script é liberado por HASH.
 *
 * O preço do hash é que ele casa byte a byte. Editar o script do tema sem
 * atualizar o `vercel.json` faz o navegador BLOQUEAR o script: o tema escuro
 * volta a piscar branco a cada F5, e o único aviso é uma linha no console que
 * ninguém está olhando. Esta verificação transforma isso em erro do
 * `npm run lint`.
 *
 * Se o hash não bater, a saída já traz o valor certo para colar.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const html = readFileSync(join(projectRoot, 'index.html'), 'utf8');
const vercelJson = readFileSync(join(projectRoot, 'vercel.json'), 'utf8');

// `<script>` sem atributo: o do tema é o único assim no arquivo. Os outros
// trazem `src=` ou `type=`, e script externo não entra em hash.
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

if (inlineScripts.length === 0) {
  console.error('check-csp-hash: nenhum <script> inline no index.html.');
  console.error('Se o script do tema saiu, remova o sha256- do vercel.json também.');
  process.exit(1);
}

const faltando = [];

for (const conteudo of inlineScripts) {
  const hash = createHash('sha256').update(conteudo, 'utf8').digest('base64');
  const diretiva = `'sha256-${hash}'`;
  if (!vercelJson.includes(diretiva)) {
    faltando.push(diretiva);
  }
}

if (faltando.length > 0) {
  console.error('check-csp-hash: o vercel.json não libera o script inline do index.html.\n');
  console.error('Ponha em script-src, no vercel.json:\n');
  for (const diretiva of faltando) {
    console.error(`  ${diretiva}`);
  }
  console.error('\nSem isso o navegador bloqueia o script e o tema volta a piscar.');
  process.exit(1);
}

console.log(`check-csp-hash: ok (${inlineScripts.length} script inline conferido).`);
