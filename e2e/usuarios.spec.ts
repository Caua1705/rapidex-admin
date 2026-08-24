/**
 * E2E DA EQUIPE — as seis coisas que esta tela não pode errar.
 *
 * Não é varredura de campo: cada teste guarda uma armadilha que compila,
 * responde 200 e custa o acesso de uma pessoa — ou o do restaurante inteiro.
 *
 *   1. A SENHA APARECE UMA VEZ. O diálogo não pode fechar sozinho, e não pode
 *      fechar sem o dono dizer que copiou: perder aquele valor é perder a
 *      credencial, e a segunda via mata a primeira na mão de quem já a recebeu.
 *   2. A TROCA OBRIGATÓRIA OBEDECE O CAMPO, e não o 403. Uma tela que esperasse
 *      o 403 abriria Pedidos e só depois se fecharia.
 *   3. As guardas do dono IMPEDEM ANTES. O backend responde 400; a tela não
 *      pode chegar lá.
 *   4. Redefinir a própria senha não existe — é a guarda que o backend NÃO tem.
 *   5. O PATCH é PARCIAL. Só o corpo prova.
 *   6. A tela inteira é do dono.
 */
import { expect, test, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolher } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function entrar(page: Page, destino = '/usuarios', senha = LOGIN_PASSWORD) {
  await page.goto(destino);
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/* ==========================================================================
 * 1. A SENHA TEMPORÁRIA — a razão de a tela ser desenhada assim
 * ======================================================================= */

test('a senha aparece uma vez, e o diálogo não deixa fechar sem confirmar que copiou', async ({
  page,
}) => {
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();

  await page.getByTestId('usuarios-novo').click();
  await page.getByTestId('usuario-nome').fill('Marina Costa');
  await page.getByTestId('usuario-email').fill('marina@pizzaria.com');
  await escolher(page.getByTestId('usuario-cargo'), 'Atendente');
  await page.getByTestId('usuario-salvar').click();

  /* O aviso vem ANTES da senha: depois dela, ele é lido por quem já decidiu o
     que fazer. */
  await expect(page.getByTestId('senha-aviso')).toContainText('não vai aparecer de novo');

  const senha = api.senhasGeradas().at(-1)!;
  await expect(page.getByTestId('senha-valor')).toContainText(senha.slice(0, 5));
  /* O e-mail vai junto: a senha sozinha não abre nada, e o campo onde ele foi
     digitado já fechou. */
  await expect(page.getByTestId('senha-email')).toHaveText('marina@pizzaria.com');

  /* AS TRÊS SAÍDAS ACIDENTAIS ESTÃO FECHADAS. Esc, clique no fundo e o "x" são
     os três jeitos de fechar um diálogo sem querer — trancar dois deixaria o
     terceiro fazendo o mesmo estrago. */
  await expect(page.getByRole('button', { name: 'Fechar' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('senha-valor')).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.getByTestId('senha-valor')).toBeVisible();

  /* E "Concluir" só destrava depois da confirmação explícita. */
  await expect(page.getByTestId('senha-concluir')).toBeDisabled();
  await page.getByTestId('senha-confirmou').check();
  await page.getByTestId('senha-concluir').click();

  await expect(page.getByTestId('senha-valor')).toHaveCount(0);
  /* Quem nasceu agora aparece na lista já com a situação verdadeira. */
  await expect(page.getByRole('cell', { name: 'Senha temporária' })).toHaveCount(2);
});

test('a senha sai em blocos, e no alfabeto que dá para ditar', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('usuarios-novo').click();
  await page.getByTestId('usuario-nome').fill('Marina Costa');
  await page.getByTestId('usuario-email').fill('marina@pizzaria.com');
  await page.getByTestId('usuario-salvar').click();

  const senha = api.senhasGeradas().at(-1)!;

  /*
   * A PROPRIEDADE QUE O DIÁLOGO PROMETE: ela é lida em voz alta no balcão. O
   * alfabeto do backend já exclui O/0 e I/l/1 — se algum dia ele deixar de
   * excluir, é aqui que se descobre, e não pelo telefone de quem não consegue
   * entrar.
   */
  expect(senha).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{20}$/);

  /* Quatro blocos visuais, e o valor INTEIRO para quem escuta a tela: quatro
     pedaços seriam quatro palavras com pausa entre elas, e a pausa é
     indistinguível de um espaço que a senha não tem. */
  const blocos = page.getByTestId('senha-valor').locator('.ds-segredo__bloco');
  await expect(blocos).toHaveCount(4);
  await expect(page.getByText(`Senha temporária: ${senha}`)).toBeAttached();
});

test('redefinir a senha de outra pessoa mostra o mesmo diálogo, e avisa que a anterior caiu', async ({
  page,
}) => {
  await entrar(page);
  await page.getByTestId('usuario-redefinir-carla@pizzaria.com').click();

  await expect(page.getByTestId('senha-valor')).toBeVisible();
  /* A consequência que o cadastro não tem: a senha antiga parou de valer agora,
     e quem estava com o painel aberto caiu junto. */
  await expect(page.getByTestId('senha-nota-reset')).toContainText('parou de valer agora');
});

/* ==========================================================================
 * 2. A TROCA OBRIGATÓRIA — quem decide é o campo, não o 403
 * ======================================================================= */

test('com senha temporária, o painel abre só a troca de senha — sem passar por Pedidos', async ({
  page,
}) => {
  api.entrarComSenhaTemporaria();

  /*
   * O falso responde 403 em toda rota `/admin` que não seja o `me` e o PATCH da
   * senha. Se a tela obedecesse o 403, Pedidos apareceria e só depois se
   * fecharia — e o teste veria o título piscar.
   */
  await entrar(page, '/pedidos');

  await expect(page).toHaveURL(/\/trocar-senha$/);
  await expect(page.getByTestId('troca-obrigatoria')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toHaveCount(0);

  /* Não há moldura: com duas rotas respondendo, uma lateral seria nove portas
     trancadas. */
  await expect(page.getByRole('navigation', { name: 'Seções do painel' })).toHaveCount(0);
});

test('o endereço digitado à mão também cai na troca', async ({ page }) => {
  api.entrarComSenhaTemporaria();
  await entrar(page, '/pedidos');
  await expect(page).toHaveURL(/\/trocar-senha$/);

  /* Esconder o item da lateral não fecha a porta: o endereço continua
     digitável, e é por isso que a guarda mora na rota. */
  await page.goto('/cardapio');
  await expect(page).toHaveURL(/\/trocar-senha$/);
});

test('trocar a senha abre o painel — e o relogin é automático', async ({ page }) => {
  api.entrarComSenhaTemporaria();
  await entrar(page, '/pedidos');
  await expect(page.getByTestId('troca-obrigatoria')).toBeVisible();

  await page.getByTestId('troca-atual').fill(LOGIN_PASSWORD);
  await page.getByTestId('troca-nova').fill('a senha que eu escolhi');
  await page.getByTestId('troca-confirmacao').fill('a senha que eu escolhi');
  await page.getByTestId('troca-salvar').click();

  /*
   * TROCAR A SENHA REVOGA O PRÓPRIO TOKEN. Sem o relogin daqui, o painel se
   * fecharia no instante seguinte a um sucesso — e um logout logo depois de
   * "senha alterada" se lê como falha, não como segurança.
   */
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  expect(api.trocasDeSenha().at(-1)).toMatchObject({
    current_password: LOGIN_PASSWORD,
    new_password: 'a senha que eu escolhi',
    confirm_password: 'a senha que eu escolhi',
  });
});

test('a senha nova igual à atual é recusada antes de sair da tela', async ({ page }) => {
  await entrar(page);
  await page.getByRole('link', { name: 'Trocar senha' }).click();

  /* Doze caracteres ou mais nos três: senão quem responde é a regra de tamanho,
     e não a que este teste guarda. `LOGIN_PASSWORD` tem onze. */
  const repetida = 'a mesma senha de sempre';
  await page.getByTestId('troca-atual').fill(repetida);
  await page.getByTestId('troca-nova').fill(repetida);
  await page.getByTestId('troca-confirmacao').fill(repetida);
  await page.getByTestId('troca-salvar').click();

  /* Com uma senha temporária, repetir a que veio no papel deixaria valendo uma
     credencial que atravessou WhatsApp e balcão. */
  await expect(page.getByText('A senha nova precisa ser diferente da atual.')).toBeVisible();
  expect(api.trocasDeSenha()).toHaveLength(0);
});

/* ==========================================================================
 * 3 e 4. AS GUARDAS — impedir antes, com o motivo escrito
 * ======================================================================= */

test('o único proprietário ativo não se desativa nem muda de cargo', async ({ page }) => {
  await entrar(page);

  /* O botão não existe na linha dele: um botão que só falha no clique é o que
     esta frente existe para acabar. */
  await expect(page.getByTestId(`usuario-alternar-${LOGIN_EMAIL}`)).toHaveCount(0);
  /* E a célula DIZ por que há menos botões ali: duas ações que somem sem
     explicação se leem como tela quebrada, não como regra. */
  await expect(page.getByTestId('usuarios-motivo-eu')).toHaveText('sua conta');

  /* E o cargo está travado NO FORMULÁRIO, com o motivo escrito ao lado — o
     buraco que não parece remoção. */
  await page.getByTestId(`usuario-editar-${LOGIN_EMAIL}`).click();
  await expect(page.getByTestId('usuario-cargo')).toBeDisabled();
  await expect(page.getByText(/único proprietário ativo/i)).toBeVisible();

  /* Nada foi tentado contra a API. */
  expect(api.adminUserBodies()).toHaveLength(0);
});

test('ninguém redefine a própria senha — a guarda que o backend não tem', async ({ page }) => {
  await entrar(page);

  /*
   * A rota aceitaria: `_get_person` só confere que é uma pessoa deste
   * restaurante. O resultado seria o dono se expulsar do painel, com 20
   * caracteres na mão e `must_change_password` ligado em si mesmo.
   */
  await expect(page.getByTestId(`usuario-redefinir-${LOGIN_EMAIL}`)).toHaveCount(0);
  await expect(page.getByTestId('usuarios-eu')).toBeVisible();

  /* O caminho certo existe e está à mão. */
  await expect(page.getByRole('link', { name: 'Trocar senha' })).toBeVisible();
});

test('desativar outra pessoa avisa que o efeito é imediato e grava só o campo', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('usuario-alternar-carla@pizzaria.com').click();

  await expect(page.getByRole('cell', { name: 'Desativado' })).toHaveCount(2);

  /*
   * O CORPO É DE UM CAMPO SÓ. Um PATCH que carregasse nome, papel e filial para
   * desativar alguém desfaria o que outra aba gravou — e a tela mostraria
   * exatamente o mesmo resultado, o que faz desta a única asserção possível.
   */
  const corpo = api.adminUserBodies().at(-1);
  expect(corpo?.metodo).toBe('PATCH');
  expect(corpo?.body).toEqual({ is_active: false });
});

/* ==========================================================================
 * 5. O CORPO — o que nenhuma asserção de tela alcança
 * ======================================================================= */

test('o dono nunca leva filial no corpo, mesmo com uma filial escolhida no topo', async ({
  page,
}) => {
  await entrar(page);
  await page.getByTestId('usuarios-novo').click();
  await page.getByTestId('usuario-nome').fill('Sócio Novo');
  await page.getByTestId('usuario-email').fill('socio@pizzaria.com');
  await escolher(page.getByTestId('usuario-cargo'), 'Proprietário');

  /* O campo some no papel de dono: `build_admin_scope` ignora a filial dele, e
     um seletor ali anunciaria um limite que não existe. */
  await expect(page.getByTestId('usuario-filial')).toHaveCount(0);

  await page.getByTestId('usuario-salvar').click();
  await page.getByTestId('senha-confirmou').check();
  await page.getByTestId('senha-concluir').click();

  /*
   * O estrago de gravar a filial num dono não é hoje: é no dia em que ele for
   * rebaixado a gerente e aparecer preso a uma loja que ninguém escolheu.
   */
  const corpo = api.adminUserBodies().at(-1);
  expect(corpo?.body).toMatchObject({ role: 'owner', branch_id: null });
});

test('o e-mail repetido aponta o campo do e-mail, e não o rodapé', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('usuarios-novo').click();
  await page.getByTestId('usuario-nome').fill('Outra Carla');
  /* O UNIQUE é global e sobre `lower(email)` — a caixa alta não escapa dele. */
  await page.getByTestId('usuario-email').fill('CARLA@pizzaria.com');
  await page.getByTestId('usuario-salvar').click();

  await expect(page.getByText('Este e-mail ja esta em uso')).toBeVisible();
  /* O diálogo continua aberto com o que foi digitado: fechar faria a pessoa
     redigitar tudo por causa de um campo. */
  await expect(page.getByTestId('usuario-nome')).toHaveValue('Outra Carla');
});

test('o e-mail não se edita, e a tela diz por quê', async ({ page }) => {
  await entrar(page);
  await page.getByTestId('usuario-editar-carla@pizzaria.com').click();

  /* `AdminUserUpdate` não tem `email`: o histórico de cada pedido guarda
     `admin:{email}` como TEXTO, e trocá-lo reescreveria a autoria do passado. */
  await expect(page.getByTestId('usuario-email')).toBeDisabled();
  await expect(page.getByText(/o histórico de cada pedido guarda como autor/i)).toBeVisible();
});

/* ==========================================================================
 * 6. O PAPEL — a tela inteira é do dono
 * ======================================================================= */

test('o gerente não chega à tela nem digitando o endereço', async ({ page }) => {
  api.entrarComoPapel('manager');
  await entrar(page);

  /*
   * As QUATRO rotas são SOMENTE_DONO — não há a assimetria de Cupons ("a
   * gerência lê, o dono escreve"). Sem a guarda, o gerente cairia numa lista
   * que responde 403 e leria isso como defeito do painel.
   */
  await expect(page).toHaveURL(/\/pedidos$/);
  await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
});

test('o atendente também não vê o item na navegação', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await entrar(page, '/pedidos');
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0);

  /* Mas trocar a PRÓPRIA senha é de todo mundo: a rota não exige papel, e é o
     que fecha o buraco de quem desconfia do próprio vazamento. */
  await expect(page.getByRole('link', { name: 'Trocar senha' })).toBeVisible();
});
