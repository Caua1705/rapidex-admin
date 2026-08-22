/**
 * E2E do caminho crítico: login → ver o pedido → mudar o status.
 *
 * É o que o lojista faz dezenas de vezes por dia. Se isto passar, o painel
 * está de pé; o resto é detalhe. Os outros testes deste arquivo cobrem os três
 * jeitos de a tela enganar o lojista: pedido não pago liberado para a cozinha,
 * transição que o backend recusa, e sessão que caiu sem avisar.
 */
import { expect, test, type Page } from '@playwright/test';

import { branchName } from '../src/layout/branch-heading';
import {
  installFakeApi,
  FAKE_BRANCH,
  FAKE_BRANCH_2,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  type FakeApi,
} from './fake-api';
import { escolherFilial } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function fazerLogin(page: Page) {
  await page.goto('/pedidos');
  // Guarda de rota: sem token, ninguém vê o quadro.
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/pedidos$/);
}

test('login, abrir o pedido e mudar o status', async ({ page }) => {
  await fazerLogin(page);

  /*
   * O topo identifica de quem é a sessão — e o escopo em que ela abriu, que
   * com duas filiais e nenhuma escolhida é "todas".
   *
   * Este assert já cobrou "Pizzaria do Zé — Aldeota" aqui, e passava por
   * acidente: o <select> nativo mantinha o nome de TODA filial no DOM da
   * barra, escolhida ou não, então `toContainText` achava o texto de uma
   * opção fechada. Sem controle nativo, a barra diz só o que está na tela.
   */
  const barraDoTopo = page.locator('.shell__bar');
  await expect(barraDoTopo).toContainText('Todas as filiais (2)');
  await expect(barraDoTopo).toContainText('Joana Souza');

  // E ao escolher uma, é o nome dela que aparece.
  await escolherFilial(page);
  await expect(barraDoTopo).toContainText('Pizzaria do Zé — Aldeota');

  // O quadro abriu com os pedidos nas colunas certas e o badge do backend.
  await expect(page.getByTestId('badge-novos')).toHaveText('2');
  await expect(page.getByTestId('badge-preparo')).toHaveText('1');
  await expect(page.locator('[data-lane="novos"] [data-testid="order-card-1002"]')).toBeVisible();

  // Abre o detalhe do pedido 1002.
  await page.getByTestId('order-card-1002').click();
  const painel = page.getByTestId('order-panel');
  await expect(painel.getByText('Pizza Calabresa G')).toBeVisible();
  await expect(painel.getByText('Sem cebola, por favor.')).toBeVisible();
  await expect(painel.getByText(/Rua das Flores, 123/)).toBeVisible();
  await expect(painel.getByRole('heading', { name: 'Histórico' })).toBeVisible();

  // Aceita o pedido. O backend é quem valida a transição.
  await painel.getByTestId('change-status-accepted').click();

  // O histórico do detalhe recarregado já mostra a linha nova.
  await expect(painel.getByText('Joana Souza')).toBeVisible();

  await page.getByRole('button', { name: 'Fechar' }).click();

  // E o card mudou de coluna sem precisar recarregar a página.
  await expect(page.locator('[data-lane="preparo"] [data-testid="order-card-1002"]')).toBeVisible();
  await expect(page.locator('[data-lane="novos"] [data-testid="order-card-1002"]')).toHaveCount(0);
});

/*
 * O detalhe deixou de ser janela: aberto, ele escondia justamente as faixas
 * que dizem o que fazer em seguida.
 */
test('o detalhe é painel lateral: o quadro fica visível e o conteúdo troca', async ({ page }) => {
  await fazerLogin(page);

  const painel = page.getByTestId('order-panel');

  /*
   * A TELA ESCOLHE O PRIMEIRO PEDIDO SOZINHA, como o Gmail abre na primeira
   * conversa. Antes a coluna abria com uma frase explicando o que acontece se
   * alguém clicar — um terço da tela gasto para ensinar o clique que o lojista
   * dá cinquenta vezes por turno.
   *
   * #1001 é o primeiro da lista: a faixa "Novos" vem antes de "Em preparo".
   */
  await expect(painel).toBeVisible();
  await expect(painel).toContainText('#1001');
  await expect(painel).toContainText('Marcos Lima');

  // A COLUNA É PERMANENTE: o quadro não muda de largura a cada clique — com a
  // gaveta antiga, o cartão seguinte trocava de posição embaixo do ponteiro.
  await page.getByTestId('order-card-1002').click();
  await expect(painel).toContainText('#1002');
  // O quadro continua na tela, com as faixas todas.
  await expect(page.locator('[data-lane="novos"]')).toBeVisible();
  await expect(page.locator('[data-lane="preparo"]')).toBeVisible();

  // Clicar em outro card TROCA o conteúdo, sem fechar nada no meio.
  await page.getByTestId('order-card-1003').click();
  await expect(painel).toContainText('#1003');
  await expect(painel).toContainText('Rafael Nunes');
  await expect(painel).not.toContainText('#1002');

  /*
   * Fechar volta ao estado vazio — a coluna fica, o quadro não se mexe.
   *
   * E NÃO REABRE SOZINHA: a escolha automática vale uma vez por visita. Sem
   * essa trava, o botão "Fechar detalhe" seria um botão que não faz nada.
   */
  await page.getByRole('button', { name: 'Fechar detalhe' }).click();
  await expect(painel).toContainText('Clique num pedido');
  await expect(painel).not.toContainText('#1003');
  await expect(painel).not.toContainText('#1001');
  await expect(page.getByTestId('order-card-1003')).toBeVisible();
});

/*
 * O HISTÓRICO DO CLIENTE, no detalhe do pedido.
 *
 * A pergunta é "esta pessoa volta sempre?", e ela é feita ANTES de aceitar. O
 * dado sai da mesma rota da tela de Clientes, procurado por telefone — não há
 * rota nova.
 *
 * O teste cobre os dois casos que a tela sabe escrever E o casamento por
 * telefone: os três pedidos do falso têm telefones diferentes, então mostrar o
 * histórico da pessoa errada aqui apareceria como número trocado.
 */
test('o detalhe diz há quanto tempo a pessoa é cliente e quantos pedidos fez', async ({ page }) => {
  await fazerLogin(page);

  const painel = page.getByTestId('order-panel');
  const historico = painel.getByTestId('customer-history');

  // Marcos Lima (#1001, escolhido sozinho): 5 pedidos, primeiro há 300 dias.
  await expect(historico).toContainText('5 pedidos');
  await expect(historico).toContainText('Cliente há');

  // Ana Paula (#1002): a freguesa antiga.
  await page.getByTestId('order-card-1002').click();
  await expect(painel).toContainText('Ana Paula');
  await expect(historico).toContainText('12 pedidos');

  // O telefone aparece formatado, como na tela de Clientes.
  await expect(painel).toContainText('(85) 99999-0000');

  /*
   * Rafael Nunes (#1003) está no PRIMEIRO pedido — e aí a frase é outra. Não
   * existe "Cliente há 0 dias · 1 pedido": quem estreia merece a frase curta.
   */
  await page.getByTestId('order-card-1003').click();
  await expect(painel).toContainText('Rafael Nunes');
  await expect(historico).toHaveText('Primeiro pedido');
});

/*
 * O grupo é o que dá sentido à escolha: "espaguete" em "Acompanhamento" é a
 * troca do que vem no prato; em "Adicional" é uma porção a mais. Achatado, a
 * cozinha monta o prato errado.
 */
test('os adicionais aparecem recuados e agrupados por grupo', async ({ page }) => {
  await fazerLogin(page);
  await page.getByTestId('order-card-1002').click();

  const painel = page.getByTestId('order-panel');
  await expect(painel.getByText('Filé à parmegiana')).toBeVisible();

  const acompanhamento = painel.locator('.options__group', { hasText: 'Acompanhamento' });
  const adicional = painel.locator('.options__group', { hasText: 'Adicional' });
  await expect(acompanhamento.getByText('Espaguete')).toHaveCount(1);
  await expect(adicional.getByText('Espaguete')).toHaveCount(1);
  await expect(adicional.getByText('Bacon')).toHaveCount(1);

  // O preço do adicional aparece só para conferência...
  await expect(adicional).toContainText('12,00');
  // ...e NÃO entra no total: o unit_price_snapshot já o inclui. 45 + 79 = 124,
  // que é o total do pedido — somar os adicionais daria 141.
  await expect(painel.locator('.detail__row--total')).toContainText('124,00');

  // E o aviso de que os adicionais não vinham no contrato saiu da tela.
  await expect(painel).not.toContainText('não vêm no contrato');
});

test('pedido com pagamento online não confirmado fica destacado e travado', async ({ page }) => {
  await fazerLogin(page);

  const cardNaoPago = page.getByTestId('order-card-1001');
  await expect(cardNaoPago).toHaveClass(/ds-row--alerta/);
  await expect(cardNaoPago).toContainText('não preparar');

  await cardNaoPago.click();
  const painel = page.getByTestId('order-panel');
  await expect(painel.getByText(/A cozinha não pode preparar/)).toBeVisible();
  // O botão de aceitar existe, mas travado: a tela não oferece o que vai falhar.
  await expect(painel.getByTestId('change-status-accepted')).toBeDisabled();

  /*
   * E O MOTIVO FICA ESCRITO NO RODAPÉ, colado no botão que ele trava. Ele vivia
   * só no `title`, que não existe no toque: no celular, onde este painel é a
   * tela inteira, o lojista via um botão morto e nada explicando. O aviso do
   * corpo não resolve — ele fica no alto de uma área que rola, e o rodapé é
   * grudento.
   */
  await expect(painel.getByTestId('acao-travada')).toContainText(
    'Pagamento online ainda não confirmado',
  );
});

test('transição recusada pelo backend vira mensagem clara na tela', async ({ page }) => {
  await fazerLogin(page);

  await page.getByTestId('order-card-1002').click();
  const painel = page.getByTestId('order-panel');
  await expect(painel.getByTestId('change-status-accepted')).toBeEnabled();

  // Outro atendente aceitou o mesmo pedido enquanto este estava com o detalhe
  // aberto. O clique agora é uma transição inválida — e o backend recusa.
  api.setStatusFromAnotherUser('ord-1002', 'accepted');
  await painel.getByTestId('change-status-accepted').click();

  await expect(painel.getByTestId('status-error')).toContainText(
    'Não é possível mudar de "Aceito" para "Aceito"',
  );
});

test('pedido novo chega sozinho pelo SSE', async ({ page }) => {
  await fazerLogin(page);
  await expect(page.getByTestId('order-card-1002')).toBeVisible();

  /*
   * ESPERA A CONEXÃO DO SSE EXISTIR ANTES DE EMPURRAR O EVENTO.
   *
   * O quadro pinta antes de o SSE conectar, e um evento empurrado nesse vão
   * nasce atrás do cursor da conexão que ainda vai chegar: ele não é entregue a
   * ninguém. O teste passava por sorte, quando a conexão vencia a corrida —
   * e com a tela fazendo mais uma leitura na abertura (o detalhe do pedido
   * escolhido sozinho), passou a perdê-la sob carga.
   *
   * Esperar "Tempo real" na barra não serviria: o falso segura a resposta do
   * SSE até haver o que mandar, então o estado só vira "live" DEPOIS do
   * primeiro evento. Ver `waitForStream` em `fake-api.ts`.
   */
  await api.waitForStream();

  api.pushNewOrder(
    api.makeOrder({
      id: 'ord-1010',
      order_number: 1010,
      customer_name_snapshot: 'Cliente do Stream',
      created_at: new Date().toISOString(),
    }),
  );

  await expect(page.locator('[data-lane="novos"] [data-testid="order-card-1010"]')).toBeVisible();
  await expect(page.getByText('Cliente do Stream')).toBeVisible();
});

/*
 * A filial saiu da barra de filtros e virou o seletor do cabeçalho, que vale
 * para o painel inteiro. Este teste é o que garante que ele continua sendo um
 * FILTRO de verdade, e não só um rótulo bonito com nome e endereço.
 */
/*
 * CADA CONTADOR APARECE UMA VEZ SÓ, e o lugar dele é a coluna.
 *
 * Duas coisas saíram do topo do quadro em duas rodadas: os sete cartões de
 * resumo, que repetiam número por número os contadores do cabeçalho de cada
 * coluna; e o total do período, que parecia uma informação nova e era a SOMA
 * daqueles sete, visível na mesma dobra.
 *
 * O que sobrou lá em cima só aparece quando há paginação — e essa é a única
 * pergunta que as colunas não respondem, porque elas contam o período inteiro
 * e mostram só a página carregada.
 */
test('o contador de status aparece uma vez só, e é na coluna', async ({ page }) => {
  await fazerLogin(page);

  // O falso abre com três pedidos: dois pendentes e um preparando.
  await expect(page.getByTestId('badge-novos')).toHaveText('2');
  await expect(page.getByTestId('badge-preparo')).toHaveText('1');

  // Nada no topo do quadro repete isso: com tudo carregado, a linha some.
  await expect(page.getByTestId('period-summary')).toHaveCount(0);

  /*
   * E O ESTÁGIO VAZIO NÃO É DESENHADO — nem com a frase "Nenhum pedido", nem
   * com um cabeçalho anunciando o nada.
   *
   * A asserção mudou de forma junto com o quadro, e ficou MAIS forte: antes o
   * bloco existia e o teste cobrava que ele não escrevesse a frase; hoje o
   * bloco sem pedido não existe (ver `OrderBlock`), e é isso que o teste
   * cobra. Quem diz o zero é o contador da faixa do topo, que continua sendo
   * verificado na linha acima — um lugar só, como diz o nome deste teste.
   */
  await expect(page.getByTestId('badge-prontos')).toHaveText('0');
  await expect(page.locator('[data-lane="prontos"]')).toHaveCount(0);
  await expect(page.getByTestId('board-lanes')).not.toContainText('Nenhum pedido');

  // Mover um pedido reflete nos contadores, que é o que os torna confiáveis.
  await page.getByTestId('order-card-1002').click();
  await page.getByTestId('change-status-accepted').click();
  await expect(page.getByTestId('badge-preparo')).toHaveText('1');
  await expect(page.getByTestId('badge-novos')).toHaveText('1');
});

test('o seletor de filial do cabeçalho filtra o quadro', async ({ page }) => {
  await fazerLogin(page);

  const seletor = page.getByTestId('branch-selector');
  /*
   * Sem filial escolhida o cabeçalho diz UMA coisa só. Antes ele mostrava o
   * nome da matriz junto de "Todas as filiais · 2" — e o nome vinha do rótulo
   * do restaurante, que é o nome da filial principal. Quem batia o olho lia
   * "estou na Aldeota" quando o quadro trazia as duas lojas.
   */
  // O rótulo visível, e não o <select>: as <option> carregam os nomes das duas
  // filiais por natureza, e é a linha lida de relance que precisa estar certa.
  await expect(seletor.locator('.branch__name')).toHaveText('Todas as filiais (2)');
  await expect(seletor.locator('.branch__detail')).toHaveCount(0);
  await expect(page.getByTestId('order-card-1002')).toBeVisible();

  // NENHUM DOS DOIS GRUPOS da segunda faixa tem campo de filial — nem o do
  // recorte, nem o da promessa. Um só lugar decide isso, e é o seletor do topo.
  await expect(page.locator('.orders__barra').getByLabel('Filial')).toHaveCount(0);

  const requisicao = page.waitForRequest(
    (request) =>
      request.url().includes('/admin/orders?') &&
      request.url().includes(`branch_id=${FAKE_BRANCH_2.id}`),
  );
  await escolherFilial(page, FAKE_BRANCH_2);
  await requisicao;

  // O endereço da filial escolhida entra no lugar de "todas".
  await expect(seletor).toContainText('Pizzaria do Zé — Zona Norte');
  await expect(seletor).toContainText('Av. Brasil, 900');

  // Os pedidos são todos da matriz, então o quadro da outra filial fica vazio.
  await expect(page.getByTestId('order-card-1002')).toHaveCount(0);
});

/*
 * Cancelar é a única ação da tela que apaga trabalho já feito e não tem
 * desfazer. O motivo é obrigatório porque, sem ele, ninguém consegue dizer no
 * dia seguinte se foi o cliente que desistiu ou a cozinha que não deu conta.
 */
/*
 * NO #1003, QUE JÁ ESTÁ EM PREPARO. Cancelar é a saída de um pedido que a
 * cozinha já começou; em pendente a saída chama-se recusar, e é outro diálogo
 * (ver "recusar pede confirmação", abaixo).
 */
test('cancelar exige motivo e grava o que foi escrito', async ({ page }) => {
  await fazerLogin(page);
  await page.getByTestId('order-card-1003').click();

  const painel = page.getByTestId('order-panel');
  await painel.getByTestId('change-status-cancelled').click();

  // O clique não cancelou nada ainda: abriu a confirmação.
  const confirmacao = page.getByRole('dialog');
  await expect(confirmacao).toContainText('Cancelar o pedido #1003?');
  await expect(confirmacao).toContainText('Esta ação não pode ser desfeita.');
  expect(api.cancelReasons()).toHaveLength(0);

  // Motivo vazio e motivo curto demais mantêm o botão travado.
  const confirmar = confirmacao.getByTestId('confirm-cancel');
  await expect(confirmar).toBeDisabled();
  await confirmacao.getByLabel('Motivo do cancelamento').fill('ok');
  await expect(confirmar).toBeDisabled();

  await confirmacao.getByLabel('Motivo do cancelamento').fill('Cliente desistiu por telefone.');
  await expect(confirmar).toBeEnabled();
  await confirmar.click();

  await expect
    .poll(() => api.cancelReasons())
    .toEqual([{ orderId: 'ord-1003', reason: 'Cliente desistiu por telefone.' }]);

  // O card SAIU do quadro: cancelado é histórico, e histórico é a outra aba.
  await expect(page.getByTestId('order-card-1003')).toHaveCount(0);
  await page.getByTestId('orders-tab-historico').click();
  await expect(
    page.locator('[data-testid="board-historico"] [data-testid="order-card-1003"]'),
  ).toBeVisible();
  await page.getByTestId('orders-tab-andamento').click();
  await expect(painel.getByText('Cliente desistiu por telefone.')).toBeVisible();
});

test('cancelar recusado pelo backend mostra o erro sem fechar a confirmação', async ({ page }) => {
  await fazerLogin(page);
  await page.getByTestId('order-card-1003').click();
  await page.getByTestId('order-panel').getByTestId('change-status-cancelled').click();

  // Outro atendente concluiu o pedido enquanto a confirmação estava aberta.
  api.setStatusFromAnotherUser('ord-1003', 'completed');

  const confirmacao = page.getByRole('dialog');
  await confirmacao.getByLabel('Motivo do cancelamento').fill('Cliente desistiu.');
  await confirmacao.getByTestId('confirm-cancel').click();

  await expect(confirmacao.getByTestId('cancel-error')).toContainText('estado final');
  // Continua aberta: o lojista precisa ver o que aconteceu antes de sair.
  await expect(confirmacao).toBeVisible();
});

/*
 * ============================================================================
 * RECUSAR — tão irreversível quanto cancelar, e não pedia nada
 * ============================================================================
 *
 * O botão ficava colado no "Aceitar pedido", que é o que o lojista aperta
 * cinquenta vezes por turno, no rodapé de um painel que no celular ocupa a tela
 * inteira. Um clique e o pedido saía do quadro, sem volta e sem pergunta.
 */
test('recusar pede confirmação e grava o motivo no histórico', async ({ page }) => {
  await fazerLogin(page);
  await page.getByTestId('order-card-1002').click();

  const painel = page.getByTestId('order-panel');
  await painel.getByTestId('change-status-rejected').click();

  // O clique não recusou nada: abriu a confirmação.
  const confirmacao = page.getByRole('dialog');
  await expect(confirmacao).toContainText('Recusar o pedido #1002?');
  await expect(confirmacao).toContainText('Esta ação não pode ser desfeita.');
  await expect(page.getByTestId('order-card-1002')).toBeVisible();

  // Desistir da recusa devolve a tela ao lugar, com o pedido no quadro.
  await confirmacao.getByRole('button', { name: 'Manter o pedido' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('order-card-1002')).toBeVisible();

  /*
   * O MOTIVO É OPCIONAL — o pedido nem começou, e exigir justificativa no meio
   * do almoço para dizer "acabou a costela" viraria pedágio. Escrito, ele vai
   * como `note` do PATCH e entra no histórico do pedido.
   */
  await painel.getByTestId('change-status-rejected').click();
  const segunda = page.getByRole('dialog');
  await expect(segunda.getByTestId('confirm-reject')).toBeEnabled();
  await segunda.getByLabel('Motivo (opcional)').fill('Acabou a costela.');
  await segunda.getByTestId('confirm-reject').click();

  // O card saiu do quadro, e o histórico do pedido diz por quê.
  await expect(page.getByTestId('order-card-1002')).toHaveCount(0);
  await expect(painel.getByText('Acabou a costela.')).toBeVisible();
});

/*
 * UM AVANÇO E UMA SAÍDA, POR ESTÁGIO. O rodapé desenhava um botão para cada
 * destino da máquina de estados, todos com o mesmo peso — num pedido pendente,
 * "Aceito" em brasa entre "Recusado" e "Cancelado" em vermelho.
 */
test('o rodapé mostra um avanço e uma saída, e eles mudam com o estágio', async ({ page }) => {
  await fazerLogin(page);
  const painel = page.getByTestId('order-panel');

  // PENDENTE: aceitar, e a saída é recusar. Cancelar não divide a linha com ela.
  await page.getByTestId('order-card-1002').click();
  await expect(painel.getByTestId('change-status-accepted')).toHaveText('Aceitar pedido');
  await expect(painel.getByTestId('change-status-rejected')).toBeVisible();
  await expect(painel.getByTestId('change-status-cancelled')).toHaveCount(0);

  // EM PREPARO: o avanço é outro, e a saída passa a ser cancelar.
  await page.getByTestId('order-card-1003').click();
  await expect(painel.getByTestId('change-status-ready')).toHaveText('Marcar como pronto');
  await expect(painel.getByTestId('change-status-cancelled')).toBeVisible();
  await expect(painel.getByTestId('change-status-rejected')).toHaveCount(0);

  /*
   * E DE "PRONTO" QUEM ESCOLHE É A MODALIDADE. O #1003 é RETIRADA: o avanço
   * dele é concluir, e "Enviar para entrega" não aparece nem travado — o
   * backend recusaria, e essa razão não muda durante o turno.
   */
  await painel.getByTestId('change-status-ready').click();
  await expect(painel.getByTestId('change-status-completed')).toHaveText('Concluir pedido');
  await expect(painel.getByTestId('change-status-out_for_delivery')).toHaveCount(0);
});

/*
 * O QUADRO VAZIO PRECISA DIZER O QUE ESTÁ ACONTECENDO.
 *
 * Sem nenhum pedido, a tela mostrava três faixas com "0" e mais nada — o
 * lojista ficava sem saber se a loja estava fechada, se o filtro estava num
 * dia sem movimento, ou se o painel tinha travado.
 */
test('o quadro sem pedido nenhum diz o que está acontecendo', async ({ page }) => {
  await fazerLogin(page);
  api.clearOrders();
  await page.getByRole('button', { name: 'Atualizar' }).click();

  const vazio = page.getByTestId('board-empty');
  // Loja aberta e sem movimento: o que vale dizer é que a tela se atualiza
  // sozinha — é o que evita o F5 no meio do turno.
  await expect(vazio).toContainText('nenhum pedido em aberto');
  await expect(vazio).toContainText('sozinho');

  // As três faixas continuam de pé: o estado vazio se soma a elas, não as
  // substitui — quem está aprendendo a ler o quadro perderia a estrutura.
  await expect(page.getByTestId('badge-novos')).toHaveText('0');

  // Com a loja fechada, a resposta é outra — e tem o que fazer. Recarrega a
  // página porque `is_open` é lido na abertura da tela, não no botão de
  // atualizar (que recarrega o quadro, não as configurações).
  api.closeStore();
  await page.reload();
  await expect(vazio).toContainText('A loja está fechada');
  await expect(vazio.getByRole('link', { name: 'Abrir a loja' })).toBeVisible();
});

test('ajustar o tempo de preparo usa a faixa que a resposta devolveu', async ({ page }) => {
  await fazerLogin(page);

  /*
   * SEM FILIAL ESCOLHIDA O CONTROLE FUNCIONA. Ele já respondeu "escolha uma
   * filial" no lugar do valor, com os botões travados — o lojista abria
   * Pedidos e encontrava um controle que não operava, num quadro que estava
   * mostrando as duas lojas normalmente. Hoje ele resolve a filial principal,
   * opera sobre ela e diz qual é. Ver `auth/branch-scope.ts`.
   */
  await expect(page.getByTestId('prep-time-mais-5')).toBeEnabled();
  await expect(page.getByTestId('prep-time-range')).toHaveText('25–35 min');
  await expect(page.getByTestId('prep-time-branch')).toHaveText(`na ${branchName(FAKE_BRANCH)}`);

  await escolherFilial(page);
  await expect(page.getByTestId('prep-time-mais-5')).toBeEnabled();

  // Com a filial escolhida no topo, o nome sai daqui: o cabeçalho já a nomeia,
  // e repetir seria a mesma informação duas vezes na mesma tela.
  await expect(page.getByTestId('prep-time-branch')).toHaveCount(0);

  // A faixa vigente aparece na ABERTURA, lida da semana de funcionamento —
  // antes só existia depois do primeiro ajuste.
  await expect(page.getByTestId('prep-time-range')).toHaveText('25–35 min');

  await page.getByTestId('prep-time-mais-10').click();
  // 25–35 + 10, direto da resposta: nenhuma segunda chamada para reler.
  await expect(page.getByTestId('prep-time-range')).toHaveText('35–45 min');

  await page.getByTestId('prep-time-menos-5').click();
  await expect(page.getByTestId('prep-time-range')).toHaveText('30–40 min');
  expect(api.prepTimeOf(FAKE_BRANCH.id)).toEqual({ min: 30, max: 40 });
});

test('sem faixa base gravada, a tela pede min e max uma vez', async ({ page }) => {
  await fazerLogin(page);
  api.clearPrepTimeBase(FAKE_BRANCH.id);

  await escolherFilial(page);
  await page.getByTestId('prep-time-mais-5').click();

  const base = page.getByTestId('prep-time-base');
  await expect(base).toContainText('ainda não tem tempo de preparo gravado');

  await base.getByLabel('Mínimo (min)').fill('20');
  await base.getByLabel('Máximo (min)').fill('30');
  await base.getByRole('button', { name: 'Salvar faixa' }).click();

  await expect(page.getByTestId('prep-time-range')).toHaveText('20–30 min');
  expect(api.prepTimeOf(FAKE_BRANCH.id)).toEqual({ min: 20, max: 30 });
});

/*
 * O 409 de filial fechada NÃO pode cair no mesmo caminho do 409 de base
 * faltando: abrir o campo de min/max aqui faria o lojista preencher a faixa
 * achando que resolveu, e levar outro 409.
 */
test('filial fechada mostra a mensagem e não oferece contorno', async ({ page }) => {
  await fazerLogin(page);
  api.closeBranch(FAKE_BRANCH.id);

  await escolherFilial(page);
  await page.getByTestId('prep-time-mais-5').click();

  await expect(page.getByTestId('prep-time-error')).toContainText('A filial está fechada agora');
  await expect(page.getByTestId('prep-time-base')).toHaveCount(0);
  // A faixa gravada continua na tela: a loja estar fechada agora não apaga o
  // prazo cadastrado, e zerar o número aqui seria uma segunda informação falsa
  // em cima de um erro que o lojista já está lendo.
  await expect(page.getByTestId('prep-time-range')).toHaveText('25–35 min');
});

test('401 em qualquer chamada limpa a sessão e volta ao login', async ({ page }) => {
  await fazerLogin(page);
  await expect(page.getByTestId('order-card-1002')).toBeVisible();

  /*
   * ESPERA O PAINEL TERMINAR DE CARREGAR ANTES DE VENCER O TOKEN.
   *
   * A tela escolhe o primeiro pedido sozinha na abertura, e essa escolha dispara
   * DUAS leituras em cadeia: o detalhe (`GET /admin/orders/{id}`) e, com o
   * telefone que ele traz, o histórico do cliente (`GET /admin/customers`). Sem
   * esta espera, o token vencia no meio da cadeia: a sessão caía por causa
   * dela, a tela ia para o login sozinha, e o clique abaixo — que é o assunto
   * deste teste — nunca acontecia.
   *
   * A linha do histórico é a ÚLTIMA das duas a chegar, então esperar por ela é
   * esperar o painel terminar. A espera não enfraquece a cobertura: ela só
   * garante que a chamada que derruba a sessão é a do botão, e não uma que
   * estava a caminho.
   */
  await expect(page.getByTestId('order-panel')).toContainText('#1001');
  await expect(page.getByTestId('customer-history')).toBeVisible();

  // Token vencido no servidor: a próxima chamada responde 401.
  api.expireSession();
  await page.getByRole('button', { name: 'Atualizar' }).click();

  await expect(page).toHaveURL(/\/login$/);

  // E a sessão foi apagada mesmo: recarregar não volta para o quadro.
  await page.goto('/pedidos');
  await expect(page).toHaveURL(/\/login$/);
});

/*
 * "ESCOLHER…" ABRE OS CAMPOS DE DATA — e este teste não existia.
 *
 * `datesForPeriod('custom', …)` devolvia o estado INTEIRO de volta, e o ponto
 * de chamada faz `{ period: novo, ...datesForPeriod(novo, filters) }`: o
 * `period` antigo vinha de carona no spread e sobrescrevia o novo. Clicar em
 * "Escolher…" não abria nada e o segmentado voltava sozinho para a opção
 * anterior — em produção, sem nada acusando, porque o teste de unidade
 * chamava a função com um objeto de duas chaves e não com o estado da tela.
 */
test('"Escolher…" abre os campos de data e o segmentado fica nele', async ({ page }) => {
  await fazerLogin(page);

  await expect(page.getByLabel('Data inicial')).toHaveCount(0);

  await page.getByTestId('orders-period-custom').click();

  await expect(page.getByTestId('orders-period-custom')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Data inicial')).toBeVisible();
  await expect(page.getByLabel('Data final')).toBeVisible();
});
