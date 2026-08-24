/**
 * AS CAPTURAS DE TELA — a prova visual da direção.
 *
 * Não é teste: não afirma nada e não falha por regressão. É o arnês que
 * fotografa as telas do painel nos dois tamanhos e nos dois temas, sempre com
 * o MESMO backend falso dos testes de ponta a ponta — que é o que faz as fotos
 * mostrarem dado de verdade em vez de esqueleto vazio.
 *
 * Ele fica DESLIGADO por padrão, e não roda no CI:
 *
 *   CAPTURAS=1 npx playwright test e2e/capturas.spec.ts --workers=1
 *
 * As imagens saem em `capturas/<tela>-<largura>-<tema>.png`, ignoradas pelo
 * git: elas são para olhar numa revisão, não para versionar.
 */
import { test, expect, type Page } from '@playwright/test';

import { installFakeApi, LOGIN_EMAIL, LOGIN_PASSWORD, type FakeApi } from './fake-api';
import { escolherFilial } from './seletor';

const LIGADO = process.env.CAPTURAS === '1';

const TAMANHOS = [
  { nome: '1440', width: 1440, height: 900 },
  { nome: '390', width: 390, height: 844 },
] as const;

const TEMAS = ['light', 'dark'] as const;

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  test.skip(!LIGADO, 'Arnês de captura: rode com CAPTURAS=1.');
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api?.stop();
});

async function entrar(page: Page, tema: (typeof TEMAS)[number]) {
  // O tema é decidido antes do primeiro pixel (ver o script em index.html), e
  // é a mesma chave que o painel usa.
  await page.addInitScript((valor) => {
    window.localStorage.setItem('rapidex-admin.theme', valor);
  }, tema);

  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
}

async function fotografar(page: Page, nome: string, tamanho: string, tema: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `capturas/${nome}-${tamanho}-${tema}.png` });
}

for (const tamanho of TAMANHOS) {
  for (const tema of TEMAS) {
    test(`capturas ${tamanho.nome} ${tema}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: tamanho.width, height: tamanho.height });
      await entrar(page, tema);

      // Pedidos, sem o painel de detalhe: a lista inteira, sete colunas.
      await expect(page.getByTestId('board-lanes')).toBeVisible();
      await fotografar(page, 'pedidos', tamanho.nome, tema);

      // Pedidos com o detalhe aberto — no desktop é o caso em que a lista
      // encolhe e a linha troca para o layout compacto.
      await page.getByTestId('order-card-1002').click();
      await expect(page.getByTestId('order-panel')).toBeVisible();
      await fotografar(page, 'pedidos-detalhe', tamanho.nome, tema);
      await page.getByRole('button', { name: 'Fechar detalhe' }).click();

      // A filial resolvida: várias telas pedem uma escolhida.
      await escolherFilial(page);

      await page.goto('/cardapio');
      await expect(page.getByRole('heading', { name: 'Cardápio' })).toBeVisible();
      await fotografar(page, 'cardapio', tamanho.nome, tema);

      /*
       * ACOMPANHAMENTOS É A CATEGORIA QUE MOSTRA O LOTE 4 INTEIRO: o item que
       * saiu de venda sozinho (etiqueta de atenção na linha e o aviso no alto),
       * o punho de arrastar em toda linha e a coluna de seleção. É a foto que
       * precisa ser olhada com mais cuidado — são três colunas novas na mesma
       * grade, e é onde o aperto do celular aparece primeiro.
       */
      await page.getByTestId('category-select-cat-2').click();
      await expect(page.getByTestId('menu-bloqueados')).toBeVisible();
      await fotografar(page, 'cardapio-bloqueado', tamanho.nome, tema);

      // E a barra da seleção, que só existe com algo marcado.
      await page.getByTestId('product-select-prod-4').check();
      await page.getByTestId('product-select-prod-5').check();
      await expect(page.getByTestId('menu-selecao')).toBeVisible();
      await fotografar(page, 'cardapio-selecao', tamanho.nome, tema);

      await page.goto('/clientes');
      await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
      await fotografar(page, 'clientes', tamanho.nome, tema);

      /*
       * A AJUDA ABERTA — o estado que tirou dois parágrafos da frente da
       * tabela. No desktop é um balão ancorado no ícone; no celular ele deixa
       * de flutuar e vira uma fileira da faixa, na largura inteira.
       */
      await page.getByTestId('customers-ajuda').click();
      await expect(page.getByTestId('customers-nota-rfv')).toBeVisible();
      await fotografar(page, 'clientes-ajuda', tamanho.nome, tema);
      await page.keyboard.press('Escape');

      /*
       * O PAINEL DE FILTROS ABERTO, com um critério já aplicado — é o estado em
       * que se vê as três peças juntas: o número no botão, o "Limpar" ao lado e
       * o formulário. No desktop ele alinha pela margem DIREITA (o gatilho vive
       * nas ferramentas da faixa); no celular deixa de flutuar e vira fileira.
       */
      await page.getByTestId('customers-filtros').click();
      await page.getByTestId('customers-filtro-min').fill('20');
      await expect(page.getByTestId('customers-filtro-aplicar')).toBeVisible();
      await fotografar(page, 'clientes-filtros', tamanho.nome, tema);
      await page.getByTestId('customers-filtro-aplicar').click();
      await page.getByTestId('customers-filtros').click();
      await fotografar(page, 'clientes-filtros-ligado', tamanho.nome, tema);
      await page.keyboard.press('Escape');

      await page.goto('/desempenho');
      await expect(page.getByRole('heading', { name: 'Desempenho' })).toBeVisible();
      await fotografar(page, 'desempenho', tamanho.nome, tema);

      /*
       * AVALIAÇÕES abre RECORTADA em "até 3 estrelas", que é o estado que a
       * tela tem 99% do tempo — e é justamente o que a foto precisa mostrar: a
       * banda com a média do período INTEIRO em cima de uma lista curta. Se
       * algum dia os dois números passarem a se mover juntos, é aqui que se vê.
       */
      await page.goto('/avaliacoes');
      await expect(page.getByRole('heading', { name: 'Avaliações', level: 1 })).toBeVisible();
      await fotografar(page, 'avaliacoes', tamanho.nome, tema);

      /*
       * CASHBACK — a foto a olhar com cuidado é a de 390px: são onze campos e
       * uma grade de SETE dias, que no telefone vira duas colunas. É também
       * onde se confere que o aviso de faturamento abre a tela sem virar tarja,
       * e que o bloco da origem lê como qualificador e não como cartão.
       */
      await page.goto('/cashback');
      await expect(page.getByTestId('cashback-aviso')).toBeVisible();
      await fotografar(page, 'cashback', tamanho.nome, tema);

      /*
       * CUPONS — a lista traz as CINCO situações de uma vez (a semente do falso
       * é feita para isso), mais a etiqueta de atenção da campanha pendurada
       * numa arte que saiu do catálogo e o aviso que a explica. É a foto onde
       * se confere que cinco etiquetas neutras e uma colorida convivem sem a
       * colorida virar decoração — e, em 390, que a tabela de sete colunas
       * vira bloco sem perder a miniatura da arte.
       */
      await page.goto('/cupons');
      await expect(page.getByTestId('cupons-fora-do-ar')).toBeVisible();
      await fotografar(page, 'cupons', tamanho.nome, tema);

      /*
       * O DIÁLOGO, que é a peça de desenho desta tela: a grade de artes
       * agrupada por tipo (duas colunas no telefone) e a frase-resumo fechando
       * o formulário. Abrir uma campanha EXISTENTE, e não uma nova, é o que faz
       * a frase aparecer preenchida em vez do estado "escolha uma arte".
       */
      await page.getByTestId('cupom-editar-SETEMBRO').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await fotografar(page, 'cupons-dialogo', tamanho.nome, tema);
      await page.keyboard.press('Escape');

      await page.goto('/minha-loja/operacao');
      await expect(page.getByRole('heading', { name: 'Minha loja' })).toBeVisible();
      await fotografar(page, 'minha-loja', tamanho.nome, tema);

      await page.goto('/minha-loja/geral');
      await expect(page.getByRole('heading', { name: 'Minha loja' })).toBeVisible();
      await fotografar(page, 'minha-loja-geral', tamanho.nome, tema);

      /*
       * MARCA ENTRA NO ARNÊS porque ela existe para uma coisa VISUAL: fazer o
       * lojista entender, sem documentação, que a descrição é vitrine e as
       * anotações do assistente não são. Se a foto não mostra a distinção, a
       * seção não cumpriu a razão de ter sido criada.
       */
      await page.goto('/minha-loja/marca');
      await expect(page.getByTestId('marca-identidade')).toBeVisible();
      await fotografar(page, 'minha-loja-marca', tamanho.nome, tema);

      /*
       * IMPRESSÃO ENTROU NO ARNÊS nesta rodada, e não por ser mais uma seção: é
       * a tela com mais peças de estado por centímetro do painel — o ponto do
       * programa, a lista da máquina, o seletor de impressora em cada linha de
       * setor e a resposta do teste. Ela é usada EM PÉ, no balcão, e é onde o
       * aperto do celular aparece primeiro.
       */
      await page.goto('/minha-loja/impressao');
      await expect(page.getByTestId('print-agent-status')).toBeVisible();
      await fotografar(page, 'minha-loja-impressao', tamanho.nome, tema);

      // A Cozinha tem PALETA própria (saturada, para leitura a dois metros) mas
      // segue o tema como todas as outras: acesa sobre carvão no escuro, funda
      // sobre papel no claro. As duas fotos dela são diferentes, e é isso que a
      // captura documenta.
      await page.goto('/cozinha');
      await expect(page.getByRole('heading', { name: 'Cozinha' })).toBeVisible();
      await fotografar(page, 'cozinha', tamanho.nome, tema);

      /*
       * USUÁRIOS — a semente do falso traz as três situações de uma vez (ativo,
       * senha temporária e desativado), a etiqueta "você" na linha do dono e a
       * coluna de ações com uma linha a menos que as outras: é onde se confere
       * que a ausência de dois botões na própria linha se lê como regra e não
       * como falha, e que a tabela de cinco colunas vira bloco em 390.
       */
      await page.goto('/usuarios');
      await expect(page.getByTestId('usuarios-escopo')).toBeVisible();
      await fotografar(page, 'usuarios', tamanho.nome, tema);

      /*
       * O DIÁLOGO DA SENHA, que é a peça de desenho desta tela — e o único
       * diálogo do painel que não fecha sozinho. A foto existe por causa de uma
       * coisa que só se confere no olho: se os blocos de cinco caracteres não
       * estiverem legíveis a um braço de distância, a senha não se dita por
       * telefone, e a tela não cumpriu a razão de existir.
       */
      await page.getByTestId('usuario-redefinir-carla@pizzaria.com').click();
      await expect(page.getByTestId('senha-valor')).toBeVisible();
      await fotografar(page, 'usuarios-senha', tamanho.nome, tema);
      await page.getByTestId('senha-confirmou').check();
      await page.getByTestId('senha-concluir').click();

      /*
       * "Em breve": o estado honesto, que também precisa pertencer ao sistema.
       *
       * ELE APONTAVA PARA /cupons, e Cupons tem tela desde `e835961` — a foto
       * chamada "em-breve" era a de Cupons de novo, e a tela que ela deveria
       * documentar não era fotografada por ninguém. WhatsApp continua pendente,
       * e é ela que sobra para o papel.
       */
      await page.evaluate(() => window.localStorage.clear());
      await page.goto('/whatsapp');
      await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
      await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('heading', { name: 'WhatsApp' })).toBeVisible();
      await fotografar(page, 'em-breve', tamanho.nome, tema);

      /*
       * A TROCA OBRIGATÓRIA — a tela que abre sozinha para quem entrou com uma
       * senha temporária. Ela é a segunda (e última) janela do painel, ao lado
       * do login: cartão centrado sobre `--bg`, sem lateral e sem barra. A foto
       * é o que impede alguém de "consertar" isso pondo o shell de volta.
       *
       * VEM POR ÚLTIMO, e não por gosto: `entrarComSenhaTemporaria` é
       * terminal. Depois dela toda rota `/admin` responde 403 e todo login cai
       * nesta mesma tela — qualquer foto agendada depois seria a desta de novo.
       */
      await page.evaluate(() => window.localStorage.clear());
      api.entrarComSenhaTemporaria();
      await page.goto('/pedidos');
      await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
      await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByTestId('troca-obrigatoria')).toBeVisible();
      await fotografar(page, 'troca-de-senha', tamanho.nome, tema);
    });
  }
}
