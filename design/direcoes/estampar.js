/*
 * Estampa as três telas de uma direção nos dois temas.
 *
 * É script só para não manter seis cópias do mesmo markup na folha: o que se
 * compara aqui é CSS, e um <ul> de onze itens repetido seis vezes seriam seis
 * lugares para divergir. Nada disto vai para o app.
 *
 * A folha declara a ORDEM DOS TEMAS, porque ela muda por direção — Brasa nasce
 * escura, Papel nasce clara, e cada uma se apresenta pelo seu tema principal:
 *
 *   <main id="folha" data-temas="dark,light"></main>
 */
(function () {
  const TELAS = [
    {
      id: 'tela-pedidos',
      rota: 'pedidos',
      nome: 'Pedidos',
      nota: 'Três faixas, histórico numa aba, barra de filtros fixa.',
    },
    {
      id: 'tela-cardapio',
      rota: 'cardapio',
      nome: 'Cardápio',
      nota: 'Lista de dados: o nome é fluido, o resto tem coluna fixa.',
    },
    {
      id: 'tela-loja',
      rota: 'minha-loja',
      nome: 'Minha loja',
      nota: 'Coluna única com âncoras — as seis abas saíram.',
    },
  ];

  const NOME_DO_TEMA = {
    dark: 'Escuro',
    light: 'Claro',
  };

  /** As seções que ainda não têm tela. Sai de `src/layout/nav.ts`. */
  const SEM_TELA = [
    'clientes',
    'cupons',
    'cashback',
    'desempenho',
    'usuarios',
    'whatsapp',
    'integracoes',
  ];

  const folha = document.getElementById('folha');
  const temas = (folha.dataset.temas || 'dark,light').split(',');
  const principal = temas[0];

  for (const tema of temas) {
    const bloco = document.createElement('section');
    bloco.className = 'folha__tema';
    const sufixo = tema === principal ? ' — o tema principal desta direção' : '';
    bloco.innerHTML = `<h2 class="folha__tema-nome">${NOME_DO_TEMA[tema]}${sufixo}</h2>`;

    for (const tela of TELAS) {
      const caixa = document.createElement('div');
      caixa.className = 'folha__tela';
      caixa.innerHTML = `<p class="folha__tela-nome"><strong>${tela.nome}</strong> — ${tela.nota}</p>`;

      const shell = document.createElement('div');
      shell.className = 'shell';
      shell.setAttribute('data-theme', tema);

      const nav = document.createElement('nav');
      nav.className = 'shell__nav';
      nav.setAttribute('aria-label', 'Seções do painel');
      nav.append(document.getElementById('nav-tpl').content.cloneNode(true));
      nav.querySelectorAll('[data-rota]').forEach((link) => {
        if (link.dataset.rota === tela.rota) link.classList.add('shell__link--on');
        if (SEM_TELA.includes(link.dataset.rota)) {
          link.classList.add('shell__link--soon');
          link.insertAdjacentHTML('beforeend', '<span class="shell__soon">em breve</span>');
        }
      });

      const main = document.createElement('div');
      main.className = 'shell__main';
      main.innerHTML = `
        <header class="shell__bar">
          <span class="branch">
            <span class="branch__name">Pizzaria do Zé — Aldeota</span>
            <span class="branch__detail">Av. Santos Dumont, 1200 · Aldeota · Fortaleza</span>
          </span>
          <span class="shell__spacer"></span>
          <span class="shell__user">Caio Ribeiro · Proprietário</span>
          <button class="btn btn--sm" type="button">Sair</button>
        </header>`;

      const conteudo = document.createElement('main');
      conteudo.className = 'shell__content';
      conteudo.append(document.getElementById(tela.id).content.cloneNode(true));
      main.append(conteudo);

      shell.append(nav, main);
      caixa.append(shell);
      bloco.append(caixa);
    }

    folha.append(bloco);
  }
})();
