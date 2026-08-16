import type { ComponentType } from 'react';

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
      { to: '/clientes', label: 'Clientes', Icon: CustomersIcon },
      {
        to: '/cupons',
        label: 'Cupons',
        Icon: CouponIcon,
        soon: 'Criar códigos de desconto com validade, valor mínimo e limite de uso.',
      },
      {
        to: '/cashback',
        label: 'Cashback',
        Icon: CashbackIcon,
        soon: 'Devolver parte do pedido em crédito e acompanhar quanto disso volta em compra.',
      },
      {
        to: '/desempenho',
        label: 'Desempenho',
        Icon: PerformanceIcon,
        soon: 'Faturamento, ticket médio e horários de pico, por filial e por período.',
      },
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
