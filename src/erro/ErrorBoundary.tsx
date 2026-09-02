import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErroDaTela } from './ErroDaTela';

type EstadoDaBorda = {
  /** Houve erro. Ver o comentário de `getDerivedStateFromError`. */
  capturou: boolean;
  error: unknown;
  componentStack: string | null;
};

/**
 * ============================================================================
 * A BORDA DE ERRO — a rede de segurança que o painel não tinha
 * ============================================================================
 *
 * Não existia nenhuma. Qualquer exceção de render — um campo que o backend
 * passou a mandar `null`, um `.map` em `undefined` — apagava a tela inteira:
 * branco, mudo, sem "recarregar" e sem nada chegando ao suporte. No sábado, no
 * celular, no meio do movimento. E não havia teste da tela branca porque não
 * havia código: é por isso que ninguém tinha reparado.
 *
 * ELA É CLASSE PORQUE O REACT NÃO OFERECE OUTRA COISA. `componentDidCatch` e
 * `getDerivedStateFromError` não têm equivalente em hook — não é escolha de
 * estilo, é a única forma que existe.
 *
 * ----------------------------------------------------------------------------
 * O QUE ELA PEGA, E O QUE ELA NÃO PEGA
 * ----------------------------------------------------------------------------
 *
 * Pega: exceção durante o render, nos métodos de ciclo de vida e nos
 * construtores da árvore ABAIXO dela.
 *
 * NÃO pega: erro dentro de manipulador de evento (o `onClick` que quebra),
 * erro em código assíncrono (`setTimeout`, `.then`) e erro no render do
 * próprio fallback. Os dois primeiros já têm dono neste painel — toda chamada
 * de API passa por `try/catch` e vira mensagem na tela. O terceiro é a razão de
 * `ErroDaTela` não ler nada da sessão, do roteador ou da API para se desenhar:
 * um fallback que quebra é a tela branca de volta, agora sem saída nenhuma.
 *
 * ----------------------------------------------------------------------------
 * ELA É MONTADA DUAS VEZES, E SÃO DOIS TRABALHOS DIFERENTES
 * ----------------------------------------------------------------------------
 *
 * **Na raiz** (`main.tsx`), envolvendo o painel inteiro: é a que pega o que
 * quebra no roteador, na sessão e na moldura. O painel some, e o que fica é a
 * tela de erro.
 *
 * **Dentro do `AppShell`**, envolvendo só o conteúdo da rota: um defeito no
 * Cardápio deixa a lateral, a barra e as outras oito seções DE PÉ. A pessoa
 * navega para outro lugar e continua trabalhando, em vez de perder o painel
 * por causa de uma tela. Lá ela leva `key={pathname}`, que é o que a faz
 * esquecer o erro ao trocar de rota — sem isso, o React mantém o estado de
 * erro e a tela seguinte nasceria quebrada também.
 */
export class ErrorBoundary extends Component<
  {
    children: ReactNode;
    /**
     * `'tela'` desenha o erro dentro da moldura (a lateral continua lá);
     * `'painel'` desenha a página inteira. É só apresentação: o que a borda
     * FAZ é o mesmo nos dois.
     */
    escopo: 'painel' | 'tela';
  },
  EstadoDaBorda
> {
  state: EstadoDaBorda = { capturou: false, error: null, componentStack: null };

  /*
   * O SINALIZADOR É SEPARADO DO ERRO, e não `error !== null`.
   *
   * `throw null` e `throw undefined` existem — código de terceiro faz isso — e
   * chegam aqui como `null`. Com "capturou" deduzido do erro, esses dois casos
   * fariam a borda desenhar os FILHOS de novo no render seguinte, que voltariam
   * a lançar: a tela branca de volta, agora piscando.
   *
   * E o erro é guardado, e não só o fato de ter havido um: sem ele não há o que
   * mandar no relato, e relato sem log é a mesma ligação para o suporte que já
   * existia.
   */
  static getDerivedStateFromError(error: unknown): Partial<EstadoDaBorda> {
    return { capturou: true, error };
  }

  componentDidCatch(_error: unknown, info: ErrorInfo) {
    // A pilha de COMPONENTES é o que diz em que tela o erro nasceu; a pilha de
    // JavaScript, minificada, diz muito menos. Ela vem só aqui — o
    // `getDerivedStateFromError` não a recebe.
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (!this.state.capturou) return this.props.children;

    return (
      <ErroDaTela
        error={this.state.error}
        componentStack={this.state.componentStack}
        escopo={this.props.escopo}
      />
    );
  }
}
