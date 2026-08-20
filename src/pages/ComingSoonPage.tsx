import { PageBar } from '../ds/PageBar';
import './ComingSoonPage.css';

/**
 * A tela de uma seção que ainda não foi construída.
 *
 * O CONTRATO: título e uma frase do que a tela vai fazer. Nada mais.
 *
 * Sem botão que não leva a lugar nenhum, sem número de exemplo, sem barra de
 * progresso e sem "80% pronto". Um botão falso custa um clique e a confiança
 * de quem clicou; um número de exemplo é pior, porque o lojista pode acreditar
 * nele. A frase honesta é a coisa mais útil que esta tela tem para dar.
 *
 * A etiqueta "em breve" não repete o que a lateral já mostra: aqui ela é o que
 * responde "então esta tela existe?" para quem chegou pelo endereço direto.
 */
export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="soon" data-testid="coming-soon">
      {/*
        A MESMA FAIXA DE 52px DE TODAS AS TELAS, e é ela que faz esta tela
        PERTENCER ao painel em vez de parecer um erro de rota. A etiqueta fica
        ao lado do título, onde ela responde "então esta tela existe?" para quem
        chegou pelo endereço direto — e não repete o que a lateral já mostra.
      */}
      <PageBar title={title} aside={<span className="tag">Em breve</span>} />

      <div className="soon__block">
        <p className="soon__text">{description}</p>
      </div>
    </div>
  );
}
