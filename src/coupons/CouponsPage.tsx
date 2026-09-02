import { useMemo, useState, type ReactNode } from 'react';

import type { Coupon, CouponTemplate } from '../api/types';
import { usePermissoes } from '../auth/use-permissions';
import { DataTable, HelpPopover, PageBar, Select, type Column } from '../ds';
import { AlertIcon, EditIcon, ImageIcon, PlusIcon } from '../ds/icons';
import { todayInOperationTimezone } from '../orders/format';
import { CouponDialog } from './CouponDialog';
import {
  arteDesativada,
  arteDoCupom,
  artesDisponiveis,
  descontoDoCupom,
  rascunhoDe,
  rascunhoNovo,
  situacaoDoCupom,
  textoDaValidade,
  textoDeQuemVe,
  textoDeUso,
  textoDoCodigo,
  TIPO_LABEL,
  ORDEM_DOS_TIPOS,
  SITUACAO_LABEL,
  type CouponDraft,
  type Situacao,
} from './coupon-model';
import { useCoupons } from './useCoupons';
import './CouponsPage.css';

/*
 * OS DOIS FILTROS SÃO DE TELA, NÃO DE BANCO.
 *
 * `GET /admin/coupons` não aceita query nenhuma: ela devolve as campanhas todas
 * deste restaurante e pronto. Recortar aqui não é atalho — é a única forma que
 * existe —, e é por isso que a tela DIZ isso na ajuda: um lojista que veja
 * "Expirados" selecionado e uma lista curta precisa saber que o resto está na
 * mão do painel, e não que o backend perdeu campanha.
 */
const SITUACOES: readonly Situacao[] = ['programado', 'ativo', 'expirado', 'esgotado', 'desligado'];

const OPCOES_DE_SITUACAO = [
  { value: '', label: 'Todas as situações' },
  ...SITUACOES.map((situacao) => ({ value: situacao, label: SITUACAO_LABEL[situacao] })),
];

const OPCOES_DE_TIPO = [
  { value: '', label: 'Todos os tipos' },
  ...ORDEM_DOS_TIPOS.map((tipo) => ({ value: tipo, label: TIPO_LABEL[tipo] })),
];

type Linha = {
  id: string;
  arte: ReactNode;
  campanha: ReactNode;
  desconto: string;
  quemVe: ReactNode;
  validade: ReactNode;
  usos: string;
  situacao: ReactNode;
  acoes: ReactNode;
};

/*
 * A LARGURA DAS COLUNAS NÃO VEM DAQUI, e sim de `CouponsPage.css`.
 *
 * `ds/DataTable` aceita `width`, mas usá-lo significaria escrever "132px"
 * dentro do TSX — e a régua de aderência (`npm run lint`) barra px solto no
 * código de tela, com razão: largura de coluna é medida de conteúdo e o lugar
 * dela é a folha de estilo, junto do resto do enquadramento da tabela. É a
 * mesma decisão de `CustomersPage`.
 */
const COLUNAS: readonly Column<Linha>[] = [
  { key: 'arte', header: 'Arte' },
  { key: 'campanha', header: 'Campanha' },
  { key: 'desconto', header: 'Desconto' },
  /*
   * "QUEM VÊ" É COLUNA PRÓPRIA, e não uma terceira etiqueta na de Situação.
   *
   * Os dois eixos são independentes e se confundem se compartilharem célula:
   * "Ativo" fala do prazo e do interruptor, "Privado" fala de público. Uma
   * campanha ativa e privada está no ar — juntar as duas palavras na mesma
   * coluna faria a segunda parecer uma qualificação da primeira, como se
   * privado fosse um jeito de estar desligado. Era exatamente isso que o
   * `is_public` fazia, e é o que a revisão do backend desfez.
   */
  { key: 'quemVe', header: 'Quem vê' },
  { key: 'validade', header: 'Validade' },
  { key: 'usos', header: 'Usos', align: 'end' },
  { key: 'situacao', header: 'Situação' },
  { key: 'acoes', header: 'Ações', align: 'end', headerHidden: true },
];

export function CouponsPage() {
  const { pode } = usePermissoes();
  const { cupons, artes, isLoading, isSaving, errorMessage, salvar, alternarAtivo } = useCoupons();

  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [emEdicao, setEmEdicao] = useState<CouponDraft | null>(null);
  const [erroDeLinha, setErroDeLinha] = useState<string | null>(null);

  const podeEscrever = pode('cupons.editar');
  const podeCriar = pode('cupons.criar');

  /*
   * A SITUAÇÃO SAI DE UM INSTANTE SÓ, e ele nasce junto com a lista.
   *
   * Ela depende do relógio, e lê-lo de novo a cada render faria uma campanha
   * atravessar de "Ativo" para "Expirado" no meio de uma digitação no filtro —
   * a lista mudaria de tamanho sem ninguém ter mexido nela. Com um instante por
   * carga, as cinco etiquetas da tela respondem todas à mesma hora, que é o que
   * as torna comparáveis entre si.
   */
  const comSituacao = useMemo(() => {
    const agora = new Date();
    return cupons.map((cupom) => ({
      cupom,
      situacao: situacaoDoCupom(cupom, agora),
      arte: arteDoCupom(cupom, artes),
      semArte: arteDesativada(cupom, artes),
    }));
  }, [cupons, artes]);

  const visiveis = comSituacao.filter(
    ({ cupom, situacao }) =>
      (filtroSituacao === '' || situacao === filtroSituacao) &&
      (filtroTipo === '' || cupom.discount_type === filtroTipo),
  );

  const foraDoAr = comSituacao.filter(({ semArte }) => semArte).length;

  function abrirNova() {
    setErroDeLinha(null);
    setEmEdicao(rascunhoNovo(todayInOperationTimezone()));
  }

  function abrirEdicao(cupom: Coupon) {
    setErroDeLinha(null);
    setEmEdicao(rascunhoDe(cupom));
  }

  async function desligarOuReligar(cupom: Coupon) {
    setErroDeLinha(null);
    const falha = await alternarAtivo(cupom);
    if (falha) setErroDeLinha(falha);
  }

  const linhas: Linha[] = visiveis.map(({ cupom, situacao, arte, semArte }) => ({
    id: cupom.id,
    arte: <Miniatura arte={arte} nome={cupom.title} />,
    campanha: (
      <span className="cupons__campanha">
        <span className="cupons__nome">{cupom.title}</span>
        {/*
          SEM CÓDIGO A LINHA NÃO FICA VAZIA: ela diz "aplica sozinho", que é o
          que o nulo significa. Uma célula em branco leria como dado faltando —
          e o lojista iria procurar o código que o cupom não tem, em vez de
          entender que este desconto entra no pedido sem ninguém digitar nada.

          `tnum` sai fora do código: a fonte tabular alinha ALGARISMOS, e
          "aplica sozinho" não tem nenhum. É a única diferença de forma entre os
          dois — a frase já se distingue do código pelo que ela diz, e itálico
          ou segunda cor aqui seriam enfeite sobre uma célula auxiliar.
        */}
        <span className={`cupons__codigo t-aux${cupom.code ? ' tnum' : ''}`}>
          {textoDoCodigo(cupom)}
        </span>
      </span>
    ),
    desconto: descontoDoCupom(cupom),
    quemVe: <span className="tag cupons__tag">{textoDeQuemVe(cupom)}</span>,
    validade: <span className="t-aux cupons__validade">{textoDaValidade(cupom)}</span>,
    usos: textoDeUso(cupom),
    situacao: (
      <span className="cupons__situacao">
        <span className={`tag cupons__tag cupons__tag--${situacao}`}>
          {SITUACAO_LABEL[situacao]}
        </span>

        {/*
          A ARTE FORA DO AR LEVA `.tag--alerta`, a única variante de etiqueta do
          sistema, e pelo mesmo motivo do "Sem opção" no Cardápio: é o estado
          que NINGUÉM ESCOLHEU. As outras cinco são o ciclo normal de uma
          campanha — o lojista programou, ligou, ela venceu — e etiqueta neutra
          é o que elas pedem. Esta aconteceu com ele, e trava o desligamento.

          Três canais, nenhum sozinho: cor, ícone e palavra.
        */}
        {semArte ? (
          <span className="tag tag--alerta cupons__tag">
            <AlertIcon size={12} aria-hidden="true" />
            Arte fora do ar
          </span>
        ) : null}
      </span>
    ),
    acoes: podeEscrever ? (
      <span className="cupons__acoes">
        {/*
          O `data-testid` CAI PARA O `id` QUANDO NÃO HÁ CÓDIGO. Ele continua
          nomeado pelo código porque é o que se lê na tela e nos testes — mas
          desde que o código virou opcional, `cupom-editar-null` seria o mesmo
          nome para todas as campanhas automáticas.
        */}
        {/*
          O LÁPIS É ÍCONE, e "Desligar" é palavra. Com os dois escritos por
          extenso a célula quebrava em duas fileiras e cada linha da tabela
          ficava com uma altura diferente da vizinha — o alinhamento por coluna
          é o ganho inteiro da direção, e ele some quando a linha respira
          diferente da de cima.

          Qual dos dois vira ícone não é sorteio: "Editar" é o lápis do
          Cardápio, um desenho que o lojista já lê nesta mesma sessão.
          "Desligar" não tem ícone convencional, e um cadeado ou um X ali seria
          um símbolo novo para uma ação que tira campanha do ar — é a que
          precisa da palavra.
        */}
        <button
          type="button"
          className="btn btn--sm icon-btn"
          onClick={() => abrirEdicao(cupom)}
          aria-label={`Editar ${cupom.title}`}
          title="Editar"
          data-testid={`cupom-editar-${cupom.code ?? cupom.id}`}
        >
          <EditIcon size={14} />
        </button>

        {/*
          DESLIGAR SÓ APARECE COM A ARTE NO AR, e a ausência não é capricho de
          tela: `update_admin` valida a arte sobre o resultado da mescla, então
          um `{ is_active: false }` numa campanha de arte desativada responde
          400 — o botão prometeria uma ação que o backend recusa. Nesses casos o
          caminho é "Editar", onde a arte nova viaja na mesma chamada.
        */}
        {!semArte ? (
          <button
            type="button"
            /*
             * GHOST NEUTRO, e não `--ghost-danger`. Desligar uma campanha não é
             * perigo: é o fim normal de uma promoção, e ele se desfaz no botão
             * ao lado ("Religar"). Em `--danger` a coluna inteira virava uma
             * fileira de palavras vermelhas — cor por gosto sobre a ação mais
             * corriqueira da tela, que é exatamente o que o sistema não faz.
             */
            className="btn btn--sm btn--ghost"
            onClick={() => void desligarOuReligar(cupom)}
            disabled={isSaving}
            data-testid={`cupom-alternar-${cupom.code ?? cupom.id}`}
          >
            {cupom.is_active ? 'Desligar' : 'Religar'}
          </button>
        ) : null}
      </span>
    ) : null,
  }));

  return (
    <div className="cupons">
      <PageBar
        title="Cupons"
        aside={
          <span className="cupons__escopo-grupo">
            <span className="t-aux cupons__escopo" data-testid="cupons-escopo">
              vale em todas as lojas
            </span>

            <HelpPopover
              label="Como funcionam os cupons"
              title="Como funcionam os cupons"
              data-testid="cupons-ajuda"
            >
              <p className="t-aux">
                <strong>O cupom é do restaurante inteiro.</strong> Ele não tem filial: vale em todas
                as lojas, e o seletor de filial do topo não recorta esta tela. Não há como criar uma
                campanha só do Centro.
              </p>
              <p className="t-aux">
                <strong>O valor vem da arte.</strong> Cada arte da plataforma já traz o desconto
                desenhado, e é ela que o cliente vê na vitrine. Uma arte vale por uma campanha: as
                que já estão em uso não aparecem na hora de criar a próxima.
              </p>
              <p className="t-aux">
                <strong>"Quem vê" e "Situação" são coisas diferentes.</strong> A situação diz se a
                campanha está no ar; a visibilidade diz quem a encontra. Um cupom privado e ativo
                está valendo — ele só não aparece na lista do app: chega a quem digita o código.
              </p>
              <p className="t-aux">
                <strong>Cupom sem código aplica sozinho.</strong> Quando a coluna do código diz
                "aplica sozinho", o desconto entra no fechamento do pedido sem o cliente digitar
                nada, em toda sacola que couber. Um pedido leva um cupom só — havendo mais de um
                automático que caiba, entra o de maior desconto.
              </p>
              <p className="t-aux">
                <strong>Os dois filtros acima são desta tela.</strong> A rota devolve as campanhas
                todas de uma vez e não aceita recorte — o que o filtro esconde continua aqui, a um
                clique de "Todas".
              </p>
              <p className="t-aux">
                <strong>
                  Não dá para segmentar por horário, dia da semana, tipo de pedido, produto ou forma
                  de pagamento.
                </strong>{' '}
                Esses campos não existem no cupom. O que recorta é a classe do cliente, o valor
                mínimo, o prazo, os limites de uso e o "nunca pediu aqui".
              </p>
              <p className="t-aux">
                <strong>Cupom não se apaga, se desliga.</strong> Os pedidos que já usaram a campanha
                precisam continuar sabendo dela, então não existe excluir — existe desligar, e
                religar depois.
              </p>
            </HelpPopover>
          </span>
        }
        meta={
          !isLoading ? (
            <span className="t-aux" data-testid="cupons-contagem">
              {visiveis.length === cupons.length
                ? `${cupons.length} ${cupons.length === 1 ? 'campanha' : 'campanhas'}`
                : `${visiveis.length} de ${cupons.length}`}
            </span>
          ) : null
        }
      >
        <Select
          bare
          value={filtroSituacao}
          onChange={setFiltroSituacao}
          options={OPCOES_DE_SITUACAO}
          aria-label="Filtrar por situação"
          data-testid="cupons-filtro-situacao"
        />
        <Select
          bare
          value={filtroTipo}
          onChange={setFiltroTipo}
          options={OPCOES_DE_TIPO}
          aria-label="Filtrar por tipo de desconto"
          data-testid="cupons-filtro-tipo"
        />

        {podeCriar ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={abrirNova}
            data-testid="cupons-nova"
          >
            <PlusIcon size={14} aria-hidden="true" />
            Nova campanha
          </button>
        ) : null}
      </PageBar>

      {errorMessage ? (
        <p className="alert alert--error cupons__alerta" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {erroDeLinha ? (
        <p className="alert alert--error cupons__alerta" role="alert">
          {erroDeLinha}
        </p>
      ) : null}

      {/*
        O AVISO ACIMA DA LISTA, como o do item sem opção no Cardápio: uma
        etiqueta na linha 12 não é achável sozinha, e este estado trava o
        desligamento da campanha — o lojista precisa saber que existe antes de
        procurar por que o botão sumiu.
      */}
      {foraDoAr > 0 ? (
        <p
          className="alert alert--warn cupons__alerta"
          role="status"
          data-testid="cupons-fora-do-ar"
        >
          <AlertIcon size={14} aria-hidden="true" />{' '}
          {foraDoAr === 1
            ? 'Uma campanha usa uma arte que saiu do catálogo. Ela continua valendo, mas nada nela pode ser alterado — nem desligada — antes de você escolher outra arte em "Editar".'
            : `${foraDoAr} campanhas usam artes que saíram do catálogo. Elas continuam valendo, mas nada nelas pode ser alterado — nem desligadas — antes de você escolher outra arte em "Editar".`}
        </p>
      ) : null}

      {isLoading ? (
        <p className="muted cupons__estado">Carregando…</p>
      ) : (
        <div className="cupons__lista">
          <DataTable
            caption="Campanhas de cupom deste restaurante"
            captionHidden
            columns={COLUNAS}
            rows={linhas}
            empty={
              <EstadoVazio
                temCampanha={cupons.length > 0}
                podeCriar={podeCriar}
                onNova={abrirNova}
              />
            }
          />
        </div>
      )}

      {emEdicao ? (
        <CouponDialog
          initial={emEdicao}
          artes={artes}
          grupos={artesDisponiveis(artes, cupons, emEdicao.templateId || null)}
          onClose={() => setEmEdicao(null)}
          onSave={salvar}
          isSaving={isSaving}
        />
      ) : null}
    </div>
  );
}

/**
 * A arte na linha da lista.
 *
 * SEM IMAGEM NÃO É ERRO DE CARREGAMENTO. Ou a arte saiu do catálogo (e a
 * etiqueta de alerta na coluna de situação já diz isso, com palavra e ícone),
 * ou `image_url` veio nula do bucket. Nos dois casos o quadrado neutro é o
 * honesto: um ícone quebrado faria o lojista recarregar a página atrás de um
 * defeito que não é dele.
 */
function Miniatura({ arte, nome }: { arte: CouponTemplate | null; nome: string }) {
  if (!arte?.image_url) {
    return (
      <span className="cupons__miniatura cupons__miniatura--vazia" aria-hidden="true">
        <ImageIcon size={16} />
      </span>
    );
  }
  return <img className="cupons__miniatura" src={arte.image_url} alt={`Arte de ${nome}`} />;
}

/**
 * DOIS VAZIOS DIFERENTES, e confundi-los é o defeito.
 *
 * "Você ainda não criou campanha nenhuma" pede um botão. "O filtro não achou
 * nada" pede o contrário — a lista existe, o que falta é tirar o recorte. Um
 * texto só para os dois casos manda o lojista criar uma campanha que ele já
 * tem, escondida atrás do próprio filtro que ele ligou.
 */
function EstadoVazio({
  temCampanha,
  podeCriar,
  onNova,
}: {
  temCampanha: boolean;
  podeCriar: boolean;
  onNova: () => void;
}) {
  if (temCampanha) {
    return (
      <p className="muted cupons__estado" data-testid="cupons-vazio-filtro">
        Nenhuma campanha com este recorte. O filtro é desta tela — volte para "Todas" para ver o
        resto.
      </p>
    );
  }

  return (
    <div className="cupons__estado" data-testid="cupons-vazio">
      <p className="t-body">Nenhuma campanha por aqui ainda.</p>
      <p className="t-aux">
        Uma campanha começa pela arte: você escolhe um dos desenhos da plataforma — que já traz o
        desconto impresso — e decide o prazo, o mínimo e os limites de uso.
      </p>
      {podeCriar ? (
        <button type="button" className="btn btn--primary" onClick={onNova}>
          <PlusIcon size={14} aria-hidden="true" />
          Nova campanha
        </button>
      ) : null}
    </div>
  );
}
