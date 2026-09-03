import { useState, type ReactNode } from 'react';

import { useAdoptedBranch } from '../auth/use-branch-scope';
import { messageFromUnknownError } from '../api/errors';
import { usePermissoes } from '../auth/use-permissions';
import { DataTable, PageBar, Tabs, type Column } from '../ds';
import { EditIcon, PlusIcon } from '../ds/icons';
import { formatPhone } from '../customers/customer-model';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { generateCourierAccess } from '../api/couriers';
import { useSession } from '../auth/session-context';
import { CourierAccessDialog } from './CourierAccessDialog';
import { CourierReportPage } from './CourierReportPage';
import { linkDoEntregador, podeGerarAcesso } from './courier-access';
import { CourierDialog } from './CourierDialog';
import {
  corpoDeCriacao,
  corpoDeEdicao,
  errosDoEntregador,
  rascunhoDe,
  RASCUNHO_NOVO,
  textoDoAcesso,
  type CourierDraft,
  type ErrosDoEntregador,
} from './courier-model';
import { useCouriers } from './useCouriers';
import type { Courier, CourierAccess } from '../api/types';
import './CouriersPage.css';

type Linha = {
  id: string;
  entregador: ReactNode;
  telefone: string;
  acesso: string;
  situacao: ReactNode;
  acoes: ReactNode;
};

const COLUNAS: readonly Column<Linha>[] = [
  { key: 'entregador', header: 'Entregador' },
  { key: 'telefone', header: 'Telefone' },
  { key: 'acesso', header: 'Acesso' },
  { key: 'situacao', header: 'Situação' },
  { key: 'acoes', header: 'Ações', align: 'end', headerHidden: true },
];

/**
 * ============================================================================
 * ENTREGADORES — quem sai com o pedido
 * ============================================================================
 *
 * ELA É DE UMA FILIAL, e não do restaurante. O telefone é único DENTRO da
 * filial e `branch_id` é obrigatório no cadastro: quem serve duas lojas tem
 * dois cadastros, um em cada. Por isso a tela ADOTA uma filial em vez de pedir
 * uma — a mesma decisão de Cardápio e das seções de Loja (`branch-scope.ts`):
 * sem filial escolhida usa a principal e diz qual é, porque "escolha uma
 * filial" antes da tela lê como bug para quem pediu a tela.
 *
 * A LISTA TRAZ OS INATIVOS, e é assim que se religa quem foi desativado. Quem
 * não aparece é o EXCLUÍDO — e a diferença entre os dois é a razão de existirem
 * as duas ações:
 *
 *   - DESATIVAR é reversível e é o que se faz quando o motoboy vai viajar. Tira
 *     o acesso na hora e devolve os pedidos abertos dele para a fila.
 *   - EXCLUIR não volta. O histórico de corridas fica (é o que o dono usa para
 *     pagar), e o telefone fica livre para um cadastro novo.
 *
 * A tela diz as duas coisas ANTES do clique, no diálogo, porque as duas são
 * indistinguíveis pelo nome do botão.
 */
export function CouriersPage() {
  const { pode } = usePermissoes();

  /*
   * A ABA DO RELATÓRIO SÓ EXISTE PARA QUEM PODE LER O DINHEIRO.
   *
   * `GET /admin/reports/couriers` é GERENCIA e a lista é PESSOAS: o
   * atendente abre a tela e não vê a aba. Desabilitá-la seria pior — o
   * painel SOME, não desabilita, e um controle cinzento sem explicação é a
   * pessoa tentando e não conseguindo.
   */
  const podeVerRelatorio = pode('entregadores.verRelatorio');
  const [aba, setAba] = useState<'lista' | 'pagar'>('lista');

  /*
   * A ADOÇÃO DA FILIAL VALE SÓ NA ABA DA LISTA — é o `adotar` de
   * `useAdoptedBranch` no caso que ele existe para cobrir.
   *
   * O CADASTRO precisa de uma filial concreta (o telefone é único DENTRO
   * dela, e `branch_id` é obrigatório no POST), então a lista adota e o
   * cabeçalho passa a dizer a mesma coisa que o formulário grava.
   *
   * O RELATÓRIO É O CONTRÁRIO: `branch_id` omitido soma o restaurante
   * inteiro, e esse total é o número que o dono abriu a tela para ver.
   * Adotando sempre, "Todas as filiais" escolhida no topo voltava sozinha
   * para a filial adotada no efeito seguinte — o seletor piscava, o dono
   * nunca alcançava o total da rede, e o ramo "no restaurante" da tela do
   * relatório era código que nenhum clique podia atingir.
   *
   * Quem pegou foi o e2e DO GERENTE: sem filial ele toma 403, a tela existe
   * para orientá-lo antes disso, e com a adoção ligada o aviso nunca
   * aparecia — porque o estado que ele descreve não era alcançável.
   */
  const { branch, branchId, hasChoice } = useAdoptedBranch(aba === 'lista');
  const { restaurantLabel } = useSession();

  /*
   * O DOMÍNIO DO APP NÃO TEM PADRÃO, e é essa a proteção: faltando a
   * variável, o painel NÃO OFERECE o botão. A alternativa seria gerar um
   * link para um domínio errado — e o par sai uma vez só, então o motoboy
   * receberia algo que não abre e a segunda via mataria a primeira.
   */
  const appUrl = import.meta.env.VITE_COURIER_APP_URL;
  const podeAcesso = pode('entregadores.gerarAcesso') && podeGerarAcesso(appUrl);

  const couriers = useCouriers(branchId);

  const [editando, setEditando] = useState<{ courier: Courier | null; draft: CourierDraft } | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const [confirmando, setConfirmando] = useState<{
    courier: Courier;
    acao: 'excluir' | 'regerar';
  } | null>(null);

  /**
   * O par em claro, enquanto o diálogo está aberto.
   *
   * Ele não é guardado em lugar nenhum além deste estado: não vai para o
   * localStorage, não entra na lista, e some quando o diálogo fecha. É a
   * mesma disciplina da senha temporária — o que existe uma vez só não pode
   * ganhar uma segunda morada por conveniência.
   */
  const [acesso, setAcesso] = useState<{ courier: Courier; dados: CourierAccess } | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [alternando, setAlternando] = useState<string | null>(null);

  const podeCadastrar = pode('entregadores.cadastrar');
  const podeEditar = pode('entregadores.editar');
  const podeExcluir = pode('entregadores.excluir');

  async function gravar(
    escrever: () => Promise<unknown | null>,
  ): Promise<ErrosDoEntregador | null> {
    setIsSaving(true);
    try {
      const erro = await escrever();
      if (erro) return errosDoEntregador(erro);
      setEditando(null);
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Cadastrar e editar são DOIS CORPOS, e por isso dois caminhos de verdade.
   *
   * Não é repetição evitável: o POST leva a filial e o PATCH não pode levá-la
   * (`extra="forbid"` — seria 422), e o PATCH manda só o que mudou. Costurar
   * os dois num ternário uniria os tipos e o compilador pararia de conferir
   * exatamente onde ele protege: o campo que sobra ou falta no corpo, §2 da
   * revisão. Um `as` aqui seria a mesma renúncia com outro nome.
   */
  async function salvar(draft: CourierDraft): Promise<ErrosDoEntregador | null> {
    const alvo = editando?.courier ?? null;

    if (alvo) {
      const corpo = corpoDeEdicao(draft, alvo);
      if (!corpo.ok) return { campos: { [corpo.campo]: corpo.message }, geral: null };
      return gravar(() => couriers.editar(alvo.id, corpo.body));
    }

    const corpo = corpoDeCriacao(draft, branchId);
    if (!corpo.ok) return { campos: { [corpo.campo]: corpo.message }, geral: null };
    return gravar(() => couriers.criar(corpo.body));
  }

  /*
   * ============================================================================
   * O ERRO DESTAS DUAS AÇÕES NÃO PASSA POR `errosDoEntregador`
   * ============================================================================
   *
   * Aquele mapeia 409 para o CAMPO DO TELEFONE, porque no formulário 409 é
   * sempre telefone repetido. Aqui não: o 409 de desativar ou de excluir fala
   * de outra coisa, e passá-lo por lá devolveria `geral: null` — a recusa
   * viraria erro NENHUM na tela.
   *
   * Foi exatamente o que aconteceu na primeira escrita desta tela, e quem pegou
   * foi o e2e da recusa do DELETE. É a falha cujo sintoma é ausência, agora
   * cometida por quem passou a rodada anterior varrendo atrás dela.
   */

  /**
   * Ligar e desligar sem diálogo, e é a decisão certa para ESTE sentido.
   *
   * DESATIVAR TEM CONSEQUÊNCIA (tira o acesso, devolve os pedidos à fila) e
   * mesmo assim não pergunta: é reversível num clique, e a consequência está
   * escrita ao lado do interruptor. Perguntar em toda troca é o que ensina o
   * lojista a confirmar sem ler — e aí o diálogo que importa, o de excluir,
   * também passa batido.
   */
  async function alternarAtivo(courier: Courier) {
    setAlternando(courier.id);
    setErroDaAcao(null);
    const erro = await couriers.editar(courier.id, { is_active: !courier.is_active });
    if (erro) setErroDaAcao(messageFromUnknownError(erro));
    setAlternando(null);
  }

  /**
   * Gera o par, e é a ÚNICA vez que ele existe em claro.
   *
   * REGERAR MATA O ANTERIOR NA HORA, então ele passa pela confirmação
   * quando já há acesso valendo — é o botão de "o motoboy saiu ou perdeu o
   * celular", e apertá-lo por engano deixa quem está na rua sem entrar.
   *
   * O 409 AQUI É ENTREGADOR INATIVO, e a frase do backend já diz o que
   * fazer ("Reative-o antes"). Ela sobe inteira: reescrevê-la aqui seria
   * duas fontes para a mesma explicação.
   */
  async function gerarAcesso(courier: Courier) {
    setAlternando(courier.id);
    setErroDaAcao(null);
    try {
      const dados = await generateCourierAccess(courier.id);
      setAcesso({ courier, dados });
      setConfirmando(null);
      /*
       * A LINHA PRECISA SABER QUE AGORA HÁ ACESSO. A resposta desta rota é
       * o PAR, não o entregador — sem reler, a coluna continuaria dizendo
       * "Sem acesso" ao lado de um par que acabou de ser entregue.
       */
      await couriers.recarregar();
    } catch (error) {
      setErroDaAcao(messageFromUnknownError(error));
    } finally {
      setAlternando(null);
    }
  }

  async function excluir() {
    if (!confirmando) return;
    setIsSaving(true);
    setErroDaAcao(null);
    const erro = await couriers.excluir(confirmando.courier.id);
    setIsSaving(false);
    if (erro) {
      setErroDaAcao(messageFromUnknownError(erro));
      return;
    }
    setConfirmando(null);
  }

  const linhas: Linha[] = couriers.couriers.map((courier) => ({
    id: courier.id,
    entregador: <span className="entregadores__nome">{courier.name}</span>,
    telefone: formatPhone(courier.phone),
    acesso: textoDoAcesso(courier),
    situacao: (
      <span
        className={`tag entregadores__tag entregadores__tag--${courier.is_active ? 'ativo' : 'inativo'}`}
      >
        {courier.is_active ? 'Ativo' : 'Desativado'}
      </span>
    ),
    acoes: (
      <div className="entregadores__acoes">
        {podeEditar ? (
          <>
            <button
              type="button"
              className="btn btn--sm btn--ghost icon-btn"
              aria-label={`Editar ${courier.name}`}
              onClick={() => setEditando({ courier, draft: rascunhoDe(courier) })}
              data-testid={`courier-edit-${courier.id}`}
            >
              <EditIcon />
            </button>

            <button
              type="button"
              className="btn btn--sm"
              disabled={alternando === courier.id}
              onClick={() => void alternarAtivo(courier)}
              data-testid={`courier-toggle-${courier.id}`}
            >
              {courier.is_active ? 'Desativar' : 'Reativar'}
            </button>
          </>
        ) : null}

        {podeAcesso ? (
          <button
            type="button"
            className="btn btn--sm"
            disabled={alternando === courier.id}
            onClick={() => {
              setErroDaAcao(null);
              // Já há par valendo: perguntar antes, porque gerar outro mata
              // o que o motoboy está usando agora.
              if (courier.has_access) setConfirmando({ courier, acao: 'regerar' });
              else void gerarAcesso(courier);
            }}
            data-testid={`courier-access-${courier.id}`}
          >
            {courier.has_access ? 'Gerar outro acesso' : 'Gerar acesso'}
          </button>
        ) : null}

        {podeExcluir ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setErroDaAcao(null);
              setConfirmando({ courier, acao: 'excluir' });
            }}
            data-testid={`courier-delete-${courier.id}`}
          >
            Excluir
          </button>
        ) : null}
      </div>
    ),
  }));

  if (podeVerRelatorio && aba === 'pagar') {
    return (
      <div className="entregadores">
        <AbasDoEntregador aba={aba} onTrocar={setAba} />
        <CourierReportPage />
      </div>
    );
  }

  return (
    <div className="entregadores">
      {podeVerRelatorio ? <AbasDoEntregador aba={aba} onTrocar={setAba} /> : null}
      <PageBar
        title="Entregadores"
        /*
          A FILIAL SÓ É NOMEADA QUANDO HÁ ESCOLHA. Com uma loja só, escrevê-la
          não distingue nada — é a mesma regra do "DISPONÍVEL" ao lado de um
          interruptor já ligado.
        */
        aside={
          hasChoice && branch ? (
            <span className="t-aux" data-testid="couriers-escopo">
              {branch.name}
            </span>
          ) : null
        }
      >
        {podeCadastrar ? (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => setEditando({ courier: null, draft: RASCUNHO_NOVO })}
            data-testid="courier-novo"
          >
            <PlusIcon />
            Novo entregador
          </button>
        ) : null}
      </PageBar>

      {couriers.errorMessage ? (
        <p className="alert alert--error" role="alert" data-testid="couriers-error">
          {couriers.errorMessage}
        </p>
      ) : null}

      {erroDaAcao ? (
        <p className="alert alert--error" role="alert" data-testid="courier-acao-error">
          {erroDaAcao}
        </p>
      ) : null}

      <p className="field__hint entregadores__ajuda">
        Cada entregador é de <strong>uma filial</strong>: quem trabalha nas duas precisa de um
        cadastro em cada, porque o telefone não se repete dentro da mesma loja.
      </p>

      {couriers.isLoading ? (
        <p className="muted entregadores__estado">Carregando…</p>
      ) : (
        <DataTable
          caption="Os entregadores desta filial"
          captionHidden
          columns={COLUNAS}
          rows={linhas}
          /*
            LISTA VAZIA SÓ É AFIRMAÇÃO QUANDO A LEITURA VOLTOU. Com erro em
            tela, o estado vazio não aparece — "nenhum entregador" numa queda de
            rede faria o lojista cadastrar de novo quem já existe.
          */
          empty={
            couriers.errorMessage ? null : (
              <p className="muted entregadores__estado" data-testid="couriers-vazio">
                Nenhum entregador nesta filial ainda. Cadastre quem sai com os pedidos para poder
                entregá-los a alguém.
              </p>
            )
          }
        />
      )}

      {editando ? (
        <CourierDialog
          initial={editando.draft}
          isEdicao={editando.courier !== null}
          isSaving={isSaving}
          onClose={() => setEditando(null)}
          onSave={salvar}
        />
      ) : null}

      {/*
        UMA CONFIRMAÇÃO PARA DOIS CASOS, e as duas frases são diferentes
        porque as consequências são. Excluir tira o cadastro; REGERAR mata o
        par que o motoboy está usando AGORA — e quem está na rua descobre
        isso ao tentar abrir o app.
      */}
      {confirmando?.acao === 'excluir' ? (
        <ConfirmDialog
          title={`Excluir ${confirmando.courier.name}?`}
          confirmLabel="Excluir"
          sendingLabel="Excluindo…"
          cancelLabel="Manter o cadastro"
          isSending={isSaving}
          errorMessage={erroDaAcao}
          onClose={() => setConfirmando(null)}
          onConfirm={() => void excluir()}
          data-testid="courier-excluir-dialogo"
        >
          {/*
            A ALTERNATIVA REVERSÍVEL VEM JUNTO, porque ela existe e quase
            sempre serve: "vai viajar" e "saiu da loja" pedem coisas
            diferentes, e só uma delas tem volta.
          */}
          <p>
            O acesso dele morre na hora e os pedidos que estiverem com ele voltam para a fila. O
            histórico de corridas continua — é ele que fecha o acerto do mês.
          </p>
          <p>
            Se for só uma ausência, <strong>desative</strong> em vez de excluir: dá no mesmo hoje e
            volta com um clique.
          </p>
        </ConfirmDialog>
      ) : null}

      {confirmando?.acao === 'regerar' ? (
        <ConfirmDialog
          title={`Gerar outro acesso para ${confirmando.courier.name}?`}
          confirmLabel="Gerar outro"
          sendingLabel="Gerando…"
          cancelLabel="Manter o acesso atual"
          isSending={alternando === confirmando.courier.id}
          errorMessage={erroDaAcao}
          onClose={() => setConfirmando(null)}
          onConfirm={() => void gerarAcesso(confirmando.courier)}
          data-testid="courier-regerar-dialogo"
        >
          {/*
            O QUE ACONTECE COM QUEM ESTÁ NA RUA. Este é o botão de "o motoboy
            saiu ou perdeu o celular", e apertá-lo por engano derruba quem
            está entregando agora — sem aviso nenhum do lado dele.
          */}
          <p>
            O link e o código de agora <strong>param de funcionar na hora</strong>. Se ele estiver
            entregando com o app aberto, vai perder o acesso no meio da corrida.
          </p>
          <p>Use isto quando ele trocar de celular, perder o aparelho ou sair da loja.</p>
        </ConfirmDialog>
      ) : null}

      {/*
        O PAR, DEPOIS DE GERADO. `link` nunca é nulo aqui: o botão que leva a
        este diálogo só existe quando há domínio configurado.
      */}
      {acesso && linkDoEntregador(appUrl, acesso.dados.link_token) ? (
        <CourierAccessDialog
          courier={acesso.courier}
          acesso={acesso.dados}
          link={linkDoEntregador(appUrl, acesso.dados.link_token)!}
          nomeDaLoja={branch?.name ?? restaurantLabel}
          onClose={() => setAcesso(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * AS DUAS PORTAS DO MESMO DOMÍNIO: quem entrega, e quanto se deve a quem
 * entrega.
 *
 * Elas são abas e não dois itens da lateral porque quem vai pagar procura
 * pelas PESSOAS — e porque a lateral já cresceu uma vez nesta frente. Duas
 * portas para o mesmo domínio, uma embaixo da outra no menu, é o começo de
 * uma lista que ninguém varre.
 */
function AbasDoEntregador({
  aba,
  onTrocar,
}: {
  aba: 'lista' | 'pagar';
  onTrocar: (proxima: 'lista' | 'pagar') => void;
}) {
  return (
    <Tabs
      label="Entregadores"
      testIdPrefix="entregadores-aba"
      value={aba}
      onChange={(id) => onTrocar(id as 'lista' | 'pagar')}
      tabs={[
        { id: 'lista', label: 'Quem entrega' },
        { id: 'pagar', label: 'A pagar' },
      ]}
    />
  );
}
