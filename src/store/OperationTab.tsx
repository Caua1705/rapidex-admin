import { useState } from 'react';

import { usePermissoes } from '../auth/use-permissions';
import { Switch } from '../ds/Switch';
import type { BranchOperation } from '../api/types';
import { DeliveryPauseDialog } from './DeliveryPauseDialog';
import { estaNoAr, notaDaPausa, pausaAtiva, situacaoDaFilial } from './operation-state';
import type { useBranchOperation } from './useBranchOperation';

/**
 * O ESTADO DO DIA, UMA LINHA POR FILIAL.
 *
 * Enquanto `is_open` era do restaurante, esta tela era um interruptor: fechar
 * a loja do Centro fechava a da Aldeota junto, e a pergunta "quais das minhas
 * lojas estão no ar agora?" não tinha onde ser respondida. É a conferência que
 * a tela existe para dar, e é por isso que o interruptor do cabeçalho não
 * bastava: ele opera UMA filial, a que o seletor está exibindo.
 *
 * Quem está preso a uma filial recebe uma lista de um item — a mesma tela serve
 * aos dois casos sem conhecer a regra de escopo, que mora no token.
 *
 * OS RÓTULOS FICAM NO CABEÇALHO DA LISTA, não em cada linha. Três palavras
 * repetidas em cinco linhas ocupam a largura do que muda sem distinguir nada
 * (§8 do design); no alto, elas nomeiam a coluna uma vez.
 */
export function OperationTab({ operation }: { operation: ReturnType<typeof useBranchOperation> }) {
  if (operation.isLoading) return <p className="muted store__loading">Carregando as filiais…</p>;

  if (operation.loadError)
    return (
      <p className="alert alert--error" role="alert">
        {operation.loadError}
      </p>
    );

  const linhas = operation.branches ?? [];

  if (linhas.length === 0)
    return <p className="muted store__loading">Nenhuma filial ativa para operar.</p>;

  return (
    <div className="op-list" data-testid="operation-list">
      <div className="op-head" aria-hidden="true">
        <span />
        <span />
        <span />
        <span className="t-label op-head__col">Entrega</span>
        <span className="t-label op-head__col">Retirada</span>
        <span className="t-label op-head__col">Aberta</span>
        {/* A coluna da ação não tem rótulo: o botão diz o que faz. */}
        <span />
      </div>

      <ul className="op-rows">
        {linhas.map((linha) => (
          <OperationRow key={linha.branch_id} linha={linha} operation={operation} />
        ))}
      </ul>
    </div>
  );
}

/**
 * A frase da linha — e ela responde uma pergunta só: por que esta loja não está
 * recebendo pedido?
 *
 * Vazia nos dois estados que a própria linha já mostra: com a chave desligada, o
 * interruptor é a resposta, e escrever "fechada" ao lado dele é a palavra que se
 * repete sem distinguir nada. Quem decide qual estado é este é
 * `operation-state.ts`; aqui só se escolhe a frase curta de cada um.
 */
const NOTA: Record<ReturnType<typeof situacaoDaFilial>, string> = {
  'no-ar': '',
  fechada: '',
  desconhecida: '',
  'fora-do-horario': 'Fora do horário de hoje',
  /*
   * A CONSEQUÊNCIA, não o estado: "sem entrega e sem retirada" é o que as duas
   * chaves desligadas ao lado já dizem, e escrito por extenso ele quebrava em
   * três linhas — uma linha de lista com o triplo da altura das outras.
   */
  'sem-forma-de-comprar': 'Ninguém consegue comprar',
};

function OperationRow({
  linha,
  operation,
}: {
  linha: BranchOperation;
  operation: ReturnType<typeof useBranchOperation>;
}) {
  /*
   * O PONTO DIZ "ESTÁ ENTRANDO PEDIDO", NÃO "A CHAVE ESTÁ LIGADA".
   *
   * Desligar entrega e retirada equivale a fechar a loja, mas não FICA igual a
   * fechar: a chave continua ligada, e um ponto que só olhasse `is_open`
   * continuaria aceso numa loja em que ninguém consegue comprar. A frase ao
   * lado explica; quem informa de longe é o ponto.
   */
  const { pode } = usePermissoes();
  const [pausando, setPausando] = useState(false);

  const noAr = estaNoAr(linha);
  const erro = operation.errorFor(linha.branch_id);

  /*
   * A NOTA DA PAUSA VENCE A DA SITUAÇÃO, e é a única com essa prioridade.
   *
   * A pausa é o único estado desta tela que se desfaz SOZINHO, e é justamente
   * por isso que ninguém lembra dela: quem pausou às 19h por causa de chuva não
   * volta ao painel para conferir, e o único sintoma de uma pausa esquecida é a
   * ausência de pedido — que não acende alarme nenhum. Ela precisa estar
   * escrita mesmo quando a loja já tem outro problema, porque é a que explica
   * "por que parou de entrar pedido de entrega".
   */
  const pausada = pausaAtiva(linha);
  const nota = notaDaPausa(linha) ?? NOTA[situacaoDaFilial(linha)];

  return (
    <li
      className={`op-row${noAr ? ' op-row--on' : ''}`}
      data-testid={`operation-row-${linha.branch_id}`}
      data-open={linha.is_open}
      data-open-now={linha.is_open_now}
      data-no-ar={noAr}
    >
      <span className="op-row__dot" aria-hidden="true" />

      <span className="op-row__name">{linha.branch_name}</span>

      {erro ? (
        <span className="op-row__note op-row__note--error" role="alert">
          {erro}
        </span>
      ) : (
        <span
          className={`op-row__note${pausada ? ' op-row__note--pausa' : ''}`}
          data-testid={`operation-note-${linha.branch_id}`}
        >
          {nota}
        </span>
      )}

      {/*
        AS TRÊS CHAVES SÃO UM GRUPO, e o grupo é `display: contents` na tela
        larga: cada uma cai numa coluna da grade e as três alinham entre as
        linhas. No celular ele vira uma linha própria, onde os rótulos do
        cabeçalho não caberiam.
      */}
      <span className="op-row__chaves">
        <Chave
          campo="accepts_delivery"
          rotulo="Entrega"
          linha={linha}
          valor={linha.accepts_delivery}
          operation={operation}
        />
        <Chave
          campo="accepts_pickup"
          rotulo="Retirada"
          linha={linha}
          valor={linha.accepts_pickup}
          operation={operation}
        />
        <Chave
          campo="is_open"
          rotulo="Aberta"
          linha={linha}
          valor={linha.is_open}
          operation={operation}
        />
      </span>

      {/*
        PAUSAR É DE QUEM OPERA, e o botão só existe para quem faz entrega: numa
        filial que não entrega, "pausar a entrega" é um controle que não muda
        nada. Pausada, ele vira o botão de RETOMAR — que é o de quem parou por
        60 minutos e resolveu em 20, e é um clique só porque nessa hora ninguém
        preenche formulário.
      */}
      {pode('loja.pausarEntrega') && linha.accepts_delivery ? (
        <span className="op-row__pausa">
          {pausada ? (
            <button
              type="button"
              className="btn btn--sm"
              disabled={operation.isSaving(linha.branch_id, 'pause')}
              onClick={() => void operation.pause(linha.branch_id, 0, '')}
              data-testid={`operation-resume-${linha.branch_id}`}
            >
              {operation.isSaving(linha.branch_id, 'pause') ? 'Retomando…' : 'Retomar entrega'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setPausando(true)}
              data-testid={`operation-pause-${linha.branch_id}`}
            >
              Pausar entrega
            </button>
          )}
        </span>
      ) : null}

      {pausando ? (
        <DeliveryPauseDialog
          branchName={linha.branch_name}
          isSending={operation.isSaving(linha.branch_id, 'pause')}
          errorMessage={erro}
          onClose={() => setPausando(false)}
          onConfirm={(minutos, motivo) => {
            void operation.pause(linha.branch_id, minutos, motivo).then((ok) => {
              if (ok) setPausando(false);
            });
          }}
        />
      ) : null}
    </li>
  );
}

/**
 * Um dos três interruptores da linha.
 *
 * O rótulo visível está no cabeçalho da lista; o nome ACESSÍVEL de cada
 * interruptor traz a filial junto, porque numa lista de cinco lojas "Entrega"
 * sozinho não diz de qual loja se está falando. No celular, onde o cabeçalho de
 * coluna não cabe, o mesmo rótulo aparece ao lado do controle.
 */
function Chave({
  campo,
  rotulo,
  linha,
  valor,
  operation,
}: {
  campo: 'is_open' | 'accepts_delivery' | 'accepts_pickup';
  rotulo: string;
  linha: BranchOperation;
  valor: boolean;
  operation: ReturnType<typeof useBranchOperation>;
}) {
  const { pode } = usePermissoes();

  /*
   * OS TRÊS INTERRUPTORES DA LINHA SÃO DUAS PERMISSÕES DIFERENTES.
   *
   * Abrir e fechar a loja é `PATCH .../store-status`, de quem opera — é a ação
   * do sábado à noite, e quem está lá é quem a aperta. Ligar e desligar entrega
   * e retirada é `PATCH .../order-types`, da gerência: é decisão de como a loja
   * vende, não de como ela está agora.
   *
   * O INTERRUPTOR SOME E O ESTADO FICA. Sem o controle, a coluna continua
   * dizendo se a loja aceita entrega — some o que a muda, não o que ela é. Um
   * `Switch` desabilitado seria pior nas duas pontas: ele parece quebrado e
   * continua parecendo apertável.
   */
  const podeMexer =
    campo === 'is_open' ? pode('loja.abrirFechar') : pode('loja.editarTiposDePedido');

  if (!podeMexer) {
    return (
      <span className="op-row__chave">
        <span className="op-row__chave-rotulo t-aux" aria-hidden="true">
          {rotulo}
        </span>
        <span className="t-aux" data-testid={`operation-${campo}-${linha.branch_id}-leitura`}>
          {valor ? 'Sim' : 'Não'}
          <span className="sr-only">
            {' '}
            — {rotulo}: {linha.branch_name}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="op-row__chave">
      <span className="op-row__chave-rotulo t-aux" aria-hidden="true">
        {rotulo}
      </span>
      <Switch
        hideLabel
        checked={valor}
        loading={operation.isSaving(linha.branch_id, campo)}
        onChange={(next) => void operation.toggle(linha.branch_id, campo, next)}
        label={`${rotulo}: ${linha.branch_name}`}
        data-testid={`operation-${campo}-${linha.branch_id}`}
      />
    </span>
  );
}
