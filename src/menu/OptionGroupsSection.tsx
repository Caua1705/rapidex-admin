import { useCallback, useEffect, useState } from 'react';

import {
  createOption,
  createOptionGroup,
  listProductOptionGroups,
  setOptionActive,
  updateOptionGroup,
} from '../api/menu';
import { messageFromUnknownError } from '../api/errors';
import type { OptionCreateBody, ProductOptionGroup } from '../api/types';
import { Switch } from '../ds/Switch';
import { PlusIcon } from '../ds/icons';
import { formatCurrency } from '../orders/format';
import { GrupoForm } from './OptionGroupForm';
import { blockingRequiredGroup, groupEmptiedByDeactivating } from './required-groups';
import {
  GRUPO_NOME_MAX,
  checkOpcao,
  comOpcaoTrocada,
  opcaoVazia,
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
                {(group.options ?? []).map((option) => (
                  <li key={option.id} className="groups__option">
                    <Switch
                      hideLabel
                      checked={option.is_active}
                      disabled={alternando !== null || !podeEditar}
                      onChange={(isActive) => pedirAlternancia(option.id, option.name, isActive)}
                      label={`${option.name} ativa`}
                    />
                    <span className="groups__option-name">{option.name}</span>
                    {option.additional_price > 0 ? (
                      <span className="groups__option-price tnum faint">
                        +{formatCurrency(option.additional_price)}
                      </span>
                    ) : null}
                  </li>
                ))}
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
 * O formulário de uma opção nova.
 *
 * Dois campos e um preço, em linha — o padrão de `NewMethodForm` em Loja ›
 * Pagamento. Uma opção é a coisa mais frequente que se acrescenta a um cardápio
 * ("mais um sabor"), e um diálogo por sabor seria um diálogo por minuto.
 */
function OpcaoForm({
  sortOrder,
  isSaving,
  onCancel,
  onSave,
}: {
  /** Quantas opções o grupo já tem: a nova entra depois delas. */
  sortOrder: number;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (corpo: OptionCreateBody) => void;
}) {
  const [draft, setDraft] = useState<OpcaoDraft>(opcaoVazia());
  const check = checkOpcao(draft, sortOrder);

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
          onClick={() => check.valid && onSave(check.opcao)}
          data-testid="opcao-salvar"
        >
          {isSaving ? 'Salvando…' : 'Adicionar opção'}
        </button>
      </div>
    </div>
  );
}
