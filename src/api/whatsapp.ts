/**
 * Chamadas da tela de WhatsApp.
 *
 * TRÊS ROTAS:
 *
 *   GET    /admin/whatsapp/channels               GERENCIA      o mapa da rede
 *   POST   /admin/whatsapp/channels               SOMENTE_DONO  conecta (e reconecta)
 *   DELETE /admin/whatsapp/channels/{channel_id}  SOMENTE_DONO  desliga
 *
 * LER É GERENCIA e ESCREVER É SOMENTE_DONO, e o router do backend explica a
 * divisão melhor que um resumo: conectar é colar no banco uma CREDENCIAL da
 * Business Manager do lojista, e o que ela habilita é a plataforma mandando
 * mensagem no WhatsApp da loja, em nome dele. Desconectar é o outro lado da
 * mesma moeda — com o canal fora, o cliente para de ser avisado e NADA quebra:
 * nenhum erro, nenhuma tela vermelha, só pedido seguindo em silêncio. Estrago
 * silencioso pede a senha que menos circula. Ler é da gerência porque é o
 * gerente quem responde ao cliente que diz não ter recebido o aviso.
 *
 * O `DELETE` DEVOLVE 200 COM O CANAL, e não 204 — por isso ele passa por
 * `unwrap` e não por `unwrapEmpty`. A linha NÃO é apagada: `is_active` vira
 * falso. `whatsapp_messages.channel_id` é FK sem `ON DELETE` de propósito, e
 * apagar o canal apagaria o registro de que o cliente foi avisado — o único
 * lugar onde isso é visível depois.
 */
import { apiClient, unwrap } from './client';
import type { WhatsAppChannel, WhatsAppChannelCreate, WhatsAppChannels } from './types';

/**
 * Os números conectados, e por qual deles cada loja fala.
 *
 * SEM RECORTE DE FILIAL, e é decisão: a rota aceita `branch_id`, e o próprio
 * contrato diz que a forma sem ele "é a principal, porque o dono precisa do
 * MAPA, não de uma loja por vez". Esta tela é sobre HERANÇA — quem tem número
 * próprio e quem cai no do restaurante —, e uma loja por vez é justamente a
 * pergunta que ela não responde.
 *
 * Não há escopo a proteger na ausência do filtro: `resolve_branch_filter` já
 * recorta pelo token, então quem está preso a uma filial recebe só a dele
 * (skill `rapidex-api` §4.3).
 */
export async function listWhatsAppChannels(): Promise<WhatsAppChannels> {
  return unwrap(await apiClient.GET('/admin/whatsapp/channels'));
}

/**
 * Conecta um número. `branch_id` nulo é a linha do RESTAURANTE.
 *
 * CONECTAR O MESMO `phone_number_id` DE NOVO É RECONECTAR: troca o token,
 * religa o canal e limpa a desconexão. É o caminho da rotação de token e o da
 * volta depois de um `DELETE` — sem ele, desconectar seria irreversível pelo
 * painel.
 *
 * AS TRÊS COLISÕES RESPONDEM 409 COM FRASE, e as três pedem coisas diferentes
 * do lojista: número de outro restaurante (a frase não diz de quem ele é),
 * número que já é de outra filial sua (a frase nomeia a filial), e lugar
 * ocupado (a frase diz por qual número aquele lugar fala hoje). O `detail` é
 * string nos três casos, então `messageFromUnknownError` já as mostra.
 */
export async function connectWhatsAppChannel(
  body: WhatsAppChannelCreate,
): Promise<WhatsAppChannel> {
  return unwrap(await apiClient.POST('/admin/whatsapp/channels', { body }));
}

/**
 * Desliga o canal, e devolve a LINHA como ela ficou.
 *
 * O que muda na hora: nenhum aviso sai por ele a partir do commit. E a filial
 * que falava por um número PRÓPRIO desligado **não cai** no do restaurante — o
 * que se espera de um número desligado é que aquela loja pare de mandar.
 */
export async function disconnectWhatsAppChannel(channelId: string): Promise<WhatsAppChannel> {
  return unwrap(
    await apiClient.DELETE('/admin/whatsapp/channels/{channel_id}', {
      params: { path: { channel_id: channelId } },
    }),
  );
}
