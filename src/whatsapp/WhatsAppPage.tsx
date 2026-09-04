import { useState, type ReactNode } from 'react';

import type { WhatsAppChannel } from '../api/types';
import { usePermissoes } from '../auth/use-permissions';
import { DataTable, HelpPopover, PageBar, type Column } from '../ds';
import { AlertIcon, PlusIcon } from '../ds/icons';
import { formatDateTime } from '../orders/format';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConnectChannelDialog } from './ConnectChannelDialog';
import {
  filialForaDaLista,
  lojasQueDependem,
  lojasSemAviso,
  lugarDoCanal,
  podeDesconectar,
  podeReconectar,
  rascunhoDeReconexao,
  rascunhoNovo,
  situacaoDaLoja,
  type CanalDraft,
} from './whatsapp-model';
import { useWhatsAppChannels } from './useWhatsAppChannels';
import './WhatsAppPage.css';

type LinhaDeLoja = {
  id: string;
  loja: ReactNode;
  numero: ReactNode;
  origem: ReactNode;
  situacao: ReactNode;
};

type LinhaDeCanal = {
  id: string;
  numero: ReactNode;
  lugar: ReactNode;
  conta: ReactNode;
  situacao: ReactNode;
  acoes: ReactNode;
};

/*
 * A largura das colunas não vem daqui, e sim de `WhatsAppPage.css`: `width`
 * existe em `ds/DataTable`, mas usá-lo significaria escrever "180px" dentro do
 * TSX, e a régua de aderência barra px solto no código de tela. Mesma decisão
 * de `UsersPage`, `CouponsPage` e `CustomersPage`.
 */
const COLUNAS_DE_LOJA: readonly Column<LinhaDeLoja>[] = [
  { key: 'loja', header: 'Loja' },
  { key: 'numero', header: 'Número' },
  { key: 'origem', header: 'De onde vem' },
  { key: 'situacao', header: 'Situação' },
];

const COLUNAS_DE_CANAL: readonly Column<LinhaDeCanal>[] = [
  { key: 'numero', header: 'Número' },
  { key: 'lugar', header: 'Onde vale' },
  { key: 'conta', header: 'Conta' },
  { key: 'situacao', header: 'Situação' },
  { key: 'acoes', header: 'Ações', align: 'end', headerHidden: true },
];

/**
 * ============================================================================
 * WHATSAPP — por qual número cada loja avisa o cliente
 * ============================================================================
 *
 * ESTA TELA É DE DUAS PERGUNTAS, e a ordem entre elas é a decisão principal.
 *
 * A lista de NÚMEROS é o que existe no banco. A lista de LOJAS é o que o dono
 * de fato quer saber — "esta loja avisa o cliente?" —, e nenhuma lista de
 * números a responde: uma filial sem linha própria aparece na primeira como
 * AUSÊNCIA, e pode estar herdando o número do restaurante e funcionando
 * perfeitamente. Por isso as lojas vêm primeiro e os números depois: a
 * consequência antes do cadastro.
 *
 * ----------------------------------------------------------------------------
 * AS DUAS COISAS QUE ESTA TELA EXISTE PARA NÃO DEIXAR PASSAR
 * ----------------------------------------------------------------------------
 *
 * **1. Filial sem número HERDA o do restaurante.** Sem dizê-lo, a coluna vazia
 * lê como "esta loja está sem WhatsApp" e o dono vai cadastrar um segundo
 * número para uma loja que já estava avisando — ou, pior, desligar a campanha
 * achando que ela nunca esteve no ar.
 *
 * **2. "Nunca conectou" e "conectou e caiu" são a mesma ausência na tela e são
 * consertos opostos.** A primeira pede cadastro; a segunda tem um cliente de
 * ontem que foi avisado e um de hoje que não foi, sem erro em lugar nenhum. A
 * separação inteira mora em `whatsapp-model.ts`, e o que chega aqui é a frase.
 *
 * ----------------------------------------------------------------------------
 * O SELETOR DE FILIAL DO TOPO NÃO RECORTA ESTA TELA
 * ----------------------------------------------------------------------------
 *
 * A rota aceita `branch_id` e o painel não o manda, de propósito: o contrato
 * diz que a forma sem recorte "é a principal, porque o dono precisa do mapa,
 * não de uma loja por vez". Trocar de filial para descobrir se cada uma tem
 * WhatsApp é o oposto do que esta tela faz. É a mesma decisão de Usuários, e a
 * ressalva ao lado do título a diz em voz alta.
 *
 * ----------------------------------------------------------------------------
 * QUEM PODE O QUÊ
 * ----------------------------------------------------------------------------
 *
 * Ler é GERÊNCIA, conectar e desconectar são SOMENTE DO DONO. Para o gerente
 * some o CONTROLE e fica o DADO — ele abre a tela para responder ao cliente que
 * ligou dizendo não ter recebido o aviso, que é a razão de a leitura ser dele.
 */
export function WhatsAppPage() {
  const { pode } = usePermissoes();
  const { canais, lojas, isLoading, isSaving, errorMessage, conectar, desconectar } =
    useWhatsAppChannels();

  const [conectando, setConectando] = useState<{
    draft: CanalDraft;
    modo: 'novo' | 'reconexao';
    canal: WhatsAppChannel | null;
  } | null>(null);
  const [desconectando, setDesconectando] = useState<WhatsAppChannel | null>(null);
  /* O erro da desconexão vive no diálogo, que não fecha com ele: recusada a
     ação, a pessoa precisa ler o que aconteceu antes de sair. */
  const [erroDaSaida, setErroDaSaida] = useState<string | null>(null);

  const podeConectar = pode('whatsapp.conectar');
  const podeSair = pode('whatsapp.desconectar');

  const mudas = lojasSemAviso(lojas);

  function abrirNovo() {
    setConectando({ draft: rascunhoNovo(), modo: 'novo', canal: null });
  }

  function abrirReconexao(canal: WhatsAppChannel) {
    setConectando({ draft: rascunhoDeReconexao(canal), modo: 'reconexao', canal });
  }

  const linhasDeLoja: LinhaDeLoja[] = lojas.map((loja) => {
    const situacao = situacaoDaLoja(loja, canais);
    return {
      id: loja.branch_id,
      loja: <span className="whatsapp__nome">{loja.branch_name}</span>,
      numero: situacao.numero ? (
        <span className="whatsapp__numero">{situacao.numero}</span>
      ) : (
        <span className="faint">—</span>
      ),
      origem: (
        <span className="whatsapp__origem">
          <span>{situacao.resumo}</span>
          {situacao.detalhe ? <span className="t-aux">{situacao.detalhe}</span> : null}
        </span>
      ),
      /*
       * "NÃO AVISA" LEVA `.tag--alerta`, e é o caso que a variante existe para
       * cobrir: o estado que ninguém escolheu para AQUELA loja.
       *
       * Mesmo quando alguém desconectou o número de propósito, o que ninguém
       * escolheu é a consequência — a filial NÃO cai no número do restaurante,
       * ao contrário do que "herança" quer dizer no resto do painel. Vestida
       * como as outras etiquetas, numa tabela de seis lojas, ela lê como estado
       * normal da operação e passa batido; e passar batido aqui significa o
       * dono seguir acreditando que o cliente está sendo avisado.
       */
      situacao: situacao.avisa ? (
        <span className="tag" data-testid={`whatsapp-avisa-${loja.branch_id}`}>
          Avisa o cliente
        </span>
      ) : (
        <span className="tag tag--alerta" data-testid={`whatsapp-nao-avisa-${loja.branch_id}`}>
          <AlertIcon size={12} aria-hidden="true" />
          Não avisa
        </span>
      ),
    };
  });

  const linhasDeCanal: LinhaDeCanal[] = canais.map((canal) => ({
    id: canal.id,
    numero: (
      <span className="whatsapp__celula">
        <span className="whatsapp__numero">{canal.display_phone_number}</span>
        {/* O `phone_number_id` é o que o suporte pede num chamado, e é o único
            jeito de separar duas linhas com o mesmo número escrito diferente. */}
        <span className="t-aux">ID {canal.phone_number_id}</span>
      </span>
    ),
    /*
      O LUGAR — e a única célula desta tabela que precisa EXPLICAR uma ausência.

      Um canal cuja filial foi desativada volta do backend com `branch_name`
      nulo (`list_channels` monta o mapa de nomes só com as ativas). Dizer
      "Filial", seco, era um número CONECTADO num lugar sem nome: o dono não
      achava aquela loja em lista nenhuma do painel e não tinha como saber se
      o número ainda mandava alguma coisa. Quem responde isso é a segunda
      linha; o botão de desconectar continua ali ao lado, porque o `DELETE` é
      por CANAL — desativar a loja não tira do dono o controle do número.
    */
    lugar: filialForaDaLista(canal) ? (
      <span className="whatsapp__celula">
        <span>{lugarDoCanal(canal)}</span>
        <span className="t-aux">Não aparece na sua lista de filiais.</span>
      </span>
    ) : (
      lugarDoCanal(canal)
    ),
    conta: <span className="whatsapp__conta">{canal.waba_id_masked}</span>,
    situacao: (
      <span className="whatsapp__celula">
        {/*
          A ETIQUETA SAI DO `status_label` DO BACKEND — a tela não monta a frase
          a partir do enum. O que ela decide pelo código é a ROUPA: desligar no
          painel é escolha de alguém e sai neutro; a desconexão pela Meta não é
          escolha de ninguém daqui e é a única cujo conserto não é nosso.
        */}
        {canal.status === 'disconnected_by_meta' ? (
          <span className="tag tag--alerta" data-testid={`whatsapp-status-${canal.id}`}>
            <AlertIcon size={12} aria-hidden="true" />
            {canal.status_label}
          </span>
        ) : (
          <span className="tag" data-testid={`whatsapp-status-${canal.id}`}>
            {canal.status_label}
          </span>
        )}

        {canal.status_action ? <span className="t-aux">{canal.status_action}</span> : null}

        {/*
          A DATA SÓ APARECE ONDE ELA É VERDADE, E SÃO DOIS CASOS DE TRÊS.

          `connected_at` NÃO é uma coluna: o backend o monta como
          `canal.updated_at or canal.created_at`, e `updated_at` tem
          `onupdate=func.now()`. Desconectar escreve `is_active = False` na
          linha — então o próprio 200 do `DELETE` já volta com `connected_at`
          valendo O INSTANTE DA DESCONEXÃO.

          A primeira versão desta célula escrevia "No ar desde 25/08" embaixo de
          "Desligado no painel" — duas frases que se contradizem, e a de baixo é
          a que tem número, que é a que se acredita. A segunda trocou por
          "Conectado em 25/08", o que é PIOR: continua sendo uma data errada,
          agora com uma frase que soa exata.

          Então, desligado no painel, a tela não diz data nenhuma. O que ela tem
          para essa linha é "quando alguém mexeu nela pela última vez", e isso
          não responde a pergunta que o dono faz ("há quanto tempo este número
          está fora?"). Falta coluna no backend, e está pedido em
          `scratchpad/pedidos-ao-backend.md` §4.

          Os outros dois são confiáveis: no ar, a última escrita FOI a conexão;
          desconectado pela Meta, `disconnected_at` é coluna própria, escrita
          pelo webhook e nunca sobrescrita num reenvio.
        */}
        {canal.disconnected_at ? (
          <span className="t-aux">Fora desde {formatDateTime(canal.disconnected_at)}</span>
        ) : canal.status === 'connected' ? (
          <span className="t-aux">No ar desde {formatDateTime(canal.connected_at)}</span>
        ) : null}

        {/* O motivo vem CRU da Meta (`PARTNER_REMOVED`) de propósito: é o que se
            cita num chamado com o suporte deles. */}
        {canal.disconnect_reason ? (
          <span className="t-aux">Motivo da Meta: {canal.disconnect_reason}</span>
        ) : null}
      </span>
    ),
    acoes: (
      <span className="whatsapp__acoes">
        {podeConectar && podeReconectar(canal.status) ? (
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => abrirReconexao(canal)}
            disabled={isSaving}
            data-testid={`whatsapp-reconectar-${canal.id}`}
          >
            Conectar de novo
          </button>
        ) : null}

        {podeSair && podeDesconectar(canal.status) ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost-danger"
            onClick={() => {
              setErroDaSaida(null);
              setDesconectando(canal);
            }}
            disabled={isSaving}
            data-testid={`whatsapp-desconectar-${canal.id}`}
          >
            Desconectar
          </button>
        ) : null}
      </span>
    ),
  }));

  const dependentes = desconectando ? lojasQueDependem(desconectando, lojas) : [];

  return (
    <div className="whatsapp">
      <PageBar
        title="WhatsApp"
        aside={
          <span className="whatsapp__escopo-grupo">
            <span className="t-aux whatsapp__escopo" data-testid="whatsapp-escopo">
              esta tela é do restaurante inteiro — o seletor de filial do topo não a recorta
            </span>

            <HelpPopover
              label="Como funciona o aviso"
              title="Como funciona o aviso"
              data-testid="whatsapp-ajuda"
            >
              <p className="t-aux">
                <strong>São quatro avisos, e só quatro.</strong> O cliente recebe quando o pedido é{' '}
                <strong>aceito</strong>; quando fica <strong>pronto para retirada</strong> (só na
                retirada); quando <strong>sai para entrega</strong> e quando é{' '}
                <strong>entregue</strong> (só na entrega). Nenhuma outra mudança de status manda
                mensagem.
              </p>
              <p className="t-aux">
                <strong>Filial sem número usa o do restaurante.</strong> É o padrão da rede: quem
                não tem linha própria fala pela do restaurante, e isso está certo — não é loja sem
                WhatsApp.
              </p>
              <p className="t-aux">
                <strong>Número próprio desligado NÃO cai no do restaurante.</strong> Aquela loja
                simplesmente para de avisar, que é o que se espera de um número desligado — mas é o
                contrário do que "herança" sugere.
              </p>
              <p className="t-aux">
                <strong>Desconectado pela Meta é o único que não se conserta aqui.</strong> O acesso
                da Cloud API foi removido no WhatsApp da loja; é preciso religar por lá e só então
                conectar o número de novo nesta tela.
              </p>
              <p className="t-aux">
                <strong>O token não volta.</strong> Ele entra uma vez, fica cifrado e nenhuma tela o
                mostra de novo — nem para o proprietário. Segunda via é gerar outro na Meta e
                conectar de novo.
              </p>
              <p className="t-aux">
                <strong>Esta tela não mostra mensagens.</strong> Não há histórico de quem recebeu o
                quê, nem reenvio manual: o reenvio do que falhou é automático, do lado do servidor.
              </p>
            </HelpPopover>
          </span>
        }
        meta={
          !isLoading ? (
            <span className="t-aux" data-testid="whatsapp-contagem">
              {lojas.length === 1 ? '1 loja' : `${lojas.length} lojas`} ·{' '}
              {canais.length === 1 ? '1 número' : `${canais.length} números`}
            </span>
          ) : null
        }
      >
        {podeConectar ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={abrirNovo}
            data-testid="whatsapp-novo"
          >
            <PlusIcon size={14} aria-hidden="true" />
            Conectar número
          </button>
        ) : null}
      </PageBar>

      {errorMessage ? (
        <p className="alert alert--error whatsapp__alerta" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="muted whatsapp__estado">Carregando…</p>
      ) : (
        <>
          {/*
            O AVISO DE CIMA CONTA QUANTAS SÃO E DIZ O QUE FAZER.

            É a peça de Cardápio ("N itens fora de venda por grupo obrigatório"),
            pelo mesmo motivo: a etiqueta na linha quatro de uma tabela não é
            achável sozinha, e o que ela marca aqui é uma loja inteira sem
            avisar cliente nenhum — um estado sem erro, sem tela vermelha e sem
            nada acontecendo que chame atenção.
          */}
          {canais.length === 0 ? (
            <p className="alert alert--warn whatsapp__alerta" data-testid="whatsapp-sem-numero">
              <strong>Nenhum número conectado.</strong> Enquanto isso, nenhum cliente recebe aviso
              de pedido no WhatsApp — os pedidos seguem normalmente, em silêncio.
            </p>
          ) : mudas.length > 0 ? (
            <p className="alert alert--warn whatsapp__alerta" data-testid="whatsapp-mudas">
              <strong>
                {mudas.length === 1
                  ? '1 loja não avisa o cliente'
                  : `${mudas.length} lojas não avisam o cliente`}
                :
              </strong>{' '}
              {mudas.map((loja) => loja.branch_name).join(', ')}. Os pedidos seguem normalmente — o
              que não sai é o aviso.
            </p>
          ) : null}

          <section className="whatsapp__secao">
            <div className="whatsapp__secao-head">
              <h2 className="t-section">
                {lojas.length === 1 ? 'Como esta loja avisa' : 'Por qual número cada loja fala'}
              </h2>
              {lojas.length > 1 ? (
                <p className="t-aux">
                  <strong>Loja sem número próprio herda o do restaurante</strong> — ela não está sem
                  WhatsApp.
                </p>
              ) : null}
            </div>

            <DataTable
              caption="Por qual número cada loja deste restaurante avisa o cliente"
              captionHidden
              columns={COLUNAS_DE_LOJA}
              rows={linhasDeLoja}
              empty={
                /* Não é vazio de filtro — não há filtro. É a lista de lojas
                   voltando sem nenhuma, o que só acontece se a leitura falhar
                   de um jeito que não levantou erro. */
                <p className="muted whatsapp__estado" data-testid="whatsapp-sem-loja">
                  Nenhuma loja veio nesta lista. Recarregue a página.
                </p>
              }
            />
          </section>

          <section className="whatsapp__secao">
            <div className="whatsapp__secao-head">
              <h2 className="t-section">Números conectados</h2>
              <p className="t-aux">
                A linha do restaurante vem primeiro: é dela que sai o número de toda loja que não
                tem o seu.
              </p>
            </div>

            <DataTable
              caption="Os números de WhatsApp cadastrados neste restaurante"
              captionHidden
              columns={COLUNAS_DE_CANAL}
              rows={linhasDeCanal}
              empty={
                <p className="muted whatsapp__estado" data-testid="whatsapp-sem-canal">
                  {podeConectar
                    ? 'Nenhum número cadastrado ainda. Use "Conectar número" para ligar o primeiro.'
                    : 'Nenhum número cadastrado ainda. Só o proprietário conecta um.'}
                </p>
              }
            />
          </section>

          {!podeConectar ? (
            <p className="faint whatsapp__estado" data-testid="whatsapp-somente-leitura">
              Só o proprietário conecta e desconecta números.
            </p>
          ) : null}
        </>
      )}

      {conectando ? (
        <ConnectChannelDialog
          initial={conectando.draft}
          modo={conectando.modo}
          canal={conectando.canal}
          lojas={lojas}
          isSaving={isSaving}
          onClose={() => setConectando(null)}
          onSave={conectar}
        />
      ) : null}

      {desconectando ? (
        <ConfirmDialog
          title={`Desconectar ${desconectando.display_phone_number}?`}
          confirmLabel="Desconectar o número"
          sendingLabel="Desconectando…"
          cancelLabel="Manter conectado"
          isSending={isSaving}
          errorMessage={erroDaSaida}
          onClose={() => setDesconectando(null)}
          onConfirm={() => {
            void desconectar(desconectando.id).then((falha) => {
              setErroDaSaida(falha);
              if (!falha) setDesconectando(null);
            });
          }}
          data-testid="whatsapp-desconectar-confirm"
        >
          {/*
            O CORPO DIZ QUEM FICA MUDO, PELO NOME.

            Desligar a linha do restaurante não cala uma loja: cala TODAS as que
            não têm número próprio, e essa lista não existe em nenhum outro
            lugar da tela. "Tem certeza?" aqui seria o gesto de dois cliques que
            a pessoa aprende a fazer sem ler.
          */}
          {dependentes.length > 0 ? (
            <p className="saida__consequencia" data-testid="whatsapp-dependentes">
              {dependentes.length === 1
                ? 'A partir de agora esta loja para de avisar o cliente: '
                : `A partir de agora estas ${dependentes.length} lojas param de avisar o cliente: `}
              <strong>{dependentes.join(', ')}</strong>.
            </p>
          ) : null}

          {desconectando.branch_id !== null ? (
            <p className="saida__consequencia">
              Ela <strong>não passa a usar o número do restaurante</strong> — uma filial só herda
              quando não tem linha nenhuma. Até alguém religar, ninguém dela é avisado.
            </p>
          ) : null}

          <p className="saida__consequencia">
            A linha não é apagada, e o registro do que já foi avisado continua de pé. Para religar,
            porém, você vai precisar do <strong>token da Business Manager de novo</strong>: ele não
            fica guardado em lugar nenhum do painel.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
