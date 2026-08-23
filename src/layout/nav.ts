import type { ComponentType } from 'react';

import type { Acao } from '../auth/permissions';

import {
  CashbackIcon,
  ChatIcon,
  CouponIcon,
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
 * etiqueta "em breve" na lateral e a rota cai na página de estado. Quando a
 * tela for construída, apaga-se o campo e troca-se o elemento da rota — nada
 * mais muda.
 *
 * Esta lista é a FONTE ÚNICA: a lateral (`AppShell`) e as rotas (`App`) leem
 * daqui. Duas listas divergiriam no dia em que alguém acrescentasse uma tela.
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
   *
   * Só duas telas construídas precisam disso hoje, e as duas são a TELA
   * INTEIRA, não um botão dentro dela: a lista de clientes devolve nome e
   * telefone da base toda, e os relatórios são faturamento.
   */
  acao?: Acao;
};

export type NavGroup = {
  /** Rótulo pequeno e fino, sem linha divisória: o vão já separa os grupos. */
  title: string;
  entries: NavEntry[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: 'Operação',
    entries: [
      { to: '/pedidos', label: 'Pedidos', Icon: OrdersIcon },
      /*
        A Cozinha é uma tela cheia, sem esta lateral. O link continua aqui
        porque é daqui que o lojista a abre no começo do turno — o que ela não
        tem é volta pela navegação, e sim o "Sair da cozinha" no próprio canto.
      */
      { to: '/cozinha', label: 'Cozinha', Icon: KitchenIcon },
    ],
  },
  {
    title: 'Cardápio',
    entries: [{ to: '/cardapio', label: 'Cardápio', Icon: MenuIcon }],
  },
  {
    title: 'Crescimento',
    entries: [
      { to: '/clientes', label: 'Clientes', Icon: CustomersIcon, acao: 'clientes.ver' },
      /*
       * O `soon` SAIU e a tela existe — o mesmo mecanismo do Cashback logo
       * abaixo: enquanto o campo estava aqui, a rota caía na página "em breve"
       * e a tela construída ficava inalcançável.
       *
       * A frase antiga prometia "criar códigos de desconto com validade, valor
       * mínimo e limite de uso" — e ela estava certa sobre tudo menos o começo:
       * o lojista não cria o DESCONTO, ele escolhe uma arte da plataforma que
       * já traz o valor impresso. Quem diz isso hoje é a própria tela, no
       * seletor de arte, que é onde a frase continua sendo lida depois de a
       * tela existir.
       *
       * `acao` entrou junto porque `GET /admin/coupons` é GERENCIA: o atendente
       * que clicasse aqui cairia numa tela que responde 403.
       */
      { to: '/cupons', label: 'Cupons', Icon: CouponIcon, acao: 'cupons.ver' },
      /*
       * O `soon` SAIU e a tela existe. O campo é o mecanismo, não um texto de
       * apoio: enquanto ele estava aqui, a rota caía na página "em breve" e a
       * tela construída ficava inalcançável.
       *
       * `acao` entrou junto porque as cinco rotas de cashback são GERENCIA para
       * ler — o atendente que clicasse aqui cairia numa tela que responde 403 e
       * leria isso como defeito do painel.
       */
      { to: '/cashback', label: 'Cashback', Icon: CashbackIcon, acao: 'cashback.ver' },
      /*
       * A FRASE DESTE ITEM SAIU DAQUI, e não porque virou obsoleta: `soon` é o
       * mecanismo, não um texto de apoio. Enquanto ele existe, a rota cai na
       * página "em breve" e a tela construída fica inalcançável — o campo
       * decide as duas coisas ao mesmo tempo.
       *
       * A frase antiga prometia "horários de pico, por filial", e nenhuma das
       * duas tem rota no contrato. A descrição do que a tela REALMENTE faz
       * passou para o cabeçalho de `PerformancePage`, que é onde ela continua
       * sendo lida depois de a tela existir — e onde o escopo de filial é dito
       * por escrito em vez de prometido.
       */
      { to: '/desempenho', label: 'Desempenho', Icon: PerformanceIcon, acao: 'desempenho.ver' },
      /*
       * AVALIAÇÕES FICA EM CRESCIMENTO, ao lado de Desempenho, e não em
       * Operação com Pedidos e Cozinha. As duas de Operação são telas de
       * TURNO — ficam abertas, mudam sozinhas e dizem o que fazer agora. Esta
       * se consulta: abre-se para responder "o que deu errado esta semana" e
       * fecha-se, que é o mesmo uso de Desempenho logo acima.
       */
      { to: '/avaliacoes', label: 'Avaliações', Icon: StarIcon, acao: 'avaliacoes.ver' },
    ],
  },
  {
    title: 'Configurações',
    entries: [
      { to: '/minha-loja', label: 'Minha loja', Icon: StoreIcon },
      {
        to: '/usuarios',
        label: 'Usuários',
        Icon: TeamIcon,
        soon: 'Quem entra no painel, com qual permissão e em qual filial.',
      },
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

/** As entradas que ainda não têm tela. É a partir daqui que as rotas nascem. */
export const PENDING_ENTRIES: readonly { to: string; label: string; soon: string }[] =
  NAV_GROUPS.flatMap((group) =>
    group.entries.flatMap((entry) =>
      entry.soon ? [{ to: entry.to, label: entry.label, soon: entry.soon }] : [],
    ),
  );
