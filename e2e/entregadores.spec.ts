/**
 * ============================================================================
 * O CADASTRO DE ENTREGADOR
 * ============================================================================
 *
 * A tela é de UMA FILIAL, e isso não é recorte de conveniência: o telefone é
 * único dentro da filial e `branch_id` é obrigatório no cadastro. Quem serve
 * duas lojas tem dois cadastros.
 *
 * O QUE ESTES TESTES PROTEGEM, além do caminho feliz:
 *
 *   - o corpo do POST leva a filial e o do PATCH NÃO pode levá-la;
 *   - o 409 de telefone repetido aparece NO CAMPO, e o formulário não some;
 *   - desativar tira o acesso e reativar não o recria;
 *   - excluir avisa o que não volta, e oferece a alternativa que volta;
 *   - o atendente lê a lista e não vê nenhuma das três escritas.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function abrirEntregadores(page: Page) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);

  await page.getByRole('link', { name: 'Entregadores' }).first().click();
  await expect(page).toHaveURL(/\/entregadores$/);
  await expect(page.getByRole('heading', { name: 'Entregadores' })).toBeVisible();
}

/*
 * A LISTA TRAZ OS INATIVOS. É assim que se religa quem foi desativado — e uma
 * lista só de ativos deixaria o lojista sem caminho de volta, cadastrando de
 * novo alguém que já existe (e tomando 409 no telefone).
 */
test('a lista mostra ativos e desativados, na ordem do backend', async ({ page }) => {
  await abrirEntregadores(page);

  const linhas = page.locator('tbody tr');
  await expect(linhas).toHaveCount(3);

  // `ORDER BY name ASC` do banco, e a tela NÃO reordena.
  await expect(linhas.nth(0)).toContainText('Ana Souza');
  await expect(linhas.nth(1)).toContainText('Jorge Lima');
  await expect(linhas.nth(2)).toContainText('Rita Alves');

  await expect(linhas.nth(2)).toContainText('Desativado');
});

/*
 * O TELEFONE É LIDO EM VOZ ALTA PARA DISCAR. Onze dígitos corridos obrigam a
 * pessoa a contar com o dedo na tela.
 */
test('o telefone aparece agrupado, e não em dígitos corridos', async ({ page }) => {
  await abrirEntregadores(page);

  await expect(page.locator('tbody tr').nth(0)).toContainText('(85) 98888-7777');
});

test('cadastrar manda a filial no corpo, e o telefone só com dígitos', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-novo').click();
  await page.getByTestId('courier-name').fill('Pedro Nunes');
  await page.getByTestId('courier-phone').fill('(85) 91234-5678');
  await page.getByRole('button', { name: 'Cadastrar' }).click();

  await expect(page.getByTestId('courier-name')).toHaveCount(0);
  await expect(page.locator('tbody')).toContainText('Pedro Nunes');

  const corpo = api.courierPosts().at(-1)!;
  expect(corpo.name).toBe('Pedro Nunes');
  expect(corpo.phone).toBe('85912345678');
  expect(corpo.branch_id).toBeTruthy();
});

/*
 * ============================================================================
 * O 409 DO TELEFONE REPETIDO — no campo, e com o formulário aberto
 * ============================================================================
 *
 * Um conflito de campo mostrado no rodapé faz a pessoa reler o formulário
 * inteiro procurando o que está errado num formulário que tem exatamente um
 * lugar possível. E o formulário NÃO PODE FECHAR: fechar é perder o nome que
 * ela acabou de digitar.
 */
test('telefone repetido volta no campo do telefone, e o formulário fica', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-novo').click();
  await page.getByTestId('courier-name').fill('Outro Jorge');
  // O mesmo número do Jorge Lima, que a semente já tem nesta filial.
  await page.getByTestId('courier-phone').fill('85999990000');
  await page.getByRole('button', { name: 'Cadastrar' }).click();

  await expect(page.getByTestId('courier-phone-error')).toContainText('telefone');
  await expect(page.getByTestId('courier-name')).toHaveValue('Outro Jorge');
});

test('editar manda só o que mudou, e NUNCA a filial', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-edit-ent-jorge').click();
  await page.getByTestId('courier-name').fill('Jorge Lima Filho');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.locator('tbody')).toContainText('Jorge Lima Filho');

  const { body } = api.courierPatches().at(-1)!;
  expect(body).toEqual({ name: 'Jorge Lima Filho' });
  /*
   * `AdminCourierUpdate` é `extra="forbid"`: a filial num PATCH é 422, e não
   * campo ignorado. O falso cobra isso — se a tela a mandasse, este teste
   * falharia no 422 antes de chegar aqui.
   */
  expect(body).not.toHaveProperty('branch_id');
  expect(body).not.toHaveProperty('phone');
});

/*
 * REABRIR E SALVAR SEM MEXER EM NADA não pode mandar o telefone de volta: o
 * backend conferiria repetição contra a própria linha, e o lojista levaria um
 * 409 numa edição que não editou nada.
 */
test('salvar sem mudar nada não manda campo nenhum', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-edit-ent-jorge').click();
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByTestId('courier-name')).toHaveCount(0);
  expect(api.courierPatches().at(-1)!.body).toEqual({});
});

/*
 * ============================================================================
 * DESATIVAR NÃO É EXCLUIR
 * ============================================================================
 */
test('desativar tira o acesso na hora, e reativar não o recria', async ({ page }) => {
  await abrirEntregadores(page);

  const linhaAna = page.locator('tbody tr').filter({ hasText: 'Ana Souza' });
  await expect(linhaAna).toContainText('Acesso gerado');

  await page.getByTestId('courier-toggle-ent-ana').click();
  await expect(linhaAna).toContainText('Desativado');
  await expect(linhaAna).toContainText('Sem acesso');

  // Reativar devolve o cadastro e NÃO o acesso: o par gerado antes morreu.
  await page.getByTestId('courier-toggle-ent-ana').click();
  await expect(linhaAna).toContainText('Ativo');
  await expect(linhaAna).toContainText('Sem acesso');
});

test('excluir avisa o que não volta, e oferece o que volta', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-delete-ent-rita').click();

  const dialogo = page.getByTestId('courier-excluir-dialogo');
  await expect(dialogo).toContainText('voltam para a fila');
  await expect(dialogo).toContainText('histórico de corridas continua');
  // A ALTERNATIVA REVERSÍVEL, porque ela existe: "vai viajar" e "saiu da loja"
  // pedem coisas diferentes, e só uma delas tem volta.
  await expect(dialogo).toContainText('desative');

  await page.getByTestId('courier-excluir-dialogo-confirmar').click();

  await expect(page.locator('tbody')).not.toContainText('Rita Alves');
  expect(api.couriers().some((c) => c.name === 'Rita Alves')).toBe(false);
});

/*
 * ============================================================================
 * AS RECUSAS
 * ============================================================================
 */

test('nome vazio é recusado antes de sair da tela', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-novo').click();
  await page.getByTestId('courier-phone').fill('85912345678');
  await page.getByRole('button', { name: 'Cadastrar' }).click();

  await expect(page.getByTestId('courier-name-error')).toBeVisible();
  expect(api.courierPosts()).toHaveLength(0);
});

test('telefone curto é recusado contando DÍGITOS, e não caracteres', async ({ page }) => {
  await abrirEntregadores(page);

  await page.getByTestId('courier-novo').click();
  await page.getByTestId('courier-name').fill('Pedro');
  // Nove caracteres, seis dígitos: passa por um `min_length` de string e morre
  // no `_phone_digits` do backend.
  await page.getByTestId('courier-phone').fill('(85) 9999');
  await page.getByRole('button', { name: 'Cadastrar' }).click();

  await expect(page.getByTestId('courier-phone-error')).toContainText('dígitos');
  expect(api.courierPosts()).toHaveLength(0);
});

test('o backend recusando a exclusão deixa a linha onde estava', async ({ page }) => {
  await abrirEntregadores(page);

  await page.route('**/admin/couriers/*', (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Este entregador ainda está com pedidos abertos.' }),
    });
  });

  await page.getByTestId('courier-delete-ent-rita').click();
  await page.getByTestId('courier-excluir-dialogo-confirmar').click();

  await expect(page.getByTestId('courier-excluir-dialogo')).toContainText('pedidos abertos');
  await expect(page.locator('tbody')).toContainText('Rita Alves');
});

test('leitura que falha não vira "nenhum entregador"', async ({ page }) => {
  await page.route('**/admin/couriers*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.abort();
  });

  await abrirEntregadores(page);

  /*
   * Lista vazia é uma AFIRMAÇÃO ("esta filial não tem entregador") e é a tela
   * que o lojista vê antes de cadastrar o primeiro. Dizê-la por causa de uma
   * queda de rede o faria cadastrar de novo quem já existe — e tomar 409.
   */
  await expect(page.getByTestId('couriers-error')).toBeVisible();
  await expect(page.getByTestId('couriers-vazio')).toHaveCount(0);
});

/*
 * ============================================================================
 * OS PAPÉIS
 * ============================================================================
 *
 * VER É DE QUEM OPERA, MEXER É DA GERÊNCIA. O atendente precisa da lista — é
 * ele que está no balcão quando o motoboy chega —, e não cadastra ninguém.
 */
test('o atendente lê a lista e não vê nenhuma das três escritas', async ({ page }) => {
  api.entrarComoPapel('attendant');

  await abrirEntregadores(page);

  await expect(page.locator('tbody')).toContainText('Jorge Lima');

  await expect(page.getByTestId('courier-novo')).toHaveCount(0);
  await expect(page.getByTestId('courier-edit-ent-jorge')).toHaveCount(0);
  await expect(page.getByTestId('courier-toggle-ent-jorge')).toHaveCount(0);
  await expect(page.getByTestId('courier-delete-ent-jorge')).toHaveCount(0);
});
