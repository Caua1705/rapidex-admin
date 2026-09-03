/**
 * ============================================================================
 * O ACESSO DO ENTREGADOR — o par que sai uma vez só
 * ============================================================================
 *
 * `POST /admin/couriers/{id}/access` devolve `link_token` e `access_code` em
 * claro, e essa é a ÚNICA vez que os dois existem fora do hash. Não há rota que
 * os mostre de novo, e isso é propriedade e não limitação — a mesma forma da
 * senha temporária de Usuários.
 *
 * Gerar de novo MATA o par anterior na hora: não há sessão nem token derivado
 * que sobreviva. É o botão de "o motoboy saiu ou perdeu o celular", e por isso
 * ele pergunta antes quando já existe um acesso valendo.
 *
 * ----------------------------------------------------------------------------
 * O DOMÍNIO DO APP NÃO TEM PADRÃO, E ISSO É A PROTEÇÃO
 * ----------------------------------------------------------------------------
 *
 * `VITE_COURIER_APP_URL` fica no `.env.example` SEM valor. Faltando ela, o
 * painel não oferece o botão — porque a alternativa é gerar um link para um
 * domínio errado, e o par sai uma vez só: o motoboy receberia algo que não
 * abre, e a segunda via mata a primeira.
 *
 * Um padrão embutido aqui seria exatamente o defeito que a ausência da variável
 * existe para impedir, e ele apareceria em produção, uma vez, no dia do
 * primeiro entregador.
 */
import { phoneDigits } from '../customers/customer-model';

/** O caminho da tela do entregador dentro do app do cliente. */
const CAMINHO_DO_ENTREGADOR = 'entregador';

/**
 * O endereço que o motoboy abre, ou `null` quando não há domínio configurado.
 *
 * O token é CODIFICADO: ele entra num segmento de caminho, e um caractere de
 * barra nele partiria a URL em duas — o link chegaria quebrado e a segunda via
 * mata a primeira.
 */
export function linkDoEntregador(appUrl: string | undefined, linkToken: string): string | null {
  const base = (appUrl ?? '').trim().replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/${CAMINHO_DO_ENTREGADOR}/${encodeURIComponent(linkToken)}`;
}

/** O botão só existe onde o link pode existir. Ver o cabeçalho. */
export function podeGerarAcesso(appUrl: string | undefined): boolean {
  return Boolean((appUrl ?? '').trim());
}

/**
 * A MENSAGEM PRONTA — e ela leva o par INTEIRO.
 *
 * Link sem código não entra, e código sem link não tem onde ser digitado.
 * Mandar um de cada vez é o que produz a ligação de volta ("chegou só o
 * endereço"), e o par já não existe para reenviar a metade que faltou.
 *
 * ELA DIZ DE QUAL LOJA É porque quem entrega costuma servir mais de uma, e um
 * link solto no WhatsApp, no meio do turno, não se distingue de outro.
 */
export function mensagemDoAcesso({
  nomeDaLoja,
  link,
  codigo,
}: {
  nomeDaLoja: string;
  link: string;
  codigo: string;
}): string {
  return [
    `Seu acesso de entregador na ${nomeDaLoja}:`,
    '',
    link,
    `Código: ${codigo}`,
    '',
    'O código é pedido uma vez só, no primeiro acesso. Depois o aplicativo guarda.',
  ].join('\n');
}

/**
 * O link do WhatsApp — e ele é SÓ um link.
 *
 * `wa.me` com o telefone e o texto na querystring. Sem API, sem Business
 * Manager, sem token: é por isso que este botão existe hoje, enquanto a
 * integração de WhatsApp do painel inteiro ainda é "em breve". O que ele faz é
 * abrir a conversa com a mensagem digitada — quem aperta enviar é o lojista.
 *
 * O 55 É ACRESCENTADO E NÃO DUPLICADO. `phoneDigits` já tira o código do país
 * quando ele veio junto (a mesma função que a tela de Clientes usa), então aqui
 * o número volta sempre no formato local antes de receber o país.
 */
export function urlDoWhatsApp(telefone: string, mensagem: string): string {
  const local = phoneDigits(telefone);
  return `https://wa.me/55${local}?text=${encodeURIComponent(mensagem)}`;
}
