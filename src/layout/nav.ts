import type { ComponentType } from 'react';

import type { Acao } from '../auth/permissions';

import {
  CashbackIcon,
  ChatIcon,
  CouponIcon,
  CourierIcon,
  CustomersIcon,
  IntegrationsIcon,
  KitchenIcon,
  MenuIcon,
  OrdersIcon,
  PerformanceIcon,
  StarIcon,
  StoreIcon,
  TeamIcon,
} from '../ds/icons';

/**
 * A navegação inteira do produto — inclusive o que ainda não existe.
 *
 * POR QUE O QUE NÃO EXISTE APARECE: esconder a seção não faz o lojista deixar
 * de procurá-la; faz ele procurar e não achar, e concluir que o painel não
 * tem. Com o item na lista, ele descobre em um clique o que vem e para de
 * caçar. O preço disso é um contrato: a página de destino diz o que a tela vai
 * fazer e NADA MAIS — sem botão falso, sem número inventado, sem barra de
 * progresso. Ver `ComingSoonPage`.
 *
 * `soon` é o campo que decide tudo: presente, o item vira peso reduzido +
 * etiqueta "em breve" na lateral, a rota cai na página de estado, e ele AFUNDA
 * para o fim do grupo (ver `ordenar` no fim deste arquivo). Quando a tela for
 * construída, apaga-se o campo e troca-se o elemento da rota — nada mais muda,
 * inclusive a posição, que sobe sozinha.
 *
 * Esta lista é a FONTE ÚNICA: a lateral (`AppShell`), a barra de baixo
 * (`BottomBar`) e as rotas (`App`) leem daqui. Duas listas divergiriam no dia
 * em que alguém acrescentasse uma tela.
 *
 * O ícone entra como COMPONENTE, não como elemento montado: assim este arquivo
 * continua sendo `.ts` (dado, não tela) e quem desenha decide o tamanho.
 */
export type NavEntry = {
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  /**
   * Uma frase do que a tela vai fazer. Presente = a tela ainda não existe.
   * É o texto que a página de estado mostra, então ele fala do trabalho do
   * lojista, não da implementação.
   */
  soon?: string;
  /**
   * A ação que este item exige. Ausente = todo papel que entra no painel vê.
   *
   * NÃO É "esconder por segurança" — quem recusa é o backend, sempre. É que um
   * item de navegação que leva a uma tela 403 é um item que só serve para
   * frustrar: o atendente clica em Clientes, a lista não carrega, e ele conclui
   * que o painel está quebrado.
   */
  acao?: Acao;
};

export type NavGroup = {
  /** Rótulo pequeno e fino, sem linha divisória: o vão já separa os grupos. */
  title: string;
  entries: NavEntry[];
  /**
   * O BLOCO PREGADO NO PÉ — o que se CONFIGURA, e não o que se faz.
   *
   * Ele existe porque os painéis que servem de referência convergem numa coisa
   * só: ninguém põe configuração como grupo irmão do trabalho do dia. O Shopify
   * e o Square pregam "Settings" no rodapé, fora da lista; o Linear e o Stripe
   * a põem noutro plano; o Cardápio Web a aparta em "Administrativo" e
   * "Configurações". O ganho é de HICK — a lista que o olho varre todo dia cai
   * para oito itens, e os quatro de configuração saem do caminho sem sair do
   * produto.
   *
   * O TÍTULO DELE NÃO É PINTADO: quem diz "isto é outra natureza" é o fio e a
   * posição (proximidade), que custam menos que uma linha de texto. O título
   * continua existindo como nome acessível da lista — um bloco de quatro links
   * sem nome nenhum é um bloco mudo para quem usa leitor de tela.
   *
   * ELE NÃO É EMPURRADO PARA O FUNDO DA JANELA. Pregar no rodapé do viewport
   * funciona no Shopify porque a lista dele é densa; aqui, com oito itens acima
   * numa janela de 900px, sobrariam ~400px de vão morto no meio da lateral. O
   * pé é o fim da LISTA, não o fim da tela.
   */
  rodape?: true;
};

/**
 * ============================================================================
 * OS TRÊS GRUPOS E O PÉ
 * ============================================================================
 *
 * O critério não é ASSUNTO, é FREQUÊNCIA E NATUREZA DE USO — o que se toca no
 * meio do serviço, o que se toca por semana, e o que se encosta uma vez. Mas a
 * frequência decide a ORDEM e a PROFUNDIDADE, nunca o RÓTULO: ninguém varre um
 * menu perguntando "o que eu faço por semana?", varre perguntando "onde mora
 * X". Por isso os nomes são o vocabulário do lojista, que já vem do iFood e do
 * Cardápio Web (Jakob).
 *
 * O QUE ESTA LISTA DESFEZ, e o motivo de cada movimento:
 *
 *   - "Cardápio" era um grupo de UM item. Ele entrou em Hoje porque
 *     `cardapio.trocarDisponibilidade` é PESSOAS: "acabou a costela" é a ação
 *     mais frequente do turno e é do balcão. Quando uma tela é dupla — esgotar
 *     é diário, preço e ordem são semanais —, ela mora onde está a ação mais
 *     frequente dela.
 *
 *   - CUPONS E CASHBACK saíram de "Crescimento". Eles são CAMPANHA: dinheiro
 *     que o lojista escolhe gastar para vender mais. Desempenho, Avaliações e
 *     Clientes são LEITURA. É a mesma divisão que o Cardápio Web faz entre
 *     "Aumento de Vendas" e "Gestão", e que o Shopify faz entre Marketing e
 *     Analytics.
 *
 *   - CLIENTES ficou com a leitura, e não com a campanha: a tela não abre o
 *     cliente, não linka para os pedidos dele e não ordena por coluna. É lista
 *     de consulta.
 *
 *   - USUÁRIOS saiu de "Configurações" e é o último item VIVO do pé. É conta e
 *     acesso, não comportamento do sistema — a distinção que o Cardápio Web faz
 *     entre "Administrativo" e "Configurações". Ela não vira grupo hoje porque
 *     "Administrativo" teria exatamente um membro, e grupo de um item não é
 *     grupo. A posição é que está reservada: quando Assinaturas existir, entra
 *     um fio entre Loja e Usuários e nada mais se move.
 *
 * O GRUPO É HOMOGÊNEO DE PAPEL, e isso é regra, não sorte — `nav.test.ts` a
 * cobra. Nenhum grupo pode renderizar com UM item para papel nenhum: ou todos
 * os itens dele exigem a mesma ação, ou nenhum exige ação. Ver `use-nav.ts`,
 * que já não desenha grupo vazio.
 */
const GRUPOS: readonly NavGroup[] = [
  /*
   * HOJE — o que se abre no começo do turno e fica aberto.
   *
   * O nome não é mais "Operação", e a troca não é de gosto: "Operação" já é o
   * nome da SEÇÃO de abrir/fechar dentro de Loja, e passou a ser também o da
   * terceira aba da barra de baixo. Três coisas diferentes com o mesmo nome é
   * pior que um rótulo novo para aprender.
   */
  {
    title: 'Hoje',
    entries: [
      { to: '/pedidos', label: 'Pedidos', Icon: OrdersIcon },
      /*
        A Cozinha é uma tela cheia, sem esta lateral. O link continua aqui
        porque é daqui que o lojista a abre no começo do turno — o que ela não
        tem é volta pela navegação, e sim o "Sair da cozinha" no próprio canto.
      */
      { to: '/cozinha', label: 'Cozinha', Icon: KitchenIcon },
      { to: '/cardapio', label: 'Cardápio', Icon: MenuIcon },
      /*
       * ENTREGADORES É DE "HOJE", e não do pé com as configurações.
       *
       * Quem atribui um pedido a um motoboy é o ATENDENTE, no meio do turno,
       * quando o motoboy chega ao balcão — `POST .../assignments` é PESSOAS de
       * propósito. Enterrar a tela junto de Loja e Usuários faria essa pessoa
       * procurá-la entre as configurações, que é onde ela não vai olhar com o
       * pedido na mão.
       *
       * O cadastro em si é semanal e mora dentro desta mesma tela: a
       * frequência decide a POSIÇÃO, e a posição é a da ação mais frequente —
       * a mesma regra que trouxe o Cardápio para cá por causa do "acabou a
       * costela".
       *
       * `acao` é a da LEITURA (PESSOAS), como em Cupons: cadastrar e excluir
       * são da gerência e isso é decidido DENTRO da tela. O grupo continua
       * homogêneo — os quatro itens são visíveis a todo papel que entra.
       */
      { to: '/entregadores', label: 'Entregadores', Icon: CourierIcon, acao: 'entregadores.ver' },
    ],
  },
  /*
   * VENDER MAIS — a campanha. É o grupo mais magro da lateral, com dois itens,
   * e ele se sustenta porque a alternativa é devolvê-los para junto de
   * Desempenho e Avaliações, que é exatamente o "Crescimento" que esta rodada
   * desmanchou. Campanha e leitura são naturezas diferentes.
   */
  {
    title: 'Vender mais',
    entries: [
      /*
       * `acao` é a da LEITURA (`GET /admin/coupons`, GERENCIA): criar e editar
       * são do dono, e isso é decidido dentro da tela. Os dois itens deste
       * grupo exigem a mesma coisa, então ele é 2 ou 0 — nunca 1.
       */
      { to: '/cupons', label: 'Cupons', Icon: CouponIcon, acao: 'cupons.ver' },
      { to: '/cashback', label: 'Cashback', Icon: CashbackIcon, acao: 'cashback.ver' },
    ],
  },
  /*
   * ACOMPANHAR — o que se consulta e se fecha. As três se abrem para responder
   * "o que aconteceu esta semana", e as três são GERENCIA: o grupo é 3 ou 0.
   */
  {
    title: 'Acompanhar',
    entries: [
      { to: '/clientes', label: 'Clientes', Icon: CustomersIcon, acao: 'clientes.ver' },
      { to: '/desempenho', label: 'Desempenho', Icon: PerformanceIcon, acao: 'desempenho.ver' },
      { to: '/avaliacoes', label: 'Avaliações', Icon: StarIcon, acao: 'avaliacoes.ver' },
    ],
  },
  /*
   * O PÉ. Ver o comentário de `rodape` acima para o porquê de ele não ter
   * rótulo pintado nem ser empurrado para o fundo da janela.
   */
  {
    title: 'Configuração e conta',
    rodape: true,
    entries: [
      /*
       * "LOJA", E NÃO MAIS "MINHA LOJA". O possessivo singular é o que mente
       * num restaurante com duas filiais; quem diz de qual filial é o
       * formulário já é a ressalva de escopo na faixa da tela. De quebra morre
       * o caso especial de `BottomBar.rotuloCurto()`, que existia só para
       * encurtar este rótulo no telefone.
       */
      { to: '/loja', label: 'Loja', Icon: StoreIcon },
      { to: '/usuarios', label: 'Usuários', Icon: TeamIcon, acao: 'usuarios.ver' },
      {
        to: '/whatsapp',
        label: 'WhatsApp',
        Icon: ChatIcon,
        soon: 'Ligar o número da loja para avisar o cliente a cada mudança de status do pedido.',
      },
      {
        to: '/integracoes',
        label: 'Integrações',
        Icon: IntegrationsIcon,
        soon: 'Conectar gateway de pagamento, emissor de nota fiscal e impressora de comanda.',
      },
    ],
  },
];

/**
 * O QUE AINDA NÃO EXISTE AFUNDA PARA O FIM DO GRUPO.
 *
 * Não é enfeite de ordenação: é o que garante que um item morto nunca fique
 * ENTRE dois vivos. Um "em breve" no meio da lista é o que ensina o olho a
 * pular a região inteira — e a região inteira inclui os itens que funcionam.
 * No fim, abaixo de um vão, ele custa o espaço dele e mais nada (proximidade).
 *
 * É um `sort` sobre o campo que já decide o peso do item e o destino da rota,
 * e não um campo novo: quando a tela for construída, apagar `soon` sobe o item
 * de volta sozinho, sem ninguém precisar lembrar de movê-lo.
 *
 * O `sort` é ESTÁVEL (ES2019 em diante), então a ordem escrita à mão dentro de
 * cada metade é preservada.
 */
function ordenar(group: NavGroup): NavGroup {
  return {
    ...group,
    entries: [...group.entries].sort((a, b) => Number(Boolean(a.soon)) - Number(Boolean(b.soon))),
  };
}

export const NAV_GROUPS: readonly NavGroup[] = GRUPOS.map(ordenar);

/** As entradas que ainda não têm tela. É a partir daqui que as rotas nascem. */
export const PENDING_ENTRIES: readonly { to: string; label: string; soon: string }[] =
  NAV_GROUPS.flatMap((group) =>
    group.entries.flatMap((entry) =>
      entry.soon ? [{ to: entry.to, label: entry.label, soon: entry.soon }] : [],
    ),
  );
