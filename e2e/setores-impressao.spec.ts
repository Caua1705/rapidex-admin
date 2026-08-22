/**
 * E2E dos setores de impressão.
 *
 * A funcionalidade vive em duas telas e é o cruzamento delas que dá errado:
 * setor é POR FILIAL, produto é DO RESTAURANTE. Os testes daqui cobrem a aba
 * que administra os setores, o campo no produto, a coluna de conferência e a
 * aplicação em lote — que é a razão de tudo isto existir, para o cardápio de 80
 * itens não ser configurado clique a clique.
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
import { escolher, escolherFilial, opcoesDe } from './seletor';

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = await installFakeApi(page);
});

test.afterEach(() => {
  api.stop();
});

async function fazerLogin(page: Page) {
  await page.goto('/pedidos');
  await page.getByLabel('E-mail').fill(LOGIN_EMAIL);
  await page.getByLabel('Senha').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
}

async function abrirAbaImpressao(page: Page) {
  await page.getByRole('link', { name: 'Minha loja' }).click();
  await page.getByTestId('store-anchor-impressao').click();
}

/**
 * Aplicar setor à categoria mora no menu de três pontinhos, ao lado do nome da
 * categoria — e não mais ao lado de "Novo item". A ação sobrescreve a categoria
 * inteira, então ela não pode ter o peso visual da ação do dia a dia.
 */
async function abrirMenuDaCategoria(page: Page) {
  await page.getByTestId('category-actions-open').click();
}

// --- a aba em Minha loja --------------------------------------------------

test('a tela Impressão lista os setores da filial resolvida', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  // Setor é por filial, e com "todas" no topo a tela resolve a principal em
  // vez de pedir uma — a lista aparece sem nenhum clique a mais, e a linha
  // auxiliar diz de qual filial ela é.
  await expect(page.getByTestId('store-branch-required')).toHaveCount(0);
  await expect(page.getByTestId('store-branch-note')).toHaveText(
    `vale só para a filial ${branchName(FAKE_BRANCH)}`,
  );

  await expect(page.getByTestId('print-sector-sec-chapa')).toContainText('Chapa');
  // O desativado continua na lista: o que some da tela ninguém reativa.
  await expect(page.getByTestId('print-sector-sec-bar')).toContainText('Bar');
  await expect(page.getByTestId('print-sector-sec-bar')).toContainText('Desativado');
});

/* ==========================================================================
 * O PROGRAMA DE IMPRESSÃO
 *
 * Três dos quatro blocos desta tela eram texto explicando o que não existia:
 * "o painel ainda não mostra se o programa está rodando", "as impressoras vão
 * aparecer aqui", "um botão aqui vai mandar uma comanda de exemplo". As rotas
 * saíram e os três passaram a ler delas.
 *
 * O REQUISITO QUE OS TESTES ANTIGOS GUARDAVAM NÃO MUDOU, só mudou de forma: a
 * tela não pode INVENTAR estado. Antes isso se provava mostrando que não havia
 * ponto verde nenhum; agora se prova mostrando que o ponto verde é o que o
 * backend reportou, e que os três casos que ele distingue chegam distintos à
 * tela.
 * ======================================================================= */

test('o bloco do programa mostra o estado que o backend reportou', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const estado = page.getByTestId('print-agent-status');
  await expect(estado).toContainText('Rodando agora');
  // A versão responde "esta loja está com o programa velho?" numa ligação de
  // suporte, e por isso ela fica na linha do estado e não numa própria.
  await expect(estado).toContainText('versão 1.4.2');

  // Com o programa no ar, a frase é a consequência — não o mecanismo.
  await expect(page.getByTestId('print-agent-hint')).toContainText(
    'Com ele desligado, nada é impresso',
  );

  /*
   * SEM JARGÃO, como antes. O lojista não tem por que saber o que é um agente,
   * um daemon ou um heartbeat — e o bloco inteiro fala de "programa de
   * impressão" e "computador do balcão".
   */
  const texto = (await page.getByTestId('print-agent-block').innerText()).toLowerCase();
  expect(texto).not.toContain('daemon');
  expect(texto).not.toContain('agente');
  expect(texto).not.toContain('headless');
  expect(texto).not.toContain('heartbeat');
});

/*
 * O SEGUNDO ESTADO: instalado e fora do ar. É o que interessa no sábado à
 * noite — nenhuma comanda está saindo, e a tela precisa dizer isso e o que
 * fazer, não só pintar um ponto de vermelho.
 */
test('programa desligado: a tela diz há quanto tempo e o que conferir', async ({ page }) => {
  api.setPrintAgentSeconds(FAKE_BRANCH.id, 3600);

  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const estado = page.getByTestId('print-agent-status');
  await expect(estado).toContainText('Sem sinal há 1 hora');
  await expect(estado).toHaveClass(/conn--offline/);

  await expect(page.getByTestId('print-agent-hint')).toContainText('Nenhuma comanda está saindo');
});

/*
 * O TERCEIRO ESTADO NÃO É UM CASO DO SEGUNDO, e é o que o contrato do backend
 * frisa ao responder 200 (e não 404) para filial sem agente: "nunca instalado"
 * se resolve indo instalar, "desligado" se resolve ligando o computador. A
 * tela que confunde os dois manda o lojista procurar um programa que não está
 * na máquina.
 */
test('filial sem programa instalado não é lida como programa desligado', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page, FAKE_BRANCH_2);
  await abrirAbaImpressao(page);

  const estado = page.getByTestId('print-agent-status');
  await expect(estado).toContainText('Nunca instalado nesta loja');
  // Cinza, não carmim: não há defeito, há uma loja que ainda não instalou.
  await expect(estado).not.toHaveClass(/conn--offline/);

  await expect(page.getByTestId('print-agent-hint')).toContainText(
    'Enquanto ele não for instalado nesta loja',
  );

  // E a lista vazia diz POR QUE está vazia — sem isso o lojista procura defeito
  // no cabo USB quando o que falta é o programa.
  await expect(page.getByTestId('printers-empty')).toContainText('nunca rodou nesta loja');
});

test('as impressoras são as que o programa reportou, com a padrão marcada', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const linhas = page.getByTestId('printer-row');
  await expect(linhas).toHaveCount(2);
  await expect(linhas.first()).toContainText('EPSON TM-T20');
  // A padrão é a que recebe todo setor sem escolha — inclusive um setor criado
  // depois da instalação, que é o caso em que a via sai no lugar errado.
  await expect(linhas.first()).toContainText('Padrão');
  await expect(linhas.nth(1)).toContainText('Bematech MP-4200 TH');
  await expect(linhas.nth(1)).not.toContainText('Padrão');
});

/* ==========================================================================
 * A IMPRESSORA DE CADA SETOR
 *
 * Deixou de morar no `config.ini` da máquina: o agente resolve pela escolha do
 * PAINEL primeiro, e só cai no arquivo local quando não há escolha. A troca
 * aconteceu porque o arquivo casa pelo NOME do setor — renomear "Cozinha"
 * fazia a via cair na impressora padrão e a comanda começar a sair no balcão,
 * sem erro em lugar nenhum.
 * ======================================================================= */

test('a impressora do setor é escolhida no painel, e nulo é uma escolha', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const seletor = page.getByTestId('print-sector-printer-sec-chapa');
  await expect(seletor).toContainText('EPSON TM-T20');

  // Trocar para a outra impressora reportada.
  await escolher(seletor, 'Bematech MP-4200 TH');
  await expect
    .poll(() => api.printSectors().find((entry) => entry.id === 'sec-chapa')?.printer_name)
    .toBe('Bematech MP-4200 TH');

  /*
   * E DESFAZER MANDA `null`, não a ausência do campo: "definida no programa" é
   * uma escolha do lojista (voltar para o `config.ini` da máquina), e é assim
   * que continua imprimindo toda loja instalada antes desta coluna existir.
   */
  await escolher(seletor, 'Definida no programa');
  await expect
    .poll(() => api.printSectors().find((entry) => entry.id === 'sec-chapa')?.printer_name)
    .toBeNull();
});

/* ==========================================================================
 * O TESTE DA COMANDA
 * ======================================================================= */

test('o teste manda o setor escolhido e diz que a via está saindo', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  /*
   * REGEX, e não texto exato: a opção carrega a família como dica ("Chapa
   * setor"), que é o que separa uma praça de uma máquina numa lista só.
   */
  await escolher(page.getByTestId('print-test-destino'), /^Chapa/);
  await page.getByTestId('print-test-send').click();

  // O corpo leva o SETOR, e não a impressora: é o caso comum ("testar a
  // Cozinha") e é ele que confere a corrente inteira, setor a impressora.
  await expect.poll(() => api.printTests()).toHaveLength(1);
  expect(api.printTests()[0]?.body).toEqual({ printing_sector_id: 'sec-chapa' });

  await expect(page.getByTestId('print-test-result')).toContainText('Teste enviado');
  await expect(page.getByTestId('print-test-result')).toContainText('Chapa');
});

/*
 * O SETOR DESATIVADO NÃO É DESTINO. Ele continua na lista de setores (o que
 * some da tela ninguém reativa), mas mandar uma via para uma praça desligada é
 * conferir uma coisa que a loja não usa.
 */
test('o destino do teste oferece setores ativos e impressoras, não o desativado', async ({
  page,
}) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const opcoes = await opcoesDe(page.getByTestId('print-test-destino'));
  const texto = opcoes.join(' | ');
  expect(texto).toContain('Chapa');
  expect(texto).toContain('EPSON TM-T20');
  expect(texto).not.toContain('Bar');
});

/*
 * A RESPOSTA É 202: o comando foi ENFILEIRADO, não impresso. Com o programa
 * desligado a via sai quando ele voltar — e um "Teste enviado" verde nesse caso
 * deixaria o lojista cinco minutos ao lado de uma impressora muda.
 */
test('com o programa desligado, o teste avisa que a via ficou na fila', async ({ page }) => {
  api.setPrintAgentSeconds(FAKE_BRANCH.id, 3600);

  await fazerLogin(page);
  await abrirAbaImpressao(page);

  await escolher(page.getByTestId('print-test-destino'), /^EPSON TM-T20/);
  await page.getByTestId('print-test-send').click();

  // O comando FOI gravado: o backend enfileira mesmo com o programa fora.
  await expect.poll(() => api.printTests()).toHaveLength(1);
  expect(api.printTests()[0]?.body).toEqual({ printer_name: 'EPSON TM-T20' });

  const resultado = page.getByTestId('print-test-result');
  await expect(resultado).toContainText('está desligado');
  await expect(resultado).toContainText('sai quando ele voltar, não agora');
  await expect(resultado).not.toContainText('confira o papel');
});

/*
 * O NÚMERO QUE FAZ ESTA TELA VALER A ABERTURA: item sem setor não sai na
 * comanda de produção, e hoje o lojista só descobre isso no sábado à noite,
 * quando a cozinha não recebe o pedido.
 */
test('Impressão mostra quantos itens tem cada setor e quantos ficaram sem', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  // No falso, só prod-1 aponta para a Chapa; os outros SEIS estão sem setor.
  await expect(page.getByTestId('print-sector-count-sec-chapa')).toHaveText('1 item');
  // Setor vazio E desativado: os dois qualificadores dividem a mesma célula.
  await expect(page.getByTestId('print-sector-count-sec-bar')).toHaveText(
    'nenhum item · Desativado',
  );

  /*
   * O TOTAL ENTRA NA ASSERÇÃO, e não só o "5 itens".
   *
   * A filial principal tem 7 produtos e a outra tem 7; a varredura já cruzou o
   * cardápio da REDE com os setores de UMA filial, e o número saía "12 de 13" —
   * impossível de zerar, porque todo item da outra loja caía em "sem setor".
   * Com "de 7" escrito na asserção, o que está sendo medido é o RECORTE, e não
   * um número que pode bater por acaso quando o cardápio do falso crescer — foi
   * o que aconteceu ao entrar "Onion rings", o item fora de venda por grupo
   * obrigatório: os dois números subiram um, e é assim que se vê que subiram
   * pelo motivo certo.
   */
  await expect(page.getByTestId('sector-coverage')).toContainText('6 itens');
  await expect(page.getByTestId('sector-coverage')).toContainText('de 7');
  await expect(page.getByTestId('sector-coverage')).toContainText('não imprime em setor nenhum');
});

test('cria, renomeia e desativa um setor', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await abrirAbaImpressao(page);

  // Criar.
  await page.getByTestId('print-sector-new-name').fill('Sobremesa');
  await page.getByTestId('print-sector-create').click();
  await expect(page.getByText('Sobremesa')).toBeVisible();
  expect(api.printSectors().some((entry) => entry.name === 'Sobremesa')).toBe(true);

  // Renomear.
  await page.getByTestId('print-sector-rename-sec-chapa').click();
  await page.getByTestId('print-sector-rename-input').fill('Chapa quente');
  await page.getByTestId('print-sector-rename-save').click();
  await expect(page.getByTestId('print-sector-sec-chapa')).toContainText('Chapa quente');

  // Desativar — e não excluir: os produtos guardam o id do setor.
  await page.getByRole('switch', { name: 'Chapa quente: desativar' }).click();
  await expect(page.getByTestId('print-sector-sec-chapa')).toContainText('Desativado');
  await expect
    .poll(() => api.printSectors().find((entry) => entry.id === 'sec-chapa')?.is_active)
    .toBe(false);

  // Nunca some da lista.
  await expect(page.getByTestId('print-sector-sec-chapa')).toBeVisible();
});

test('nome repetido é recusado antes de sair da tela', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await abrirAbaImpressao(page);

  const antes = api.printSectors().length;

  // Duas linhas "Chapa" deixariam o lojista sem saber qual escolher no produto.
  await page.getByTestId('print-sector-new-name').fill('  chapa  ');
  await page.getByTestId('print-sector-create').click();

  await expect(page.getByTestId('store-error')).toContainText('Já existe um setor');
  expect(api.printSectors()).toHaveLength(antes);
});

// --- o cardápio -----------------------------------------------------------

test('a lista de produtos mostra o setor de cada item', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  /*
   * A conferência de bate-pronto: um item configurado e dois não. É exatamente
   * o que o lojista precisa enxergar sem abrir item por item.
   */
  await expect(page.getByTestId('product-sector-prod-1')).toHaveText('Chapa');
  // Sem setor a célula fica vazia: o que se procura aqui é o item que TEM um.
  await expect(page.getByTestId('product-sector-prod-2')).toHaveText('');
  await expect(page.getByTestId('product-sector-prod-3')).toHaveText('');
});

/*
 * A COLUNA SUMIA E A AÇÃO FICAVA TRAVADA. Sem filial escolhida, o Cardápio
 * deixava de desenhar a coluna de setor e desabilitava "Aplicar setor a todos
 * os itens" — uma coluna a menos sem nada dizendo por quê, mais um controle
 * que o lojista não tinha como usar dali. Hoje a filial é resolvida e a coluna
 * DIZ de qual loja ela responde, que era a informação que faltava — no
 * CABEÇALHO da própria coluna, e não mais numa legenda solta no canto da linha
 * de busca, do outro lado da tela do que ela qualificava.
 */
test('sem filial escolhida, a coluna de setor diz de qual filial ela é', async ({ page }) => {
  await fazerLogin(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  await expect(page.getByTestId('product-row-prod-1')).toBeVisible();
  await expect(page.getByTestId('product-sector-prod-1')).toBeVisible();
  const cabecalho = page.getByTestId('menu-sector-scope');
  await expect(cabecalho).toContainText('Impressão');
  await expect(cabecalho).toContainText(branchName(FAKE_BRANCH));

  await abrirMenuDaCategoria(page);
  await expect(page.getByTestId('apply-sector-open')).toBeEnabled();
});

test('o campo de setor no produto oferece só os ativos, com "Não imprimir"', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  await page.getByRole('button', { name: 'Editar X-Salada' }).click();

  const campo = page.getByTestId('product-print-sector');
  await expect(campo).toBeVisible();
  // "Não imprimir" é uma escolha legítima e é onde o item sem setor está.
  await expect(campo).toHaveText('Não imprimir');

  // "Bar" está desativado: não pode ser oferecido — seria mandar comanda para
  // uma impressora que o lojista acabou de tirar do ar.
  expect(await opcoesDe(campo)).toEqual(['Não imprimir', 'Chapa']);

  await escolher(campo, 'Chapa');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByTestId('product-sector-prod-2')).toHaveText('Chapa');
  expect(api.products().find((item) => item.id === 'prod-2')?.printing_sector_id).toBe('sec-chapa');
});

test('aplicar o setor à categoria inteira resolve os 80 cliques', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  await abrirMenuDaCategoria(page);
  await page.getByTestId('apply-sector-open').click();

  /*
   * A contagem aparece ANTES de confirmar: é o que separa a ação certa da ação
   * lamentada. E o número que importa não é o total — é quantos JÁ têm setor,
   * porque são esses que alguém apontou à mão e vão ser sobrescritos. No falso,
   * a categoria tem 3 itens e só o X-Burger está configurado.
   */
  const aviso = page.getByTestId('apply-sector-warning');
  await expect(aviso).toContainText('3 itens');
  await expect(aviso).toContainText('já tinham outro setor');
  await expect(aviso).toContainText('1 já tem setor definido');

  await escolher(page.getByTestId('apply-sector-select'), 'Chapa');
  await page.getByTestId('apply-sector-confirm').click();

  // Uma chamada só, e não uma por produto.
  await expect.poll(() => api.categorySectorCalls()).toHaveLength(1);
  expect(api.categorySectorCalls()[0]).toMatchObject({
    categoryId: 'cat-1',
    printSectorId: 'sec-chapa',
  });

  // Todos os itens da categoria passam a imprimir na chapa — inclusive os que
  // estavam em "Não imprimir".
  await expect(page.getByTestId('product-sector-prod-2')).toHaveText('Chapa');
  await expect(page.getByTestId('product-sector-prod-3')).toHaveText('Chapa');

  // E a categoria vizinha não foi tocada.
  expect(
    api.products().find((item) => item.id === 'prod-4')?.printing_sector_id ?? null,
  ).toBeNull();
});

test('aplicar "Não imprimir" à categoria limpa o setor de todos', async ({ page }) => {
  await fazerLogin(page);
  await escolherFilial(page);
  await page.getByRole('link', { name: 'Cardápio' }).click();

  await expect(page.getByTestId('product-sector-prod-1')).toHaveText('Chapa');

  await abrirMenuDaCategoria(page);
  await page.getByTestId('apply-sector-open').click();
  // "Não imprimir" é o valor padrão do diálogo e vale como escolha.
  await page.getByTestId('apply-sector-confirm').click();

  await expect(page.getByTestId('product-sector-prod-1')).toHaveText('');
  expect(api.categorySectorCalls().at(-1)?.printSectorId).toBeNull();
});

/* ==========================================================================
 * COMO A COMANDA SAI — o rodapé e as vias
 *
 * Os dois vieram na mesma rodada e têm REGIMES OPOSTOS: a mensagem herda o
 * padrão da marca, as quatro contagens não herdam nada. O que os testes daqui
 * protegem é a distinção que não aparece na tela — no rodapé, `null` (voltar a
 * herdar) e `''` (esta loja não imprime) produzem a MESMA bobina em branco, e
 * só o corpo do PATCH diz qual dos dois foi pedido.
 * ======================================================================= */

test('o rodapé abre herdando, e a prévia mostra o que sai hoje', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const bloco = page.getByTestId('print-footer-block');
  await expect(bloco.getByTestId('print-footer-mode-herda')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // A prévia é a mensagem da MARCA, acinzentada: é o que o cliente lê hoje.
  await expect(bloco.getByTestId('print-footer-preview')).toContainText('@pizzariadoze');
  // Herdando não há caixa de texto: não há o que escrever.
  await expect(bloco.getByTestId('print-footer-text')).toHaveCount(0);
});

/*
 * O TESTE QUE PAGA A RODADA. Se a tela mandar `''` onde queria `null`, a loja
 * para de imprimir a campanha da rede e ninguém entende — não há tela onde isso
 * apareça, só a bobina.
 */
test('“não imprimir” manda string vazia e “herdar” manda null', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const bloco = page.getByTestId('print-footer-block');

  // Esta loja recusa a campanha da rede.
  await bloco.getByTestId('print-footer-mode-nao-imprime').click();
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  expect(api.printSettingsPatches().at(-1)?.body).toEqual({ receipt_footer_message: '' });
  // E a prévia da marca sai da tela: não é mais o que vai sair.
  await expect(bloco.getByTestId('print-footer-preview')).toHaveCount(0);

  // Voltar atrás é `null`, e NÃO um campo apagado.
  await bloco.getByTestId('print-footer-mode-herda').click();
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  expect(api.printSettingsPatches().at(-1)?.body).toEqual({ receipt_footer_message: null });
  await expect(bloco.getByTestId('print-footer-preview')).toContainText('@pizzariadoze');
});

test('escrever a mensagem da loja, e a caixa vazia não vira “não imprimir”', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const bloco = page.getByTestId('print-footer-block');
  await bloco.getByTestId('print-footer-mode-propria').click();

  /*
   * ESCOLHEU ESCREVER E NÃO ESCREVEU: é erro, e não um `''` silencioso. Quem
   * quer desligar tem uma opção com esse nome logo ao lado.
   */
  await bloco.getByTestId('print-footer-text').fill('   ');
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-error')).toContainText('Não imprimir');
  expect(api.printSettingsPatches()).toHaveLength(0);

  await bloco.getByTestId('print-footer-text').fill('Peça direto no site\te ganhe 5%');
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  expect(api.printSettingsPatches().at(-1)?.body).toEqual({
    receipt_footer_message: 'Peça direto no site\te ganhe 5%',
  });

  /*
   * O BACKEND NORMALIZA NA GRAVAÇÃO — a tabulação vira espaço —, e a tela
   * REPINTA o campo com o que voltou. Mostrar o que foi digitado enquanto a
   * bobina imprime outra coisa é a divergência que só aparece no papel.
   */
  await expect(bloco.getByTestId('print-footer-text')).toHaveValue(
    'Peça direto no site e ganhe 5%',
  );
});

test('as vias vão de 0 a 5, sem herdar, e zero é uma escolha', async ({ page }) => {
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  const bloco = page.getByTestId('print-copies-block');
  // Nenhum controle de herança aqui: as quatro são só da filial.
  await expect(bloco.getByText('Só desta filial')).toBeVisible();

  // A retirada normalmente não leva a via do cliente — o caso que originou tudo.
  await escolher(bloco.getByTestId('print-copies-customer-pickup'), '0');
  await page.getByTestId('store-save').click();
  await expect(page.getByTestId('store-saved')).toBeVisible();

  // Vai o ZERO, e não um nulo: `null` numa contagem é 422, porque ela não herda.
  expect(api.printSettingsPatches().at(-1)?.body).toEqual({
    print_customer_copies_pickup: 0,
  });

  // E o que não mudou não é reenviado.
  expect(
    Object.keys(api.printSettingsPatches().at(-1)?.body ?? {}),
  ).toHaveLength(1);
});

test('o balcão lê como a comanda sai, e não a edita', async ({ page }) => {
  api.entrarComoPapel('attendant');
  await fazerLogin(page);
  await abrirAbaImpressao(page);

  /*
   * A LEITURA É DE QUEM OPERA e a escrita é da gerência — a única dupla assim
   * do painel. Quem está em pé ao lado da impressora é quem pergunta "por que
   * saíram duas vias?", e some o controle, não o dado.
   */
  await expect(page.getByTestId('print-copies-readonly')).toContainText('1 do cliente');
  await expect(page.getByTestId('print-copies-readonly')).toContainText(
    '1 da produção por setor',
  );
  await expect(page.getByTestId('print-copies-customer-pickup')).toHaveCount(0);

  await expect(page.getByTestId('print-footer-readonly')).toContainText(
    'segue a mensagem da marca',
  );
  await expect(page.getByTestId('print-footer-mode-herda')).toHaveCount(0);
  await expect(page.getByTestId('store-save-bar')).toHaveCount(0);
});
