import { Navigate, NavLink, useOutletContext } from 'react-router-dom';

import type { StoreOutletContext } from './StoreLayout';
import { useSectionListPage } from './useSectionListPage';

/**
 * O QUE `/loja` RENDERIZA — e ela renderiza coisas diferentes conforme a tela.
 *
 * NO DESKTOP, `/loja` NÃO É UMA TELA: é o nome do grupo de rotas. A coluna de
 * seções está permanentemente à vista ao lado do formulário, então uma página
 * dizendo "escolha uma seção" seria uma tela a mais para atravessar toda vez, ao
 * lado de uma lista que já está aberta. Ela redireciona para Operação — o
 * estado do dia, o que o lojista vem conferir com pressa no sábado à noite.
 *
 * NO TELEFONE, `/loja` É UMA TELA. Abaixo de 720px a coluna não cabe, e o que
 * havia no lugar dela era uma FITA horizontal de nove pastilhas que transbordava
 * 271px numa tela de 390 — nove alvos pequenos, alguns fora da tela, num gesto
 * de rolagem lateral que ninguém procura. Isto é Fitts na forma mais crua: alvo
 * pequeno e longe custa mais. A lista devolve nove linhas de 44px, todas na
 * tela, todas na altura do polegar.
 *
 * O TOQUE A MAIS QUE ISSO CUSTARIA JÁ ESTÁ PAGO. Trocar a fita pela lista põe
 * Operação a dois toques — e Operação é a ação de sábado à noite. Por isso a
 * barra de baixo passou a apontar direto para `/loja/operacao` em vez de para
 * `/loja`: a aba mais barata da tela carrega a ação mais urgente, e as outras
 * oito seções ficam atrás desta lista, que é o lugar certo para o que se
 * encosta uma vez.
 *
 * NÃO É UM SEGUNDO DESENHO DA COLUNA. É outro desenho, pelo mesmo motivo que a
 * linha compacta de pedido não é a linha larga dobrada: aqui não há seção
 * aberta para marcar, não há fio de 2px na margem, e o que a lista precisa é de
 * régua entre as linhas e alvo de dedo.
 */
export function StoreIndexPage() {
  const emPagina = useSectionListPage();
  const { secoes } = useOutletContext<StoreOutletContext>();

  if (!emPagina) return <Navigate to="operacao" replace />;

  return (
    <nav className="store__lista" aria-label="Todas as seções da loja">
      {secoes.map((secao) => (
        <NavLink
          key={secao.id}
          to={secao.id}
          className="store__lista-item"
          data-testid={`store-lista-${secao.id}`}
        >
          <span className="t-body store__lista-nome">{secao.titulo}</span>
          {/*
            A RESSALVA DE ESCOPO VEM JUNTO, e é o que esta lista tem de melhor
            que a fita: "vale para o restaurante inteiro" ao lado de Marca e de
            Geral, na hora de escolher, é a diferença entre editar o padrão da
            rede achando que se editava a filial. Na fita não cabia — uma
            pastilha de 12px não carrega uma frase.

            As de filial não escrevem nada aqui: a filial só é resolvida DENTRO
            da seção, e nomear a errada nesta lista seria pior que não nomear.
          */}
          {secao.nota ? <span className="t-aux store__lista-nota">{secao.nota}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}
