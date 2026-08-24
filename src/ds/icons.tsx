/**
 * OS ÍCONES DO SISTEMA — um arquivo, e só um.
 *
 * Havia dois (`ds/icons.tsx` e `ui/icons.tsx`) com seis nomes repetidos entre
 * eles: SearchIcon, PlusIcon, MoreIcon e as duas setas existiam duas vezes, com
 * desenhos diferentes. Isso é exatamente o que a regra do sistema proíbe — se
 * há dois nomes para a mesma coisa, um dos dois é para apagar.
 *
 * O TRAÇO DESTA DIREÇÃO: grade de 24, **traço 1,5, ponta arredondada
 * (`round`) e junta arredondada (`round`)**. É o vocabulário de ícone de
 * aplicação comum — a ponta reta e o canto vivo que a direção anterior usava
 * liam como desenho de chapa cortada, sotaque que este painel não quer mais.
 *
 * REGRAS QUE VALEM PARA TODO ÍCONE DAQUI:
 *   - `stroke="currentColor"` e `fill="none"`: quem decide a cor é o texto ao
 *     redor, nunca o ícone.
 *   - `aria-hidden="true"`: ícone nunca é o nome de nada. Se ele é a única
 *     coisa dentro de um botão, o botão leva `aria-label`.
 *   - mesmo peso em todos: numa coluna de onze itens, um ícone mais gordo puxa
 *     o olho para a seção errada.
 */
import type { ReactNode } from 'react';

type IconProps = { size?: number };

function Icon({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* --- ações e controles ---------------------------------------------------- */

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12.5l5 5L20 6.5" />
    </Icon>
  );
}

/**
 * Duas folhas sobrepostas: copiar para a área de transferência.
 *
 * O desenho é o convencional de todo sistema operacional, e é isso que se quer
 * dele — este ícone aparece ao lado de um valor que a pessoa precisa levar
 * daqui, e um símbolo inventado obrigaria a ler o rótulo antes de entender.
 */
export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" />
    </Icon>
  );
}

/** Três traços curtos: o menu de ações que não são a ação principal da tela. */
export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 6h2M11 12h2M11 18h2" />
    </Icon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 9 7 7 7-7" />
    </Icon>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 15 7-7 7 7" />
    </Icon>
  );
}

/*
 * A DIREÇÃO DE UMA VARIAÇÃO — a seta que acompanha o percentual em Desempenho.
 *
 * Ela existe para que a leitura "subiu" / "caiu" não dependa SÓ da cor (WCAG
 * 1.4.1): quem não distingue o verde do vermelho lê a mesma coisa pela
 * inclinação da seta. O sinal de menos continua no texto; a seta é o terceiro
 * canal, não o único.
 */
export function TrendUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 16.5 5.5-5.5 3.5 3.5L20 7" />
      <path d="M15 7h5v5" />
    </Icon>
  );
}

export function TrendDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 7.5 5.5 5.5 3.5-3.5L20 17" />
      <path d="M15 17h5v-5" />
    </Icon>
  );
}

/** Triângulo de atenção. O único ícone que carrega semântica de estado. */
export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 2.5 20.5h19L12 4Z" />
      <path d="M12 10v4M12 17.2v.01" />
    </Icon>
  );
}

/**
 * A INTERROGAÇÃO DENTRO DO CÍRCULO — o gatilho da ajuda de uma tela.
 *
 * Ela é a única forma que o sistema aceita para "há uma explicação aqui", e é
 * de propósito que ela NÃO é o "i" de informação: o "i" é usado pelo painel
 * para dizer "isto é uma nota, não um problema" (`.alert--info`), e um mesmo
 * desenho valendo uma frase que se lê e um botão que se aperta é como o
 * lojista aprende a ignorar os dois.
 *
 * O ponto é um traço de comprimento zero: com a ponta arredondada do sistema
 * ele sai redondo, e sem `fill` nenhum — a regra de `currentColor` continua
 * valendo. É a mesma solução do pingo do `AlertIcon`.
 */
export function HelpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M9.4 9.4a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.7-.9 1.3v.5" />
      <path d="M12 16.7v.01" />
    </Icon>
  );
}

/**
 * O sino do alerta sonoro, com a barra do desligado.
 *
 * Ele mora aqui, e não solto na barra de pedidos, porque ícone desenhado
 * dentro de uma tela é o começo de um segundo conjunto — foi assim que os dois
 * arquivos anteriores nasceram.
 */
export function BellIcon({ muted = false, ...props }: IconProps & { muted?: boolean }) {
  return (
    <Icon {...props}>
      <path d="M18 9a6 6 0 0 0-12 0c0 6-3 8-3 8h18s-3-2-3-8" />
      <path d="M10.2 20.5a2 2 0 0 0 3.6 0" />
      {muted ? <path d="M3.5 3.5l17 17" /> : null}
    </Icon>
  );
}

/** Seta circular do "atualizar agora". */
export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v4h-4" />
    </Icon>
  );
}

/* --- ícones da navegação --------------------------------------------------
 *
 * Um por seção do produto, todos na mesma grade e no mesmo traço.
 */

/** Pedidos: as linhas de uma comanda. */
export function OrdersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16M4 10h16M4 15h16M4 20h9" />
    </Icon>
  );
}

/** Cardápio: a carta aberta, com as duas colunas. */
export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h16v16H4z" />
      <path d="M12 4v16M7 8h2M15 8h2M7 12h2M15 12h2" />
    </Icon>
  );
}

/** Cozinha: a panela na chapa, com o vapor. */
export function KitchenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10h18v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-6Z" />
      <path d="M21 12h1.5v3H21" />
      <path d="M7 7V4M12 7V4M17 7V4" />
    </Icon>
  );
}

/** Minha loja: o toldo. */
export function StoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 9h18v11H3z" />
      <path d="M3 9l2-5h14l2 5" />
      <path d="M9 20v-6h6v6" />
    </Icon>
  );
}

/** Clientes: a ficha de cadastro. */
export function CustomersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9h6v6H6z" />
      <path d="M3 21v-2h12v2" />
      <path d="M15 10h6M15 14h6M15 18h6" />
    </Icon>
  );
}

/** Cupom: o bilhete com o picote. */
export function CouponIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V7Z" />
      <path d="M14 9v1M14 14v1" />
    </Icon>
  );
}

/** Cashback: a moeda que volta. */
export function CashbackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4v4h4" />
      <path d="M4.5 8.5A8 8 0 1 1 4 12" />
      <path d="M15 10a3 3 0 1 0 0 4" />
    </Icon>
  );
}

/**
 * O punho de arrastar: seis pontos, a convenção universal.
 *
 * SEIS PONTOS E NÃO DUAS LINHAS. O traço duplo é o mesmo desenho do ícone de
 * menu (`OrdersIcon` e a barra de "Mais" do celular usam listras), e num punho
 * ele lê como "abrir uma lista". Os pontos não significam nada além de "isto se
 * pega", que é exatamente o que se quer dizer.
 *
 * `fill="currentColor"` nos círculos: é o único ícone do arquivo desenhado com
 * preenchimento, porque um ponto de 1px de contorno em raio 1 vira um borrão na
 * grade de 24. A cor continua saindo do texto ao redor, que é a regra.
 */
export function GripIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Desempenho: as barras subindo. */
export function PerformanceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4v16h16" />
      <path d="M8 17V12M13 17V8M18 17V5" />
    </Icon>
  );
}

/**
 * Avaliações: a estrela.
 *
 * A ÚNICA DO ARQUIVO QUE TEM ESTADO PREENCHIDO, e é o que a nota exige: cinco
 * contornos idênticos não dizem "3 de 5". `filled` pinta o miolo com
 * `currentColor` no PATH — o `fill="none"` do `<Icon>` é do `<svg>`, e o filho
 * o sobrescreve —, então quem decide a cor continua sendo o texto ao redor.
 *
 * Ela serve à navegação (contorno, como todos os outros) e à nota na lista.
 */
export function StarIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props}>
      <path
        d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </Icon>
  );
}

/**
 * Usuários do painel: o crachá.
 *
 * Não são duas pessoas como em Clientes — quem entra aqui administra QUEM tem
 * acesso, e dois ícones de gente na mesma coluna virariam a mesma seção.
 */
export function TeamIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h16v16H4z" />
      <path d="M8 10h3v3H8z" />
      <path d="M7 17a3 3 0 0 1 5 0" />
      <path d="M14 10h3M14 14h3" />
    </Icon>
  );
}

/** WhatsApp: o balão de conversa. */
export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20l1.2-4A8 8 0 1 1 8 18.8L4 20Z" />
      <path d="M9 11h.01M12 11h.01M15 11h.01" />
    </Icon>
  );
}

/** Integrações: dois blocos ligados. */
export function IntegrationsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 3h7v7H3z" />
      <path d="M14 14h7v7h-7z" />
      <path d="M10 6.5h4v7.5" />
    </Icon>
  );
}

/** Menos: o par do PlusIcon num stepper. */
export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

/** Foto: o quadro com o morro e o sol, que é o desenho que todo mundo lê. */
export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5-6 6-2-2-5 5" />
    </Icon>
  );
}

/* --- tema ----------------------------------------------------------------- */

/*
 * Sol e lua vieram de `theme/ThemeToggle.tsx`, onde estavam desenhados
 * DENTRO da tela — o começo de um segundo conjunto, que é o que a §11 proíbe.
 * Lá eles ainda usavam `strokeWidth="2"`, o traço da direção anterior: ao
 * lado de qualquer ícone da barra do topo, o do tema aparecia mais gordo.
 * Aqui herdam o traço 1,5 de `<Icon>` como todos os outros.
 */

/** Sol: o tema claro. */
export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

/** Lua: o tema escuro. */
export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </Icon>
  );
}
