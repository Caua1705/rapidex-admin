import { Link } from 'react-router-dom';

import './PrototipoIndex.css';

/**
 * A porta de entrada dos protótipos. Um parágrafo por direção, o que ela
 * aposta e o que ela cobra — o resto é para olhar, não para ler.
 */
const DIRECOES = [
  {
    letra: 'a',
    nome: 'Refinada',
    aposta: 'Pedido é linha, não cartão. Sete colunas alinhadas, tipografia fazendo a hierarquia.',
    cobra: 'Nenhuma cor de longe, e o laranja da marca não aparece.',
  },
  {
    letra: 'b',
    nome: 'App',
    aposta: 'Estágio é lugar: uma coluna por estágio, ícone de moto e de pé, laranja no que fazer.',
    cobra: 'Quatro pedidos por coluna na tela; no pico, rola.',
  },
  {
    letra: 'c',
    nome: 'Console',
    aposta: 'A tela inteira é a lista: escuro, topo de 46px, três colunas de linhas de 40px.',
    cobra: 'Quem nunca viu não entende sozinho.',
  },
] as const;

export function PrototipoIndex() {
  return (
    <div className="proto-index">
      <div className="proto-index__miolo">
        <p className="proto-index__aviso">
          Protótipo de decisão · dados de exemplo · a tela real de Pedidos não foi tocada
        </p>
        <h1>Três direções para Pedidos</h1>
        <p className="proto-index__sub">
          As três resolvem os mesmos três problemas — preâmbulo antes da operação, filtro dentro de
          cartão, agrupamento vazio gastando altura. O que muda é como.
        </p>

        <ul className="proto-index__lista">
          {DIRECOES.map((direcao) => (
            <li key={direcao.letra}>
              <Link to={`/prototipo/pedidos/${direcao.letra}`} data-d={direcao.letra}>
                <span className="proto-index__letra">{direcao.letra.toUpperCase()}</span>
                <span className="proto-index__texto">
                  <strong>{direcao.nome}</strong>
                  <span>{direcao.aposta}</span>
                  <small>Sacrifica: {direcao.cobra}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="proto-index__volta">
          <Link to="/pedidos">← voltar para a tela real de Pedidos</Link>
        </p>
      </div>
    </div>
  );
}
