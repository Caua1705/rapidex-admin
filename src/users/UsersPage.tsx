import { useState, type ReactNode } from 'react';

import type { AdminUserCreated, AdminUserDetail } from '../api/types';
import { roleLabel } from '../auth/role-labels';
import { useSession } from '../auth/session-context';
import { usePermissoes } from '../auth/use-permissions';
import { DataTable, HelpPopover, PageBar, type Column } from '../ds';
import { EditIcon, PlusIcon } from '../ds/icons';
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog';
import { UserDialog } from './UserDialog';
import {
  errosDoUsuario,
  filialLabel,
  motivoParaNaoDesativar,
  motivoParaNaoRedefinirSenha,
  rascunhoDe,
  rascunhoNovo,
  situacaoDe,
  SITUACAO_LABEL,
  TODAS_AS_FILIAIS,
  type ErrosDoUsuario,
  type UserDraft,
} from './users-model';
import { useUsers } from './useUsers';
import './UsersPage.css';

type Linha = {
  id: string;
  pessoa: ReactNode;
  cargo: string;
  filial: string;
  situacao: ReactNode;
  acoes: ReactNode;
};

/*
 * A LARGURA DAS COLUNAS NÃO VEM DAQUI, e sim de `UsersPage.css` — `ds/DataTable`
 * aceita `width`, mas usá-lo significaria escrever "132px" dentro do TSX, e a
 * régua de aderência barra px solto no código de tela. Mesma decisão de
 * `CouponsPage` e `CustomersPage`.
 */
const COLUNAS: readonly Column<Linha>[] = [
  { key: 'pessoa', header: 'Pessoa' },
  { key: 'cargo', header: 'Cargo' },
  { key: 'filial', header: 'Filial' },
  { key: 'situacao', header: 'Situação' },
  { key: 'acoes', header: 'Ações', align: 'end', headerHidden: true },
];

/**
 * ============================================================================
 * USUÁRIOS — quem entra no painel
 * ============================================================================
 *
 * A TELA EXISTE POR UM MOTIVO CONCRETO: até aqui só havia a conta do dono, e
 * criar usuário era `docker exec` com um script. O resultado prático disso é
 * que o dono compartilha a própria senha com o balcão — e com ela vai o preço
 * do cardápio, a lista de clientes com telefone e o faturamento.
 *
 * NÃO HÁ FILTRO NEM BUSCA, e é decisão e não falta. `GET /admin/users` devolve
 * a equipe inteira e não aceita query nenhuma; uma equipe de restaurante tem
 * cinco linhas, não quinhentas. Um filtro aqui seria um controle que esconde
 * parte de uma lista que cabe na tela.
 *
 * A FILIAL DO TOPO NÃO RECORTA ESTA TELA. A equipe é do restaurante, e a filial
 * de cada pessoa é uma COLUNA: recortar pelo seletor esconderia justamente quem
 * enxerga todas as lojas, que é quem mais interessa numa tela sobre acesso.
 *
 * AS GUARDAS FICAM NA LINHA, e o que elas escondem é o BOTÃO — não a
 * explicação. Onde uma ação não existe, a célula diz por quê em duas palavras,
 * e a ajuda do cabeçalho diz por extenso. Ver `users-model.ts`.
 */
export function UsersPage() {
  const { user, branches, activeBranchId } = useSession();
  const { pode } = usePermissoes();
  const {
    usuarios,
    isLoading,
    isSaving,
    errorMessage,
    criar,
    editar,
    alternarAtivo,
    redefinirSenha,
  } = useUsers();

  const [emEdicao, setEmEdicao] = useState<{ draft: UserDraft; original: AdminUserDetail | null } | null>(
    null,
  );
  /* A senha temporária vive AQUI e em mais lugar nenhum: ela chega da resposta,
     abre o diálogo e some quando ele fecha. Não é gravada, não vai para o
     `localStorage` e não volta a existir. */
  const [senhaNova, setSenhaNova] = useState<{
    resultado: AdminUserCreated;
    motivo: 'criado' | 'reset';
  } | null>(null);
  const [erroDeLinha, setErroDeLinha] = useState<string | null>(null);

  const meuId = user?.id ?? null;
  const podeCriar = pode('usuarios.criar');
  const podeEditar = pode('usuarios.editar');
  const podeRedefinir = pode('usuarios.redefinirSenha');

  function abrirNovo() {
    setErroDeLinha(null);
    /*
     * O CADASTRO NASCE NA FILIAL QUE O TOPO ESTÁ MOSTRANDO, quando há uma
     * escolhida. Quem está com "Centro" aberto e clica em "Novo usuário" está
     * quase sempre cadastrando alguém do Centro — e com "Todas" escolhida o
     * padrão vira todas, que é o valor nulo do contrato.
     */
    setEmEdicao({ draft: rascunhoNovo(activeBranchId || TODAS_AS_FILIAIS), original: null });
  }

  function abrirEdicao(usuario: AdminUserDetail) {
    setErroDeLinha(null);
    setEmEdicao({ draft: rascunhoDe(usuario), original: usuario });
  }

  async function salvar(draft: UserDraft): Promise<ErrosDoUsuario | null> {
    const original = emEdicao?.original ?? null;

    if (original) {
      const falha = await editar(draft, original);
      return falha ? errosDoUsuario(falha.erro) : null;
    }

    const resposta = await criar(draft);
    if ('erro' in resposta) return errosDoUsuario(resposta.erro);

    /*
     * O DIÁLOGO DA SENHA ABRE NO LUGAR DO FORMULÁRIO, e não por cima dele:
     * `onSave` devolver `null` faz o `UserDialog` se fechar sozinho, e este
     * estado entra no mesmo ciclo de render. Diálogo sobre diálogo esconderia
     * o formulário e faria o Esc de cima fechar os dois — o mesmo motivo pelo
     * qual a busca de item do Cardápio abre DENTRO do campo.
     */
    setSenhaNova({ resultado: resposta.criado, motivo: 'criado' });
    return null;
  }

  async function alternar(usuario: AdminUserDetail) {
    setErroDeLinha(null);
    const falha = await alternarAtivo(usuario);
    if (falha) setErroDeLinha(falha);
  }

  async function redefinir(usuario: AdminUserDetail) {
    setErroDeLinha(null);
    const resposta = await redefinirSenha(usuario);
    if ('erro' in resposta) setErroDeLinha(resposta.erro);
    else setSenhaNova({ resultado: resposta.criado, motivo: 'reset' });
  }

  const linhas: Linha[] = usuarios.map((usuario) => {
    const situacao = situacaoDe(usuario);
    const souEu = usuario.id === meuId;
    const semDesativar = motivoParaNaoDesativar(usuario, meuId, usuarios);
    const semRedefinir = motivoParaNaoRedefinirSenha(usuario, meuId);

    return {
      id: usuario.id,
      pessoa: (
        <span className="usuarios__pessoa">
          <span className="usuarios__nome">
            {usuario.name}
            {/*
              "VOCÊ" É ETIQUETA NEUTRA, e precisa existir: é a linha em que duas
              ações somem, e sem a marca o dono lê isso como defeito da tela em
              vez de como a própria conta.
            */}
            {souEu ? (
              <span className="tag usuarios__eu" data-testid="usuarios-eu">
                você
              </span>
            ) : null}
          </span>
          <span className="usuarios__email t-aux">{usuario.email}</span>
        </span>
      ),
      cargo: roleLabel(usuario.role),
      filial: filialLabel(usuario, branches),
      situacao: (
        <span className={`tag usuarios__tag usuarios__tag--${situacao}`}>
          {SITUACAO_LABEL[situacao]}
        </span>
      ),
      acoes: (
        <span className="usuarios__acoes">
          {/*
            O LÁPIS É ÍCONE e as outras duas são palavra — a mesma divisão de
            Cupons. "Editar" é um desenho que o lojista já lê nesta sessão;
            "Redefinir senha" e "Desativar" não têm ícone convencional, e uma
            chave ou um cadeado ali seriam símbolos novos para ações que mexem
            no acesso de uma pessoa.
          */}
          {podeEditar ? (
            <button
              type="button"
              className="btn btn--sm icon-btn"
              onClick={() => abrirEdicao(usuario)}
              aria-label={`Editar ${usuario.name}`}
              title="Editar"
              data-testid={`usuario-editar-${usuario.email}`}
            >
              <EditIcon size={14} />
            </button>
          ) : null}

          {podeRedefinir && semRedefinir === null ? (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => void redefinir(usuario)}
              disabled={isSaving}
              data-testid={`usuario-redefinir-${usuario.email}`}
            >
              Redefinir senha
            </button>
          ) : null}

          {podeEditar && semDesativar === null ? (
            <button
              type="button"
              /*
               * DESATIVAR É `--ghost-danger`, e reativar é ghost neutro. Aqui a
               * cor se justifica onde em Cupons não se justificava: desligar uma
               * campanha é o fim normal de uma promoção, e desativar uma pessoa
               * derruba o acesso dela na requisição seguinte, no meio do turno.
               */
              className={`btn btn--sm ${usuario.is_active ? 'btn--ghost-danger' : 'btn--ghost'}`}
              onClick={() => void alternar(usuario)}
              disabled={isSaving}
              data-testid={`usuario-alternar-${usuario.email}`}
            >
              {usuario.is_active ? 'Desativar' : 'Reativar'}
            </button>
          ) : null}

          {/*
            ONDE A AÇÃO NÃO EXISTE, A CÉLULA DIZ POR QUÊ — em duas palavras, que
            é o que cabe numa coluna. A frase inteira está na ajuda do
            cabeçalho: um motivo de duas linhas dentro da célula esticaria a
            linha e desalinharia a tabela toda, que é o ganho da direção.

            SEM ISTO, A LINHA DO PRÓPRIO DONO FICA COM UM LÁPIS SOLTO e mais
            nada — e duas ações que somem sem explicação se leem como tela
            quebrada, não como regra. A etiqueta "você" ao lado do nome diz
            QUEM é; esta diz POR QUE aqui há menos botões.
          */}
          {souEu ? (
            <span className="t-aux usuarios__motivo" data-testid="usuarios-motivo-eu">
              sua conta
            </span>
          ) : semDesativar !== null ? (
            <span className="t-aux usuarios__motivo" data-testid="usuarios-motivo-unico-dono">
              único proprietário ativo
            </span>
          ) : null}
        </span>
      ),
    };
  });

  return (
    <div className="usuarios">
      <PageBar
        title="Usuários"
        aside={
          <span className="usuarios__escopo-grupo">
            {/*
              A FRASE QUE FAZ A TELA EXISTIR. O e-mail principal é do dono, e
              quem trabalha na loja tem login próprio — enquanto isso não for
              verdade, a senha do dono circula no balcão.
            */}
            <span className="t-aux usuarios__escopo" data-testid="usuarios-escopo">
              o e-mail principal é do proprietário; quem trabalha na loja entra com o login dela
            </span>

            <HelpPopover
              label="Como funcionam os acessos"
              title="Como funcionam os acessos"
              data-testid="usuarios-ajuda"
            >
              <p className="t-aux">
                <strong>A senha aparece uma vez.</strong> Ao cadastrar alguém, o painel gera uma
                senha temporária e a mostra uma única vez — nem o servidor a guarda. Se ela se
                perder, o caminho é "Redefinir senha", que gera outra e mata a anterior.
              </p>
              <p className="t-aux">
                <strong>No primeiro acesso a pessoa troca a senha.</strong> Até trocar, a única
                tela que abre para ela é a da troca. Depois disso, ninguém mais conhece a senha
                dela — inclusive você.
              </p>
              <p className="t-aux">
                <strong>Desativar tem efeito imediato.</strong> Não existe excluir: o histórico de
                cada pedido guarda quem agiu por aquele e-mail, e apagar a conta faria o passado
                apontar para a pessoa errada. Desativada, ela perde o acesso na requisição
                seguinte — não espera a sessão expirar.
              </p>
              <p className="t-aux">
                <strong>Três coisas o painel não deixa fazer</strong>, porque um restaurante sem
                proprietário ativo só se conserta pelo servidor: desativar a própria conta,
                desativar o único proprietário ativo e mudar o cargo dele.
              </p>
              <p className="t-aux">
                <strong>A filial recorta o que a pessoa vê.</strong> Presa a uma loja, ela só
                enxerga os pedidos, o cardápio e os números dela. O proprietário enxerga todas, e
                por isso o campo não aparece nesse cargo.
              </p>
              <p className="t-aux">
                <strong>Não há registro de quem cadastrou ou desativou quem.</strong> As operações
                ficam no log do servidor, mas não existe consulta a isso pelo painel.
              </p>
            </HelpPopover>
          </span>
        }
        meta={
          !isLoading ? (
            <span className="t-aux" data-testid="usuarios-contagem">
              {usuarios.length === 1 ? '1 pessoa' : `${usuarios.length} pessoas`}
            </span>
          ) : null
        }
      >
        {podeCriar ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={abrirNovo}
            data-testid="usuarios-novo"
          >
            <PlusIcon size={14} aria-hidden="true" />
            Novo usuário
          </button>
        ) : null}
      </PageBar>

      {errorMessage ? (
        <p className="alert alert--error usuarios__alerta" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {erroDeLinha ? (
        <p className="alert alert--error usuarios__alerta" role="alert">
          {erroDeLinha}
        </p>
      ) : null}

      {isLoading ? (
        <p className="muted usuarios__estado">Carregando…</p>
      ) : (
        <div className="usuarios__lista">
          <DataTable
            caption="Quem entra no painel deste restaurante"
            captionHidden
            columns={COLUNAS}
            rows={linhas}
            empty={
              /* Não é um vazio de filtro — não há filtro. É a lista que voltou
                 sem ninguém, o que só acontece se a leitura falhar de um jeito
                 que não levantou erro. Dizer isso é mais honesto que um convite
                 a cadastrar a primeira pessoa numa tela onde você já está. */
              <p className="muted usuarios__estado" data-testid="usuarios-vazio">
                Nenhuma conta veio nesta lista. Recarregue a página — sua própria conta deveria
                estar aqui.
              </p>
            }
          />
        </div>
      )}

      {emEdicao ? (
        <UserDialog
          initial={emEdicao.draft}
          original={emEdicao.original}
          branches={branches}
          meuId={meuId}
          usuarios={usuarios}
          onClose={() => setEmEdicao(null)}
          onSave={salvar}
          isSaving={isSaving}
        />
      ) : null}

      {senhaNova ? (
        <TemporaryPasswordDialog
          resultado={senhaNova.resultado}
          motivo={senhaNova.motivo}
          onClose={() => setSenhaNova(null)}
        />
      ) : null}
    </div>
  );
}
