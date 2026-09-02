/**
 * ============================================================================
 * QUANDO O "AO VIVO" DEIXA DE SER VERDADE
 * ============================================================================
 *
 * `useOrderStream` só sabia dois fatos sobre a conexão: ela abriu (`onopen`) e
 * ela quebrou (`onerror`). Entre os dois, a etiqueta dizia **ao vivo** para
 * sempre — e o buraco que sobrava é o pior tipo de defeito desta rodada:
 * conexão ABERTA que parou de entregar. Proxy que bufferiza, rede de operadora
 * que segura o socket, worker travado do outro lado. O `onerror` nunca dispara,
 * nenhum pedido aparece, e o painel fica ATIVAMENTE tranquilizando o lojista
 * enquanto o telefone toca.
 *
 * ----------------------------------------------------------------------------
 * O `: ping` NÃO SERVE, E É A PRIMEIRA IDEIA QUE VEM
 * ----------------------------------------------------------------------------
 *
 * O backend manda um comentário SSE a cada 20 segundos
 * (`HEARTBEAT_INTERVAL_SECONDS`) exatamente para o proxy não derrubar a conexão
 * ociosa. Ele mantém o socket vivo e **não chega ao JavaScript**: comentário SSE
 * não vira evento no `EventSource`, e não existe callback para ele. Contar
 * batidas, que seria o desenho óbvio, é impossível daqui.
 *
 * ----------------------------------------------------------------------------
 * O SINAL DE VIDA É A REABERTURA, NÃO O EVENTO
 * ----------------------------------------------------------------------------
 *
 * O que dá para observar é outra coisa, e ela é uma GARANTIA do backend: toda
 * conexão morre sozinha em `MAX_STREAM_SECONDS` = 900 (fechar e reabrir de
 * propósito evita conexão zumbi acumulando no worker). Uma conexão saudável,
 * portanto, produz um `onopen` **a cada quinze minutos**, tenha entrado pedido
 * ou não — e uma madrugada de domingo sem nenhuma venda é indistinguível de um
 * sábado cheio para esta conta.
 *
 * Então o relógio não mede "há quanto tempo não entra pedido". Mede **há quanto
 * tempo o painel não recebe NADA do servidor** — evento ou reabertura —, e o
 * limite sai do teto do backend, não de um palpite sobre o movimento da loja.
 *
 * ESTES DOIS NÚMEROS SÃO ESPELHO DECLARADO. Nenhum dos dois está no
 * `/openapi.json`: são constantes de `admin_order_stream_service.py`. Ficam
 * aqui, juntos, com a origem escrita — e o estrago máximo de eles divergirem é
 * conhecido: se o backend BAIXAR o teto, o painel demora mais a acusar; se
 * SUBIR acima de 20 minutos, o painel acusa um ciclo normal como parado. A
 * segunda é a ruim, e é a que este comentário existe para a próxima pessoa
 * lembrar de conferir.
 */

/** `MAX_STREAM_SECONDS` do backend: toda conexão é fechada aos 15 minutos. */
export const TETO_DA_CONEXAO_MS = 900_000;

/**
 * Vinte minutos: o teto do backend mais cinco de folga.
 *
 * A FOLGA NÃO É ARREDONDAMENTO — ela precisa caber uma reabertura inteira que
 * deu trabalho: o POST do ticket de 30s, a conexão nova, e a espera crescente
 * (1s, 2s, 4s…) se a primeira tentativa falhar. Sem ela, um painel perfeitamente
 * saudável numa rede ruim piscaria "sem sinal" a cada quarto de hora, e a
 * etiqueta viraria ruído — que é o mesmo jeito de perder um aviso que ter aviso
 * nenhum.
 *
 * E ela é generosa DE PROPÓSITO, para o erro cair do lado barato: acusar tarde
 * um stream morto custa alguns minutos de lista velha, com a recarga logo
 * atrás; acusar cedo um stream vivo ensina o lojista a ignorar a etiqueta.
 */
export const LIMITE_DE_SILENCIO_MS = 1_200_000;

/**
 * O painel está há tempo demais sem receber nada do servidor?
 *
 * `ultimoSinalMs` é o instante do último `onopen` OU do último evento — o que
 * veio por último. `null` é "ainda não houve nenhum", e é o caso que precisa de
 * guarda explícita: sem ela, `agora - null` é `agora - 0` e todo painel abriria
 * afirmando que o tempo real está parado desde 1970.
 */
export function fluxoParado(ultimoSinalMs: number | null, agoraMs: number): boolean {
  if (ultimoSinalMs === null) return false;
  return agoraMs - ultimoSinalMs > LIMITE_DE_SILENCIO_MS;
}

/**
 * De quanto em quanto tempo o relógio se pergunta se o silêncio já é demais.
 *
 * Um minuto para um limite de vinte: mais fino não responderia nada diferente e
 * acordaria a tela sessenta vezes mais, num painel que fica aberto o turno
 * inteiro num tablet de balcão.
 */
export const PASSO_DO_RELOGIO_MS = 60_000;
