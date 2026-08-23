import { useSession } from '../auth/session-context';
import { establishmentOf } from '../auth/restaurant-label';

/**
 * ============================================================================
 * QUEM ESTÁ SENDO OPERADO — a identificação do estabelecimento no shell
 * ============================================================================
 *
 * O painel mostrava a marca do Rapidex e o seletor de filial, e em lugar
 * nenhum dizia de QUAL cliente era aquela operação. Com um restaurante isso é
 * óbvio; com dez, quem administra mais de um abre o painel e não sabe onde
 * está.
 *
 * A MARCA DO RAPIDEX CONTINUA, e acima desta. O painel não é white-label — é a
 * nossa ferramenta, e quem opera precisa saber que o suporte é do Rapidex.
 * Quem é white-label é o app do cliente final. Por isso são duas coisas
 * empilhadas, e não uma no lugar da outra.
 *
 * ----------------------------------------------------------------------------
 * O LADRILHO É O LUGAR DA LOGO, E ELE ESTÁ VAZIO POR FALTA DE ROTA
 * ----------------------------------------------------------------------------
 *
 * `restaurants.logo_path` existe no banco e `logo_url` já é servido — mas só na
 * API pública da vitrine. O NOME já veio para `/admin` (`GET /admin/restaurant`,
 * ver `auth/restaurant-label.ts`); a logo ainda não. Enquanto ela não sair, o
 * ladrilho leva as INICIAIS do nome.
 *
 * Iniciais não são um logo de mentira: elas não imitam marca nenhuma, saem do
 * texto que já está ali ao lado e desaparecem sozinhas no dia em que houver
 * imagem — este `<span>` vira um `<img>` e nada mais muda.
 *
 * ELE NÃO É REDONDO, e a diferença é proposital: redondo é PESSOA (o avatar da
 * conta, na mesma barra), quadrado com canto é LUGAR. Dois círculos com duas
 * iniciais na mesma tela seriam duas contas.
 *
 * ----------------------------------------------------------------------------
 * DUAS FORMAS, PELA MESMA REGRA DO SHELL: A INFORMAÇÃO TROCA DE LUGAR
 * ----------------------------------------------------------------------------
 *
 *   `lateral`  ≥768px — embaixo da marca, na navegação. Na trilha de ícones
 *              (768–1179) sobra o ladrilho, e o nome vive no leitor de tela.
 *   `barra`    <768px — não há lateral, então ela vai para a barra do topo, no
 *              grupo da CONTA (à direita), e não ao lado do seletor de filial.
 *
 * O LADO IMPORTA. À esquerda da barra mora o RECORTE (que loja esta tela está
 * mostrando); à direita, QUEM ESTÁ ALI (a conta, o tema, o sair). A
 * identificação do cliente é a segunda pergunta, não a primeira — e encostá-la
 * no seletor traria de volta um defeito que este painel já teve: o nome da
 * filial principal escrito logo acima de "Todas as filiais (2)", duas
 * afirmações opostas na mesma esquina (ver `layout/branch-heading.ts`).
 */
export function EstablishmentBadge({ variant = 'lateral' }: { variant?: 'lateral' | 'barra' }) {
  const { restaurant, branches } = useSession();
  const estabelecimento = establishmentOf(restaurant, branches);

  /*
   * Sem perfil ainda — a sessão está carregando. O bloco não é desenhado: um
   * travessão piscando embaixo da marca lê como defeito, e o nome chega meio
   * segundo depois de qualquer jeito.
   */
  if (!estabelecimento) return null;

  /*
   * A CONTAGEM SÓ APARECE QUANDO É MAIOR QUE UM. Ela dizia sozinha que o bloco
   * era sobre o CONJUNTO, num tempo em que o rótulo era o nome de uma filial e
   * podia ser lido como uma das lojas. Hoje o nome é o da casa e não sugere
   * mais isso; a contagem fica porque continua sendo a informação que falta —
   * quantas lojas este lojista alcança.
   *
   * "1 loja" não seria dito: para quem está preso a uma filial, o painel não
   * sabe quantas o restaurante tem, e afirmar uma seria afirmar o que ele não
   * viu.
   */
  const detalhe = [
    estabelecimento.city,
    estabelecimento.branchCount > 1 ? `${estabelecimento.branchCount} lojas` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`estab estab--${variant}`} data-testid={`estab-${variant}`}>
      <span className="estab__marca" aria-hidden="true">
        {estabelecimento.initials}
      </span>

      <span className="estab__texto">
        {/*
          O leitor de tela precisa saber o que este nome é — solto entre a
          marca e a navegação, ele poderia ser qualquer coisa. Na trilha de
          ícones esta é a única parte que sobra, e é o que faz o ladrilho
          continuar dizendo algo para quem não o vê.
        */}
        <span className="sr-only">Estabelecimento: </span>
        {/*
          O `title` repete o nome porque a lateral tem 160px e o CSS corta com
          reticências. Ele não guarda mais um texto DIFERENTE do que se lê: o
          nome vem inteiro de `restaurants.name` e nada é cortado antes de
          chegar aqui.
        */}
        <span className="estab__nome" title={estabelecimento.label}>
          {estabelecimento.label}
        </span>
        {detalhe ? <span className="estab__detalhe">{detalhe}</span> : null}
      </span>
    </div>
  );
}
