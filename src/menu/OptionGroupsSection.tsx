import { useCallback, useEffect, useState } from 'react';

import {
  createOption,
  createOptionGroup,
  listProductOptionGroups,
  setOptionActive,
  setOptionSortOrder,
  updateOption,
  updateOptionGroup,
} from '../api/menu';
import { messageFromUnknownError } from '../api/errors';
import type {
  OptionCreateBody,
  OptionEditBody,
  ProductOption,
  ProductOptionGroup,
} from '../api/types';
import { Switch } from '../ds/Switch';
import { ChevronDownIcon, ChevronUpIcon, EditIcon, PlusIcon } from '../ds/icons';
import { formatCurrency } from '../orders/format';
import { GrupoForm } from './OptionGroupForm';
import { moveInList } from './menu-model';
import { blockingRequiredGroup, groupEmptiedByDeactivating } from './required-groups';
import {
  GRUPO_DESCRICAO_MAX,
  GRUPO_NOME_MAX,
  checkOpcao,
  checkOpcaoEdicao,
  comOpcaoTrocada,
  comOpcoesDoGrupo,
  opcaoDraftDe,
  opcaoVazia,
  ordemDasOpcoes,
  regraDoGrupo,
  type OpcaoDraft,
} from './option-groups';

/**
 * ============================================================================
 * OS GRUPOS DE COMPLEMENTO — de leitura para edição
 * ============================================================================
 *
 * ELE ERA UMA LISTA MORTA. Mostrava os grupos, deixava ligar e desligar uma
 * opção que já existia, e terminava com a frase "nome, preço e ordem dos
 * complementos têm rotas próprias e não são editados aqui". As rotas estavam
 * prontas no backend; ninguém tinha voltado. Montar uma pizza com "Escolha o
 * tamanho" e "Adicionais" era um chamado para o suporte — o cardápio de
 * qualquer pizzaria, hamburgueria ou açaí.
 *
 * ----------------------------------------------------------------------------
 * POR QUE ELE SAIU DO ProductDialog EM VEZ DE CRESCER DENTRO DELE
 * ----------------------------------------------------------------------------
 *
 * O `ProductDialog` tem UM botão de salvar, e ele grava o produto. Os
 * complementos têm rotas próprias e gravam SOZINHOS, no clique de cada
 * formulário — o comentário original já dizia isso e estava certo: misturar os
 * dois salvamentos num botão só faria "Salvar" significar duas coisas.
 *
 * O que muda é que a seção agora é grande demais para morar no meio de um
 * arquivo que já cuida de nome, preço, categoria, setor e foto.
 *
 * ----------------------------------------------------------------------------
 * E POR QUE NÃO É UM DIÁLOGO SOBRE O DIÁLOGO
 * ----------------------------------------------------------------------------
 *
 * No celular o `ProductDialog` é a tela inteira. Um segundo modal por cima
 * empilharia duas armadilhas de foco e deixaria dois "fechar" com efeitos
 * diferentes na mesma tela. Os formulários abrem EM LINHA, que é o padrão que
 * Loja › Pagamento já usa para "acrescentar uma coisa a uma lista".
 *
 * ----------------------------------------------------------------------------
 * LER É `PESSOAS`, ESCREVER É `GERÊNCIA`
 * ----------------------------------------------------------------------------
 *
 * O atendente abre o item e VÊ os grupos — é ele que precisa saber o que sai no
 * papel. Some o CONTROLE, fica o DADO, como o nome da impressora do setor. Por
 * isso `podeEditar` esconde os botões em vez de desabilitá-los: a razão é quem
 * a pessoa é, e ela não muda durante o turno.
 */
export function OptionGroupsSection({
  productId,
  podeEditar,
}: {
  productId: string;
  /**
   * O papel escreve complemento? Vem como propriedade, e não de
   * `usePermissoes()` aqui dentro, pelo mesmo motivo de `podeDefinirPreco` no
   * `ProductDialog`: ele é montado em teste sem provider nenhum.
   */
  podeEditar: boolean;
}) {
  const [grupos, setGrupos] = useState<ProductOptionGroup[] | null>(null);
  /**
   * A LEITURA QUE FALHOU — e ela é um estado À PARTE de `grupos === null`.
   *
   * Antes, o `catch` da leitura fazia `setGrupos([])`, e lista vazia nesta
   * seção significa "este produto não tem complemento". É a tela em que o
   * lojista decide se precisa CRIAR um: lendo "nenhum grupo" numa queda de
   * rede, ele cria o segundo "Escolha o tamanho" — e o cliente passa a ver os
   * dois. Ausência de dado não pode usar o mesmo desenho que o dado "não há".
   */
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [alternando, setAlternando] = useState<string | null>(null);
  /** A opção que espera confirmação por tirar o item de venda. */
  const [confirmando, setConfirmando] = useState<{
    optionId: string;
    optionName: string;
    groupName: string;
  } | null>(null);
  /** Qual formulário está aberto: `'novo'`, o id de um grupo, ou nenhum. */
  const [editando, setEditando] = useState<string | null>(null);
  /** Em qual grupo o formulário de nova opção está aberto. */
  const [novaOpcaoEm, setNovaOpcaoEm] = useState<string | null>(null);
  /** Qual OPÇÃO está com o formulário de edição aberto. Uma por vez. */
  const [editandoOpcao, setEditandoOpcao] = useState<string | null>(null);
  /** Um grupo está com a ordem sendo gravada: as setas dele param. */
  const [reordenando, setReordenando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    const lista = await listProductOptionGroups(productId);
    setGrupos(lista);
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lista = await listProductOptionGroups(productId);
        if (!cancelled) setGrupos(lista);
      } catch (error) {
        /*
         * Os complementos são informação de apoio DESTE diálogo: não conseguir
         * lê-los não pode impedir a edição do nome e do preço, que é o que
         * trouxe o lojista até aqui. O que muda é o VALOR da falha: `grupos`
         * fica `null` (não sei) e a seção diz que não conseguiu ler, em vez
         * de afirmar que não há.
         */
        if (!cancelled) setErroDeLeitura(messageFromUnknownError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  /**
   * Liga/desliga uma opção.
   *
   * DEPOIS DO PATCH, RELÊ A LISTA. A resposta é a OPÇÃO
   * (`AdminOptionResponse`), que não diz nada sobre o grupo — se a tela
   * confiasse nela, o aviso de "saiu de venda" nunca apareceria, porque o dado
   * que o carrega não está ali.
   */
  /**
   * Liga ou desliga uma opção — com as duas falhas separadas, como `gravar`.
   *
   * ESTA ERA A IRMÃ QUE O §7 DE `ausencia.md` NÃO PEGOU, e ela é pior que a
   * dele. Os dois `await` dividiam um `catch`: a gravação passava, a releitura
   * caía, e a tela escrevia erro com o interruptor ainda no estado ANTIGO —
   * porque quem desenha o interruptor é `grupos`, e `grupos` não tinha mudado.
   *
   * Do lado de cá do balcão isso é "não deu certo", e a reação natural é clicar
   * de novo. Só que o segundo clique manda o valor OPOSTO: ele DESFAZ a
   * gravação que tinha funcionado. Não é duplicata, é reversão silenciosa — e o
   * que este interruptor decide é se a opção sai de venda, que num grupo
   * obrigatório tira o item inteiro do cardápio.
   *
   * A opção que o PATCH devolve entra na lista ANTES da releitura, e é isso que
   * torna a segunda falha inofensiva. A releitura continua valendo por causa do
   * efeito INDIRETO: se este clique esvaziou um grupo obrigatório, quem sabe é
   * o produto (`unavailable_by_required_group`), não a opção.
   */
  async function alternarOpcao(optionId: string, isActive: boolean) {
    setAlternando(optionId);
    setErro(null);
    setConfirmando(null);

    let salva;
    try {
      salva = await setOptionActive(optionId, isActive);
    } catch (error) {
      setErro(messageFromUnknownError(error));
      setAlternando(null);
      return;
    }

    // GRAVOU. Daqui para baixo nada pode dizer que não.
    setGrupos((atuais) => comOpcaoTrocada(atuais, salva));

    try {
      await recarregar();
      setErroDeLeitura(null);
    } catch {
      setErro(
        'Salvo. Não deu para reler os complementos agora — se este era o último ' +
          'ativo de um grupo obrigatório, a lista ainda não mostra isso.',
      );
    } finally {
      setAlternando(null);
    }
  }

  /**
   * O clique no interruptor da opção: às vezes pergunta antes.
   *
   * Só quando desativar ESTA opção deixa um grupo obrigatório sem nenhuma
   * ativa. Perguntar em todo clique é o que ensina o lojista a confirmar sem
   * ler — e é justamente este aviso que ele precisa ler.
   */
  function pedirAlternancia(optionId: string, optionName: string, isActive: boolean) {
    if (!grupos) return;
    if (!isActive) {
      const grupo = groupEmptiedByDeactivating(grupos, optionId);
      if (grupo) {
        setConfirmando({ optionId, optionName, groupName: grupo.name });
        return;
      }
    }
    void alternarOpcao(optionId, isActive);
  }

  /**
   * Gravar, e DEPOIS reler — com as duas falhas separadas.
   *
   * Antes, os dois `await` dividiam um `catch` só: se a gravação passava e a
   * RELEITURA caía, a tela escrevia a mensagem de erro e deixava o formulário
   * aberto, com o que o lojista digitou ainda na tela. Daqui do balcão isso é
   * indistinguível de "não salvou" — e a reação natural é apertar de novo, o
   * que cria o grupo DUAS VEZES.
   *
   * Agora o formulário fecha assim que a escrita passa, aconteça o que
   * acontecer com a segunda leitura, e a falha dela diz o que de fato houve:
   * gravou, e a lista abaixo é que pode estar velha.
   */
  /**
   * ==========================================================================
   * MOVER UMA OPÇÃO — e este é o único lugar da tela sem escrita atômica
   * ==========================================================================
   *
   * As categorias e os produtos têm `PATCH .../reorder`, que recebem a lista
   * completa de ids e renumeram tudo numa transação. As OPÇÕES não têm nada
   * equivalente: só `PATCH /admin/options/{option_id}`. Mover é, portanto, uma
   * requisição por opção que mudou de lugar — `ordemDasOpcoes` decide quais —,
   * e a segunda pode falhar com a primeira já gravada.
   *
   * O QUE ISSO OBRIGA: nesta falha a tela NÃO volta para a ordem anterior, como
   * `reorderProductTo` faz. Voltar seria afirmar que nada gravou, e alguma
   * coisa gravou — o servidor está numa ordem que ninguém pediu, e ela é a que
   * o cliente vê no cardápio. A tela relê e mostra o que EXISTE, dizendo o que
   * houve.
   *
   * AS ESCRITAS VÃO EM SÉRIE. Em paralelo elas seriam mais rápidas e a falha do
   * meio deixaria um estado sem ordem definida; em série, o que falhou é o
   * ponto onde parou. O número típico é dois (vizinhas trocadas), e o pior caso
   * é um grupo antigo com tudo em `sort_order: 0`, renumerado uma vez só.
   */
  async function moverOpcao(group: ProductOptionGroup, from: number, to: number) {
    const atuais = group.options ?? [];
    const reordenadas = moveInList(atuais, from, to);
    if (!reordenadas) return;

    setReordenando(group.id);
    setErro(null);
    // A lista muda na hora: o lojista clica a seta e vê a linha andar.
    setGrupos((lista) => comOpcoesDoGrupo(lista, group.id, reordenadas));

    try {
      for (const escrita of ordemDasOpcoes(reordenadas)) {
        await setOptionSortOrder(escrita.id, escrita.sort_order);
      }
    } catch (error) {
      setErro(
        `${messageFromUnknownError(error)} A ordem pode ter sido gravada pela metade — ` +
          'a lista abaixo foi relida do servidor.',
      );
      try {
        await recarregar();
      } catch {
        /* A releitura também caiu: o erro acima já diz para conferir. */
      }
      setReordenando(null);
      return;
    }

    /*
     * RELÊ MESMO TENDO DADO CERTO, e por um motivo que não é paranoia: quem
     * responde cada PATCH é a OPÇÃO, e o que a tela precisa é a lista na ordem
     * que o backend passou a ter. Sem isso, um `sort_order` que o servidor
     * ajustasse por conta própria só apareceria na próxima abertura do item.
     */
    try {
      await recarregar();
      setErroDeLeitura(null);
    } catch {
      setErro('Ordem salva. Não deu para reler a lista agora — feche e abra o item para conferir.');
    } finally {
      setReordenando(null);
    }
  }

  async function gravar(acao: () => Promise<unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      await acao();
    } catch (error) {
      setErro(messageFromUnknownError(error));
      setSalvando(false);
      return;
    }

    // GRAVOU. O que vem abaixo não pode mais desmentir isso.
    setEditando(null);
    setNovaOpcaoEm(null);
    setEditandoOpcao(null);
    try {
      await recarregar();
      setErroDeLeitura(null);
    } catch {
      setErro(
        'Salvo. Não deu para reler a lista agora — o que aparece abaixo pode estar ' +
          'desatualizado. Feche e abra o item para conferir.',
      );
    } finally {
      setSalvando(false);
    }
  }

  const grupoBloqueador = grupos ? blockingRequiredGroup(grupos) : null;

  return (
    <section className="form__section">
      <h3 className="form__section-title">Grupos de complemento</h3>

      {/*
        POR QUE O ITEM SUMIU DO CARDÁPIO SEM NINGUÉM DESLIGÁ-LO. Um grupo
        obrigatório sem nenhuma opção ativa tira o item de venda: `is_active`
        continua ligado, `is_available` continua ligado, e o cliente
        simplesmente não o vê. Sem esta faixa, a venda se perde em silêncio.
      */}
      {grupoBloqueador ? (
        <p className="alert alert--warn" data-testid="product-blocked-warning">
          Este item está fora de venda: o grupo obrigatório “{grupoBloqueador.name}” está sem
          nenhuma opção ativa. Reative uma opção dele para voltar ao cardápio.
        </p>
      ) : null}

      {erro ? (
        <p className="alert alert--error" role="alert" data-testid="grupos-erro">
          {erro}
        </p>
      ) : null}

      {erroDeLeitura ? (
        <p className="alert alert--error" role="alert" data-testid="grupos-leitura-erro">
          {erroDeLeitura} Os complementos deste item não foram lidos — o nome e o preço acima
          continuam editáveis.
        </p>
      ) : grupos === null ? (
        <p className="faint">Carregando…</p>
      ) : grupos.length === 0 && editando !== 'novo' ? (
        <p className="faint" data-testid="grupos-vazio">
          Nenhum grupo de complemento neste item.
          {podeEditar ? ' Crie um para pedir tamanho, ponto da carne ou adicionais.' : ''}
        </p>
      ) : (
        <ul className="groups" data-testid="grupos-lista">
          {(grupos ?? []).map((group) => (
            <li key={group.id} className="groups__item" data-testid={`grupo-${group.id}`}>
              {editando === group.id ? (
                <GrupoForm
                  inicial={group}
                  isSaving={salvando}
                  onCancel={() => setEditando(null)}
                  onSave={(corpo) => gravar(() => updateOptionGroup(group.id, corpo))}
                />
              ) : (
                <>
                  <div className="groups__name">
                    {group.name}
                    <span className="faint"> · {regraDoGrupo(group)}</span>
                    {podeEditar ? (
                      <button
                        type="button"
                        className="btn btn--sm groups__editar"
                        onClick={() => setEditando(group.id)}
                        data-testid={`grupo-editar-${group.id}`}
                      >
                        Editar regras
                      </button>
                    ) : null}
                  </div>
                  {group.description ? (
                    <p className="groups__descricao faint">{group.description}</p>
                  ) : null}
                </>
              )}

              <ul className="groups__options">
                {(group.options ?? []).map((option, indice, opcoes) =>
                  editandoOpcao === option.id ? (
                    <li key={option.id} className="groups__option-editando">
                      <OpcaoForm
                        inicial={option}
                        isSaving={salvando}
                        onCancel={() => setEditandoOpcao(null)}
                        onSave={(corpo) => gravar(() => updateOption(option.id, corpo))}
                      />
                    </li>
                  ) : (
                    <li key={option.id} className="groups__option">
                      <Switch
                        hideLabel
                        checked={option.is_active}
                        disabled={alternando !== null || !podeEditar}
                        onChange={(isActive) => pedirAlternancia(option.id, option.name, isActive)}
                        label={`${option.name} ativa`}
                      />
                      <span className="groups__option-name" data-testid={`opcao-nome-${option.id}`}>
                        {option.name}
                      </span>
                      {option.additional_price > 0 ? (
                        <span className="groups__option-price tnum faint">
                          +{formatCurrency(option.additional_price)}
                        </span>
                      ) : null}

                      {/*
                        AS SETAS E O LÁPIS, e as duas coisas são a mesma rota
                        (`PATCH /admin/options/{id}`, GERENCIA): quem edita
                        também ordena.

                        NÃO HÁ ARRASTE AQUI, ao contrário da lista de itens do
                        cardápio. Um grupo tem tipicamente três a oito opções e
                        vive DENTRO de um diálogo que já rola; um alvo de
                        arrastar dentro dele disputaria o gesto com a rolagem
                        do próprio diálogo no celular. Com as setas sendo o
                        caminho único, a WCAG 2.5.7 deixa de ser um problema:
                        não existe o arraste para o qual ela pede alternativa.

                        E elas ficam VISÍVEIS, sem depender de `:hover` — o
                        `revisao` §4 é sobre exatamente isto, e o lápis do
                        cardápio já custou essa lição no tablet do balcão.
                      */}
                      {podeEditar ? (
                        <span className="groups__option-acoes">
                          {opcoes.length > 1 ? (
                            <>
                              <button
                                type="button"
                                className="rail__chevron"
                                disabled={indice === 0 || reordenando !== null}
                                onClick={() => void moverOpcao(group, indice, indice - 1)}
                                aria-label={`Mover ${option.name} para cima`}
                                title="Mover para cima"
                                data-testid={`opcao-subir-${option.id}`}
                              >
                                <ChevronUpIcon size={14} />
                              </button>
                              <button
                                type="button"
                                className="rail__chevron"
                                disabled={indice === opcoes.length - 1 || reordenando !== null}
                                onClick={() => void moverOpcao(group, indice, indice + 1)}
                                aria-label={`Mover ${option.name} para baixo`}
                                title="Mover para baixo"
                                data-testid={`opcao-descer-${option.id}`}
                              >
                                <ChevronDownIcon size={14} />
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost icon-btn"
                            onClick={() => {
                              setEditandoOpcao(option.id);
                              setNovaOpcaoEm(null);
                            }}
                            aria-label={`Editar ${option.name}`}
                            title="Editar opção"
                            data-testid={`opcao-editar-${option.id}`}
                          >
                            <EditIcon />
                          </button>
                        </span>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>

              {/*
                A CONFIRMAÇÃO É EM LINHA, COLADA NA OPÇÃO — e isso é herança de
                uma decisão que já estava certa aqui.

                Antes, ela TROCAVA o conteúdo do `ProductDialog` inteiro, para
                não empilhar modal sobre modal (no celular o diálogo é a tela).
                Com a seção fora do diálogo, aquele truque deixou de estar ao
                alcance — e um `<Modal>` aninhado seria exatamente o que a
                versão anterior evitou.

                Em linha resolve melhor que os dois: ela nasce ONDE O DEDO
                ESTAVA, com o grupo e a opção à vista, em vez de num retângulo
                que esconde o que ele está falando.
              */}
              {confirmando?.optionId &&
              (group.options ?? []).some((o) => o.id === confirmando.optionId) ? (
                <div className="groups__confirmar" data-testid="grupo-confirmar">
                  <p className="alert alert--warn">
                    “{confirmando.optionName}” é a última opção ativa do grupo obrigatório “
                    {confirmando.groupName}”. Sem nenhuma opção nele, o item sai do cardápio do
                    cliente e some da vitrine — mesmo continuando ativo e disponível aqui.
                  </p>
                  <div className="groups__form-acoes">
                    <button type="button" className="btn" onClick={() => setConfirmando(null)}>
                      Manter ativa
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      data-testid="confirm-deactivate-option"
                      onClick={() => void alternarOpcao(confirmando.optionId, false)}
                    >
                      Desativar mesmo assim
                    </button>
                  </div>
                </div>
              ) : null}

              {novaOpcaoEm === group.id ? (
                <OpcaoForm
                  /* A nova entra no FIM: a ordem da lista é a que o lojista montou. */
                  sortOrder={(group.options ?? []).length}
                  isSaving={salvando}
                  onCancel={() => setNovaOpcaoEm(null)}
                  onSave={(corpo) => gravar(() => createOption(group.id, corpo))}
                />
              ) : podeEditar ? (
                <button
                  type="button"
                  className="btn btn--sm groups__nova-opcao"
                  onClick={() => setNovaOpcaoEm(group.id)}
                  data-testid={`opcao-nova-${group.id}`}
                >
                  <PlusIcon />
                  Nova opção
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && !erroDeLeitura ? (
        editando === 'novo' ? (
          <GrupoForm
            /* O grupo novo entra no FIM, como a opção nova entra no fim do grupo. */
            sortOrderNovo={(grupos ?? []).length}
            isSaving={salvando}
            onCancel={() => setEditando(null)}
            onSave={(corpo) =>
              gravar(() =>
                createOptionGroup(productId, {
                  ...corpo,
                  /*
                   * O `create` do contrato exige número, e aqui ele SEMPRE tem:
                   * `grupoVazio(grupos.length)` o preenche. O `?? 0` é para o
                   * compilador, não um buraco tapado — grupo novo não herda
                   * posição de ninguém.
                   */
                  sort_order: corpo.sort_order ?? 0,
                }),
              )
            }
          />
        ) : (
          <button
            type="button"
            className="btn btn--primary form__add"
            onClick={() => setEditando('novo')}
            data-testid="grupo-novo"
          >
            <PlusIcon />
            Novo grupo de complemento
          </button>
        )
      ) : null}
    </section>
  );
}

/**
 * O formulário de uma opção — o MESMO para criar e para editar.
 *
 * Três campos em linha, o padrão de `NewMethodForm` em Loja › Pagamento. Uma
 * opção é a coisa mais frequente que se acrescenta a um cardápio ("mais um
 * sabor"), e um diálogo por sabor seria um diálogo por minuto.
 *
 * UM COMPONENTE E NÃO DOIS, e a razão não é economia de linhas: dois
 * formulários divergem, e a divergência aqui seria a tela aceitar na edição um
 * nome que ela recusa na criação (`revisao` §1). A validação é a mesma função
 * (`checkOpcaoEdicao`), e o que muda entre os modos é o que sai dela.
 *
 * O QUE O MODO DE EDIÇÃO NÃO MANDA, e é a parte que custaria caro:
 *
 *   - `is_active`, porque quem o decide é o interruptor da mesma linha. O corpo
 *     da criação leva `is_active: true` fixo; reusá-lo aqui RELIGARIA em
 *     silêncio a opção que o lojista tinha acabado de desligar.
 *   - `sort_order`, porque quem o decide são as setas. Este formulário não
 *     mostra posição, e mandá-la seria reordenar por conta própria com um valor
 *     que pode ter envelhecido enquanto ele estava aberto.
 *
 * As duas ausências só são seguras porque `PATCH /admin/options/{id}` é parcial
 * de verdade — o vizinho `PATCH /admin/option-groups/{id}` valida a MESCLA e
 * por isso exige o formulário inteiro (`rapidex-api` §4.9). Ver
 * `option-groups.ts`.
 */
function OpcaoForm(
  props:
    | {
        /** Quantas opções o grupo já tem: a nova entra depois delas. */
        sortOrder: number;
        inicial?: undefined;
        isSaving: boolean;
        onCancel: () => void;
        onSave: (corpo: OptionCreateBody) => void;
      }
    | {
        sortOrder?: undefined;
        /** A opção gravada: o formulário abre com ela. */
        inicial: ProductOption;
        isSaving: boolean;
        onCancel: () => void;
        onSave: (corpo: OptionEditBody) => void;
      },
) {
  const { inicial, isSaving, onCancel } = props;
  const [draft, setDraft] = useState<OpcaoDraft>(() =>
    inicial ? opcaoDraftDe(inicial) : opcaoVazia(),
  );
  const check = checkOpcaoEdicao(draft);

  /*
   * O MODO DECIDE O CORPO, e é o único lugar onde os dois se separam: a edição
   * manda os três campos que este formulário mostra; a criação manda os mesmos
   * três mais os dois que só existem quando a opção nasce.
   */
  function salvar() {
    if (props.inicial !== undefined) {
      const edicao = checkOpcaoEdicao(draft);
      if (edicao.valid) props.onSave(edicao.opcao);
      return;
    }
    const criacao = checkOpcao(draft, props.sortOrder);
    if (criacao.valid) props.onSave(criacao.opcao);
  }

  return (
    <div className="groups__form" data-testid="opcao-form">
      <label className="field">
        <span className="field__label">Nome da opção</span>
        <input
          className="input"
          autoFocus
          maxLength={GRUPO_NOME_MAX}
          placeholder="Ex.: Bacon"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          data-testid="opcao-nome"
        />
      </label>

      {/*
        A DESCRIÇÃO ENTROU COM A EDIÇÃO, e ela precisava entrar: o corpo do
        PATCH leva `description`, e um formulário que não a mostrasse mandaria
        `null` toda vez que alguém corrigisse um preço — APAGANDO o texto que
        outra pessoa escreveu, sem nada em tela dizendo isso (`revisao` §2).
      */}
      <label className="field">
        <span className="field__label">Descrição</span>
        <input
          className="input"
          maxLength={GRUPO_DESCRICAO_MAX}
          placeholder="Ex.: duas fatias"
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          data-testid="opcao-descricao"
        />
        <span className="field__hint">Opcional. Aparece para o cliente ao lado do nome.</span>
      </label>

      <label className="field">
        <span className="field__label">Preço adicional</span>
        <input
          className="input"
          inputMode="decimal"
          placeholder="0,00"
          value={draft.price}
          onChange={(event) => setDraft({ ...draft, price: event.target.value })}
          data-testid="opcao-preco"
        />
        {/* Em branco é zero, e é o caso comum: "ponto da carne" não custa nada. */}
        <span className="field__hint">Em branco não cobra nada a mais.</span>
      </label>

      {!check.valid && check.message ? (
        <p className="field__error-text" role="alert">
          {check.message}
        </p>
      ) : null}

      <div className="groups__form-acoes">
        <button type="button" className="btn" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!check.valid || isSaving}
          onClick={salvar}
          data-testid="opcao-salvar"
        >
          {isSaving ? 'Salvando…' : inicial ? 'Salvar opção' : 'Adicionar opção'}
        </button>
      </div>
    </div>
  );
}
