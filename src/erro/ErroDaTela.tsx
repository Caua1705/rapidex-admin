import { useState } from 'react';

import { createErrorReport } from '../api/error-reports';
import { messageFromUnknownError } from '../api/errors';
import { copiarTexto } from '../ds/copiar';
import { checkDescricao, montarLog, nomeDaTela, DESCRICAO_MAX } from './error-report';
import './ErroDaTela.css';

/**
 * O que o lojista vê quando uma tela quebra — e por onde o suporte fica sabendo.
 *
 * ============================================================================
 * ELA NÃO LÊ NADA QUE POSSA ESTAR QUEBRADO
 * ============================================================================
 *
 * Sem `useSession`, sem `useNavigate`, sem hook de dado nenhum. **Um fallback
 * que quebra é a tela branca de volta, agora sem saída** — e o que acabou de
 * quebrar pode ter sido justamente o provider que ela iria consultar.
 *
 * Pela mesma razão as duas saídas são `window.location`, e não o roteador: se
 * o que quebrou foi o `BrowserRouter`, um `<Link>` aqui seria um link morto na
 * única tela que precisava funcionar.
 *
 * ============================================================================
 * O RELATO É O PONTO, NÃO A DESCULPA
 * ============================================================================
 *
 * "Algo deu errado" com um botão de recarregar é o que quase todo painel faz, e
 * é metade do trabalho: a pessoa recarrega, o erro some da tela e some do
 * mundo. `POST /admin/error-reports` está pronto no backend desde antes desta
 * rodada e nunca tinha sido chamado.
 *
 * O QUE VAI JUNTO SEM NINGUÉM DIGITAR: o log (mensagem, pilha e a árvore de
 * componentes) e a tela (o caminho da URL). O que a pessoa escreve é só a
 * história — "cliquei em salvar e sumiu tudo" —, e é ela que transforma um
 * traceback numa pergunta respondível.
 *
 * E QUANDO O ENVIO FALHA — é o painel quebrado, a internet pode ter caído
 * junto — a tela não engole: mostra o log em texto copiável para a pessoa
 * colar no WhatsApp do suporte. É o pior caso, e continua melhor que branco.
 */
export function ErroDaTela({
  error,
  componentStack,
  escopo,
}: {
  error: unknown;
  componentStack: string | null;
  escopo: 'painel' | 'tela';
}) {
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [falhaDoEnvio, setFalhaDoEnvio] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<'nada' | 'protocolo' | 'log'>('nada');

  /*
   * O LOG É MONTADO NO RENDER, e isso é barato e proposital: ele não depende de
   * estado nenhum, e guardá-lo em `useState` criaria uma segunda cópia que
   * poderia divergir da que vai no envio.
   */
  const log = montarLog(error, componentStack);
  const check = checkDescricao(descricao);

  async function enviar() {
    if (!check.valid) return;
    setEnviando(true);
    setFalhaDoEnvio(null);
    try {
      const relato = await createErrorReport({
        description: check.descricao,
        error_log: log,
        screen: nomeDaTela(window.location.pathname),
      });
      setProtocolo(relato.id);
    } catch (erro) {
      setFalhaDoEnvio(messageFromUnknownError(erro));
    } finally {
      setEnviando(false);
    }
  }

  async function copiar(valor: string, qual: 'protocolo' | 'log') {
    if (await copiarTexto(valor)) setCopiado(qual);
  }

  return (
    <div className={`erro erro--${escopo}`} role="alert" data-testid="erro-da-tela">
      <div className="erro__bloco">
        <h1 className="erro__titulo">
          {escopo === 'painel' ? 'O painel parou de funcionar' : 'Esta tela parou de funcionar'}
        </h1>

        {/*
          SEM EUFEMISMO E SEM CULPA. "Ops, algo deu errado!" faz a pessoa
          duvidar se foi ela que errou. O que ela precisa saber é: não foi você,
          nenhum pedido sumiu, e há o que fazer agora.
        */}
        <p className="erro__texto">
          O erro é do painel, não de alguma coisa que você fez — e nenhum pedido foi perdido por
          causa dele.{' '}
          {escopo === 'painel'
            ? 'Recarregar costuma resolver.'
            : 'As outras seções continuam funcionando.'}
        </p>

        <div className="erro__acoes">
          {/*
            `window.location` e não o roteador: se o que quebrou foi o
            roteador, um <Link> aqui seria um link morto.
          */}
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
            data-testid="erro-recarregar"
          >
            Recarregar a página
          </button>
          {escopo === 'tela' ? (
            <a className="btn" href="/pedidos" data-testid="erro-ir-para-pedidos">
              Ir para Pedidos
            </a>
          ) : null}
        </div>

        {protocolo ? (
          /*
            O NÚMERO DO RELATO. É o que a pessoa repete para o suporte, e por
            isso vem com "Copiar": um identificador longo, ditado por telefone no
            meio do movimento, chega errado — e um número errado é pior que
            nenhum, porque manda o suporte procurar.
          */
          <div className="erro__protocolo" data-testid="erro-protocolo">
            <p className="erro__texto">Relato enviado. Mande este número para o suporte:</p>
            <p className="erro__numero tnum">{protocolo}</p>
            <button
              type="button"
              className="btn"
              onClick={() => void copiar(protocolo, 'protocolo')}
            >
              {copiado === 'protocolo' ? 'Copiado' : 'Copiar o número'}
            </button>
            <span className="sr-only" role="status">
              {copiado === 'protocolo' ? 'Número do relato copiado.' : ''}
            </span>
          </div>
        ) : (
          <div className="erro__relato">
            <label className="field">
              <span className="field__label">O que você estava fazendo?</span>
              <textarea
                className="textarea"
                maxLength={DESCRICAO_MAX}
                placeholder="Ex.: cliquei em salvar o produto e a tela sumiu."
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                data-testid="erro-descricao"
              />
            </label>
            <p className="erro__ajuda faint">
              A mensagem técnica e a tela vão junto automaticamente — você não precisa copiar nada.
            </p>

            {falhaDoEnvio ? (
              /*
                O PIOR CASO, E ELE TEM SAÍDA. O painel quebrado pode ter levado
                a internet junto, ou a sessão caiu. Engolir o erro aqui deixaria
                a pessoa sem nada; o log copiável é o que ela cola no WhatsApp.
              */
              <div className="erro__falha" data-testid="erro-falha-do-envio">
                <p className="alert alert--error">Não deu para enviar o relato: {falhaDoEnvio}</p>
                <p className="erro__texto">Copie os detalhes abaixo e mande para o suporte:</p>
                <textarea className="textarea erro__log" readOnly value={log} rows={6} />
                <button type="button" className="btn" onClick={() => void copiar(log, 'log')}>
                  {copiado === 'log' ? 'Copiado' : 'Copiar os detalhes'}
                </button>
                <span className="sr-only" role="status">
                  {copiado === 'log' ? 'Detalhes copiados.' : ''}
                </span>
              </div>
            ) : null}

            <button
              type="button"
              className="btn"
              disabled={!check.valid || enviando}
              onClick={() => void enviar()}
              data-testid="erro-enviar"
            >
              {enviando ? 'Enviando…' : falhaDoEnvio ? 'Tentar enviar de novo' : 'Enviar relato'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
