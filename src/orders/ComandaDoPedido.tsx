import { linhaDaComanda } from '../print-sectors/print-agent';
import { agruparVias, avisoDeVias, destinoDaVia, rotuloDeCopias } from './print-jobs';
import { useOrderPrintJobs } from './useOrderPrintJobs';

/**
 * ============================================================================
 * A COMANDA DESTE PEDIDO — o que sai no papel, no detalhe do pedido
 * ============================================================================
 *
 * O CHAMADO QUE ELA FECHA. "A comanda não saiu" é a ligação mais comum do
 * suporte, e até aqui a única resposta possível era pedir para o lojista olhar
 * a impressora. Este bloco responde a metade que o painel SABE: o que o backend
 * mandou imprimir, para qual setor, quantas vias, com que texto.
 *
 * ----------------------------------------------------------------------------
 * O QUE ELE NÃO DIZ, E NÃO PODE DIZER
 * ----------------------------------------------------------------------------
 *
 * **Ele não diz "a comanda saiu".** A rota não marca nada como impresso — de
 * propósito, porque reimprimir é a operação mais comum do balcão e por isso ela
 * é um GET repetível. Não existe histórico de impressão em lugar nenhum da API;
 * o agente grava log num arquivo local, ao lado do próprio `.exe`.
 *
 * Se este bloco escrevesse "impressa", ele estaria afirmando o que ninguém
 * conferiu — e o lojista pararia de procurar o defeito exatamente quando a
 * comanda não saiu. Por isso o cabeçalho diz **o que sai**, no presente, e o
 * rodapé manda para Loja › Impressão, que é onde se vê se o programa está no
 * ar. As duas metades da pergunta ficam ligadas sem nenhuma delas mentir.
 *
 * **Ele também não reimprime.** A única ordem que o contrato aceita é
 * `print_test`; reimprimir a comanda de um pedido é outra coisa e não existe.
 * Um botão "Reimprimir" aqui seria o tipo de botão que a skill da API existe
 * para impedir: compila, monta, chama e toma 404 na mão do lojista.
 *
 * ----------------------------------------------------------------------------
 * POR QUE ELE NASCE FECHADO
 * ----------------------------------------------------------------------------
 *
 * O detalhe abre a cada clique na lista, e no pico o lojista percorre dezenas
 * de pedidos em minutos. Aberto por padrão, este bloco custaria uma requisição
 * por pedido e empurraria Pagamento e Histórico para baixo da dobra — para um
 * dado que se consulta quando a impressora deu problema.
 *
 * O botão fechado é uma linha; ele diz o que vai aparecer, e é o suficiente
 * para o lojista saber que a informação existe. Ver `useOrderPrintJobs`.
 *
 * ----------------------------------------------------------------------------
 * A LARGURA FIXA É A CONDIÇÃO DE O CONTEÚDO SER VERDADEIRO
 * ----------------------------------------------------------------------------
 *
 * `content` vem do backend JÁ QUEBRADO em `columns` caracteres, com o
 * alinhamento feito com espaços — é literalmente o que a bobina recebe. Numa
 * fonte de largura variável ele desalinha, e a prévia passa a mostrar uma
 * comanda diferente da que sai. É o único uso de mono do painel, e o token
 * `--font-comanda` (em `tokens.css`) carrega o teste para um segundo.
 */
export function ComandaDoPedido({
  orderId,
  branchId,
  paymentStatus,
}: {
  orderId: string;
  /**
   * A filial DO PEDIDO, e não a do seletor do topo: quem imprime é o computador
   * daquela loja. Com "todas as filiais" escolhidas, o seletor não diz qual é.
   */
  branchId: string;
  /**
   * O `payment_status` cru, não um booleano.
   *
   * Só a via do cliente tem duas causas com a mesma aparência, e quem separa as
   * duas é a mesma regra que libera a Cozinha. Ver `avisoDeVias`.
   */
  paymentStatus: string;
}) {
  const { vias, agente, isLoading, errorMessage, aberto, abrir, fechar } = useOrderPrintJobs(
    orderId,
    branchId,
  );

  return (
    <section className="detail__block">
      <h3 className="detail__heading">Comanda</h3>

      {!aberto ? (
        <>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={abrir}
            data-testid="comanda-abrir"
          >
            Ver o que sai no papel
          </button>
          {/*
            A LINHA DE APOIO DIZ O QUE O CLIQUE ENTREGA, e não um endereço.

            Ela dizia: "se o papel não saiu, confira o programa em Loja ›
            Impressão". Estava correta e era um recado para ir buscar a resposta
            noutra tela — escrito na tela onde a resposta cabia, e endereçada a
            uma seção de configuração que só abre quem JÁ desconfia. Hoje o
            clique traz as duas metades da resposta: o que foi mandado imprimir
            e como está a máquina que imprime.
          */}
          <p className="detail__cliente-historico">
            O painel mostra o que o sistema mandou imprimir, e como está o programa que imprime.
          </p>
        </>
      ) : null}

      {aberto && isLoading ? <p className="muted">Carregando a comanda…</p> : null}

      {aberto && errorMessage ? (
        /*
          O ERRO APARECE, ao contrário do histórico do cliente: aqui o lojista
          APERTOU um botão, e um botão que não faz nada é justamente o defeito
          que ele veio investigar.
        */
        <p className="alert alert--error" role="alert" data-testid="comanda-erro">
          {errorMessage}
        </p>
      ) : null}

      {aberto && vias && !isLoading ? (
        <>
          {/*
            O ESTADO DO PROGRAMA, EM PRIMEIRO LUGAR — antes do papel.

            Quem abriu isto quer saber se a comanda saiu. As vias respondem o
            que foi MANDADO; esta linha responde se havia máquina para receber,
            que é a metade que faltava e que mandava o lojista para outra tela.
          */}
          <p className="detail__cliente-historico" data-testid="comanda-programa">
            {linhaDaComanda(agente)}
          </p>
          <ComandaCarregada jobs={vias.jobs} paymentStatus={paymentStatus} onFechar={fechar} />
        </>
      ) : null}
    </section>
  );
}

function ComandaCarregada({
  jobs,
  paymentStatus,
  onFechar,
}: {
  jobs: Parameters<typeof agruparVias>[0];
  paymentStatus: string;
  onFechar: () => void;
}) {
  const aviso = avisoDeVias(jobs, paymentStatus);
  const grupos = agruparVias(jobs);

  return (
    <>
      {/*
        O AVISO VEM ANTES DAS VIAS, porque nos dois casos que ele cobre ele É a
        resposta: com a lista vazia não há via nenhuma abaixo dele, e com só a
        do cliente ele explica a que falta. Depois da lista, ele seria a
        explicação de uma ausência que o olho já leu como defeito.
      */}
      {aviso ? (
        <p className={`alert alert--${aviso.tom}`} data-testid="comanda-aviso">
          {aviso.texto}
        </p>
      ) : null}

      {grupos.map((via) => (
        <article key={via.key} className="comanda" data-testid="comanda-via">
          <div className="comanda__cabeca">
            <span className="comanda__destino">{destinoDaVia(via)}</span>
            {/*
              A CONTAGEM É A INFORMAÇÃO, e por isso ela é sempre escrita — até
              quando é uma. "1 via" ao lado de "2 vias" no pedido seguinte é o
              que faz a diferença ser lida; a etiqueta que só aparece no plural
              obriga a reparar na ausência dela.
            */}
            <span className="comanda__copias">{rotuloDeCopias(via.copias)}</span>
          </div>
          {/*
            `<pre>` e não `<div>` com quebras: o texto JÁ vem quebrado em
            `columns` caracteres. Deixar o navegador reembrulhar destruiria o
            alinhamento por espaços, que é o que a bobina imprime.
          */}
          <pre className="comanda__papel">{via.content}</pre>
        </article>
      ))}

      <button type="button" className="btn btn--sm btn--ghost" onClick={onFechar}>
        Esconder a comanda
      </button>
    </>
  );
}
