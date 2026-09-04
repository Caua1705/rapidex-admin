/**
 * A PROVA DO AMARRE.
 *
 * `contrato.ts` passou a ser a peça de que os 383 testes de e2e dependem: se
 * `casar` casasse errado, o falso responderia a rota errada e a suíte inteira
 * acusaria. Isso vale para o caminho feliz — e é justamente o que estes testes
 * NÃO precisam provar.
 *
 * O que eles provam é o contrário: que as três conferências REPROVAM. Nenhuma
 * delas dispara enquanto o falso está certo, então nenhum outro teste as
 * exercita, e uma conferência que nunca falhou é indistinguível de uma que não
 * funciona. É a mesma lição do `stream-ticket` da rodada passada: um teste que
 * não pode falhar não é cobertura.
 */
import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

import { casar, recusar, recusarEmQualquerMetodo, responder } from './contrato';

/**
 * Um `Route` de mentira, com o mínimo que as conferências leem. `fulfill`
 * registra o que saiu para o teste poder afirmar que a resposta chegou a sair —
 * sem isso, "não lançou" e "não respondeu" seriam a mesma coisa.
 */
function rotaFalsa(metodo: string, url: string) {
  const saidas: { status: number; body: string }[] = [];
  const route = {
    request: () => ({ method: () => metodo, url: () => url }),
    fulfill: (opcoes: { status: number; body: string }) => {
      saidas.push(opcoes);
      return Promise.resolve();
    },
  } as unknown as Route;
  return { route, saidas };
}

test('casar devolve os parâmetros com o NOME que o contrato lhes deu', () => {
  const achado = casar('/admin/branches/abc-123/settings', '/admin/branches/{branch_id}/settings');
  expect(achado).toEqual({ branch_id: 'abc-123' });
});

test('casar não confunde uma rota de nome fixo com um id', () => {
  // `/admin/categories/reorder` e `/admin/categories/{category_id}` têm a mesma
  // forma; quem os separa é a ORDEM dos ramos no falso, e este teste prende que
  // o casamento sozinho de fato aceita os dois — que é por que a ordem importa.
  expect(casar('/admin/categories/reorder', '/admin/categories/{category_id}')).toEqual({
    category_id: 'reorder',
  });
  expect(casar('/admin/categories/abc/extra', '/admin/categories/{category_id}')).toBeNull();
});

test('casar recusa o segmento vazio', () => {
  expect(casar('/admin/products//image', '/admin/products/{product_id}/image')).toBeNull();
});

test('responder recusa a rota que o chamador nomeou errado', () => {
  const { route, saidas } = rotaFalsa('GET', 'http://api.local/admin/auth/me');
  /*
   * A conferência lança NA HORA, antes de qualquer `await`: uma resposta errada
   * não pode chegar a sair pela rede, nem ficar de promessa pendente. É por isso
   * que estes três testes são síncronos.
   */
  expect(() => responder(route, 'get', '/admin/branches', 200, [])).toThrow(
    /caminho pedido foi \/admin\/auth\/me/,
  );
  expect(saidas).toHaveLength(0);
});

test('responder recusa o método que o chamador nomeou errado', () => {
  const { route, saidas } = rotaFalsa('GET', 'http://api.local/admin/settings');
  expect(() =>
    responder(route, 'patch', '/admin/settings', 200, {
      restaurant_id: 'r1',
    } as never),
  ).toThrow(/como PATCH, e a requisição foi GET/);
  expect(saidas).toHaveLength(0);
});

test('recusar não deixa passar um corpo de erro que a tela não sabe ler', () => {
  const { route, saidas } = rotaFalsa('POST', 'http://api.local/admin/coupons');
  // `{ motivo: ... }` não é nenhum dos quatro formatos de `src/api/errors.ts`:
  // na tela ele viraria "A requisição falhou (409)", e o teste que o dublasse
  // afirmaria uma frase que produção nunca manda.
  expect(() =>
    recusar(route, 'post', '/admin/coupons', 409, { motivo: 'código repetido' }),
  ).toThrow(/não sabe ler/);
  expect(saidas).toHaveLength(0);
});

test('recusar aceita os formatos de erro que a tela lê', async () => {
  const { route, saidas } = rotaFalsa('POST', 'http://api.local/admin/coupons');
  await recusar(route, 'post', '/admin/coupons', 409, { detail: 'Codigo de cupom ja existe' });
  await recusar(route, 'post', '/admin/coupons', 422, {
    detail: [{ loc: ['body', 'code'], msg: 'código inválido' }],
  });
  // `detail` como OBJETO — o formato do 428, que já custou semanas.
  await recusar(route, 'post', '/admin/coupons', 428, {
    detail: { code: 'confirmation_required', message: 'Confirma?' },
  });
  expect(saidas.map((saida) => saida.status)).toEqual([409, 422, 428]);
});

test('recusarEmQualquerMetodo confere o caminho, e só ele', async () => {
  const { route, saidas } = rotaFalsa('DELETE', 'http://api.local/admin/couriers/c-1');
  await recusarEmQualquerMetodo(route, '/admin/couriers/{courier_id}', 404, {
    detail: 'Entregador não encontrado',
  });
  expect(saidas).toHaveLength(1);

  const outra = rotaFalsa('DELETE', 'http://api.local/admin/couriers/c-1/access');
  expect(() =>
    recusarEmQualquerMetodo(outra.route, '/admin/couriers/{courier_id}', 404, { detail: 'x' }),
  ).toThrow(/caminho pedido/);
});
