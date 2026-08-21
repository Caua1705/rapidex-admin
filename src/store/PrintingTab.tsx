import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { PrintAgentPrinter, PrintSector } from '../api/types';
import { usePermissoes } from '../auth/use-permissions';
import { agentHint, agentLabel, agentState, formatAgo } from '../print-sectors/print-agent';
import { checkSectorName } from '../print-sectors/print-sectors';
import { formatItemCount } from '../print-sectors/sector-coverage';
import { usePrintAgent } from '../print-sectors/usePrintAgent';
import { usePrintSectors } from '../print-sectors/usePrintSectors';
import { useSectorCoverage } from '../print-sectors/useSectorCoverage';
import { Field } from '../ds/Field';
import { EditIcon, PlusIcon } from '../ds/icons';
import { Select, type SelectOption } from '../ds/Select';
import { Switch } from '../ds/Switch';

/**
 * ============================================================================
 * IMPRESSÃO — a tela onde a impressora da loja é configurada
 * ============================================================================
 *
 * O QUE ESTA TELA PRECISA DEIXAR ÓBVIO, e que nenhum lojista adivinha: o
 * navegador NÃO fala com impressora térmica. Quem imprime é um programa
 * instalado na máquina do balcão (o `print-agent/`, no repositório do backend),
 * que fica escutando os pedidos e manda as vias para as impressoras daquela
 * máquina. O painel é o CONTROLE desse programa, não o canal da impressão.
 *
 * ----------------------------------------------------------------------------
 * OS QUATRO BLOCOS TÊM BACKEND AGORA — os três de cima eram texto
 * ----------------------------------------------------------------------------
 *
 * Até esta rodada, três dos quatro blocos mostravam o estado honesto do que não
 * existia: "o painel ainda não mostra se o programa está rodando", "as
 * impressoras vão aparecer aqui", "um botão aqui vai mandar uma comanda de
 * exemplo". Era o certo a fazer — um ponto verde inventado nesta tela é pior
 * que a ausência dele, porque faria o lojista parar de procurar o defeito
 * justamente quando a comanda não sai.
 *
 * As rotas existem desde 13/08 e os três blocos passaram a ler delas:
 *
 *   1. programa   `GET  /admin/branches/{id}/print-agent`
 *   2. impressoras `GET  /admin/branches/{id}/printers`
 *   3. setores     `GET/POST/PATCH` de `printing-sectors` (já existia)
 *   4. teste       `POST /admin/branches/{id}/print-test`
 *
 * ----------------------------------------------------------------------------
 * A EXPLICAÇÃO ENCOLHEU, E ISSO FOI TRABALHO — não corte
 * ----------------------------------------------------------------------------
 *
 * Os três textos somavam onze linhas de prosa numa tela de configuração usada
 * em pé, no balcão, no sábado. Eles explicavam o MECANISMO (o navegador não
 * fala com térmica, o programa mora na máquina, o mapa está num `config.ini`).
 * O que ficou explica a CONSEQUÊNCIA, que é o que muda o que a pessoa faz:
 * "Com o computador desligado, nada é impresso."
 *
 * E a maior parte da explicação virou ESTADO: enquanto o painel não sabia se o
 * programa estava rodando, ele tinha de escrever um parágrafo dizendo como
 * conferir isso na mão. Sabendo, ele escreve três palavras e um ponto colorido.
 *
 * ----------------------------------------------------------------------------
 * O QUE NÃO ESTÁ AQUI, E POR QUÊ
 * ----------------------------------------------------------------------------
 *
 * - **Não instala o programa, nem o atualiza.** Não há rota, e não haveria como
 *   — a instalação é um executável num pendrive, na máquina do balcão.
 * - **Não mostra o log da impressão.** O agente grava um arquivo local, ao lado
 *   do próprio executável, e nada disso sobe para a API.
 * - **Não reimprime o pedido.** A única ordem que o contrato aceita é
 *   `print_test`; reimprimir comanda de pedido é outra coisa e não existe.
 */
export function PrintingTab({ branchId }: { branchId: string }) {
  /*
   * TRÊS PERMISSÕES DIFERENTES NA MESMA TELA, e é a tela do painel onde a
   * diferença mais aparece:
   *
   *   ver o programa      de quem opera — é ele que está ao lado da impressora
   *   mandar via de teste  de quem opera, pelo mesmo motivo
   *   ver as impressoras   da gerência (é o inventário da máquina)
   *   editar os setores    da gerência (é a configuração da cozinha)
   *
   * Para o atendente isto não vira uma tela vazia: ele continua vendo se o
   * programa está rodando e continua podendo mandar uma via de teste, que é
   * exatamente o que serve quando a comanda para no meio do turno.
   */
  const { pode } = usePermissoes();
  const podeEditarSetores = pode('impressao.editarSetores');
  const printing = usePrintSectors(branchId);
  const agent = usePrintAgent(branchId);
  const coverage = useSectorCoverage(branchId, printing.sectors);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function handleCreate() {
    const check = checkSectorName(newName, printing.sectors);
    if (!check.valid) return setProblem(check.message);

    setProblem(null);
    if (await printing.create(check.name)) setNewName('');
  }

  async function handleRename(sector: PrintSector, raw: string) {
    const check = checkSectorName(raw, printing.sectors, { ignoreId: sector.id });
    if (!check.valid) {
      setProblem(check.message);
      return;
    }

    setProblem(null);
    // Nome igual ao que já está: fecha a edição sem gastar uma requisição.
    if (check.name === sector.name) {
      setEditingId(null);
      return;
    }
    if (await printing.rename(sector.id, check.name)) setEditingId(null);
  }

  return (
    <div className="store-form">
      {(problem ?? printing.errorMessage) ? (
        <p className="alert alert--error" role="alert" data-testid="store-error">
          {problem ?? printing.errorMessage}
        </p>
      ) : null}

      {/* --- 1. O PROGRAMA DE IMPRESSÃO ------------------------------------ */}
      <ProgramaBlock agent={agent} />

      {/*
        --- 2. AS IMPRESSORAS --------------------------------------------

        O bloco inteiro some para quem não alcança `GET .../printers`: não é um
        botão dentro dele que falta, é a leitura. Desenhá-lo com a mensagem de
        erro do 403 seria uma tarja vermelha permanente numa tela de
        configuração, dizendo à pessoa que ela fez algo errado.
      */}
      {pode('impressao.verImpressoras') ? <ImpressorasBlock agent={agent} /> : null}

      {/* --- 3. OS SETORES ------------------------------------------------ */}
      <section className="store-form__section" data-testid="sectors-block">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Setores de impressão</h2>
          <span className="faint">Onde cada pedido sai impresso nesta filial.</span>
        </div>

        {printing.isLoading ? (
          <p className="muted store__loading">Carregando os setores…</p>
        ) : printing.sectors.length === 0 ? (
          <p className="field__hint">
            Nenhum setor nesta filial ainda. Crie o primeiro — depois é no Cardápio que se diz qual
            produto imprime em qual setor.
          </p>
        ) : (
          <ul className="sectors">
            {printing.sectors.map((sector) => (
              <li
                className={`sectors__row${sector.is_active ? '' : ' sectors__row--off'}`}
                key={sector.id}
                data-testid={`print-sector-${sector.id}`}
              >
                {editingId === sector.id ? (
                  <SectorNameField
                    initial={sector.name}
                    isSaving={printing.pendingIds.includes(sector.id)}
                    onCancel={() => {
                      setEditingId(null);
                      setProblem(null);
                    }}
                    onSave={(value) => void handleRename(sector, value)}
                  />
                ) : (
                  <>
                    <span className="sectors__name">{sector.name}</span>

                    {/* Ação secundária de linha: ícone sem caixa, como no
                        cardápio. Contornada, ela virava uma grade de
                        caixinhas competindo com o nome do setor. */}
                    {podeEditarSetores ? (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost icon-btn sectors__rename"
                        onClick={() => {
                          setEditingId(sector.id);
                          setProblem(null);
                        }}
                        aria-label={`Renomear ${sector.name}`}
                        title="Renomear setor"
                        data-testid={`print-sector-rename-${sector.id}`}
                      >
                        <EditIcon />
                      </button>
                    ) : null}
                  </>
                )}

                {/*
                  EM QUAL IMPRESSORA ESTE SETOR SAI.

                  Era um mapa de nome-de-setor → nome-de-impressora dentro do
                  `config.ini` da máquina, e a tela dizia isso por escrito. Deixou
                  de ser verdade: o agente resolve a impressora pela escolha do
                  PAINEL primeiro, e só cai no arquivo local quando não há
                  escolha. A troca aconteceu porque o arquivo casa pelo NOME do
                  setor — renomear "Cozinha" fazia a via cair na impressora padrão
                  e a comanda da cozinha começar a sair no balcão, sem erro em
                  lugar nenhum.
                */}
                {podeEditarSetores ? (
                  <SectorPrinterField
                    sector={sector}
                    printers={agent.printers}
                    isSaving={printing.pendingIds.includes(sector.id)}
                    onChange={(printerName) => void printing.setPrinter(sector.id, printerName)}
                  />
                ) : (
                  /*
                    SEM O SELETOR, O NOME DA IMPRESSORA CONTINUA ESCRITO. Some o
                    controle, não o dado: saber em qual máquina a Chapa sai é
                    metade do diagnóstico de "a comanda não saiu", e essa
                    conversa acontece com quem está no balcão.
                  */
                  <span className="sectors__printer sectors__printer--vazio">
                    {sector.printer_name ?? 'Definida no programa'}
                  </span>
                )}

                {/*
                  QUANTOS ITENS SAEM POR AQUI — a informação que faz esta lista
                  valer a leitura. Um setor com "nenhum item" é um setor que
                  não vai imprimir nada no sábado, e antes disso a linha não
                  dava como saber.

                  A contagem e o "Desativado" dividem a MESMA célula porque os
                  dois qualificam a mesma linha, e uma coluna própria para uma
                  palavra que aparece em uma linha a cada dez seria largura
                  tirada do nome do setor.
                */}
                <span className="sectors__state" data-testid={`print-sector-count-${sector.id}`}>
                  {coverage.isLoading
                    ? ''
                    : [
                        formatItemCount(coverage.countBySectorId[sector.id] ?? 0),
                        sector.is_active ? '' : 'Desativado',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>

                {podeEditarSetores ? (
                  <Switch
                    hideLabel
                    checked={sector.is_active}
                    disabled={printing.pendingIds.includes(sector.id)}
                    label={`${sector.name}: ${sector.is_active ? 'desativar' : 'ativar'}`}
                    onChange={(next) => void printing.setActive(sector.id, next)}
                  />
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}

        <SemSetor coverage={coverage} />
      </section>

      {/* --- 3b. NOVO SETOR ----------------------------------------------- */}
      {podeEditarSetores ? (
        <section className="store-form__section">
          <h2 className="store-form__heading">Novo setor</h2>

          <div className="sectors__new">
            <label className="field sectors__new-field">
              <span className="field__label">Nome do setor</span>
              <input
                className="input"
                value={newName}
                placeholder="Chapa, Bar, Sobremesa…"
                onChange={(event) => {
                  setNewName(event.target.value);
                  setProblem(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleCreate();
                  }
                }}
                data-testid="print-sector-new-name"
              />
            </label>

            <button
              type="button"
              className="btn btn--primary"
              disabled={newName.trim() === '' || printing.isCreating}
              onClick={() => void handleCreate()}
              data-testid="print-sector-create"
            >
              <PlusIcon />
              {printing.isCreating ? 'Criando…' : 'Criar setor'}
            </button>
          </div>
        </section>
      ) : null}

      {/*
        --- 4. O TESTE DA COMANDA ----------------------------------------

        DE QUEM OPERA, e não da gerência: quem está ao lado da impressora quando
        ela para é o balcão, e mandar uma via de exemplo é como se descobre se o
        problema é o papel, a máquina ou o setor.
      */}
      {pode('impressao.mandarTeste') ? (
        <TesteBlock agent={agent} sectors={printing.sectors} />
      ) : null}
    </div>
  );
}

/* ==========================================================================
 * 1. O PROGRAMA
 * ======================================================================= */

/**
 * O ESTADO DA MÁQUINA DO BALCÃO, EM UMA LINHA.
 *
 * A pista é `.conn` — a MESMA peça que Pedidos e Cozinha usam para o estado do
 * stream, e pelo mesmo motivo: ponto colorido mais palavra, respondendo "isto
 * que deveria estar ligado está ligado?". Escrever um indicador próprio aqui
 * daria ao painel dois vocabulários para a mesma pergunta.
 *
 * TRÊS ESTADOS, e o terceiro não é um caso do segundo — ver
 * `print-sectors/print-agent.ts`. "Desligado" se resolve ligando o computador;
 * "nunca instalado" se resolve indo instalar, e confundir os dois manda o
 * lojista procurar um programa que não está lá.
 *
 * A VERSÃO fica ao lado, e só quando existe: ela é o que responde "esta loja
 * está com o programa velho?" numa ligação de suporte, e não vale uma linha
 * própria.
 */
function ProgramaBlock({ agent }: { agent: ReturnType<typeof usePrintAgent> }) {
  const estado = agentState(agent.status);

  return (
    <section className="store-form__section" data-testid="print-agent-block">
      <div className="store-form__section-head">
        <h2 className="store-form__heading">Programa de impressão</h2>

        {agent.isLoading ? null : agent.errorMessage ? (
          <span className="faint" data-testid="print-agent-error">
            Não deu para saber agora ({agent.errorMessage})
          </span>
        ) : (
          /*
            `never` fica com a `.conn` CRUA, sem modificador, e é de propósito:
            o ponto dela já é `--ink-3`, o cinza de "não há sinal a dar". Um
            `conn--offline` carmim ali diria que alguma coisa quebrou, quando o
            que há é uma loja que ainda não instalou o programa.
          */
          <span
            className={`conn${estado === 'never' ? '' : ` conn--${estado}`}`}
            data-testid="print-agent-status"
          >
            <span className="conn__dot" />
            <span className="conn__texto">{agentLabel(agent.status)}</span>
            {agent.status?.agent_version ? (
              /* Sem separador escrito: a `.conn` já abre `--sp-8` entre os
                 filhos, e um "·" ali seria a mesma pausa dita duas vezes. */
              <span className="faint">versão {agent.status.agent_version}</span>
            ) : null}
          </span>
        )}
      </div>

      {/*
        UMA FRASE, E ELA MUDA COM O ESTADO. Eram três parágrafos fixos
        explicando o mecanismo; hoje o mecanismo está no ponto colorido acima e
        aqui fica só o que a pessoa precisa FAZER a respeito.
      */}
      {/*
        UMA FRASE, E SÓ ELA. Havia embaixo uma linha de "Último sinal há X", e
        ela saiu na segunda passagem: com o estado `live`, `seconds_since` é por
        definição menor que a janela de 90s, então a linha era SEMPRE "Último
        sinal agora mesmo" — a mesma informação do rótulo verde logo acima,
        escrita de novo em cinza. O "há quanto tempo" só acrescenta alguma coisa
        quando o programa está FORA, e nesse caso ele já está no rótulo.
      */}
      <p className="field__hint" data-testid="print-agent-hint">
        {agentHint(agent.status)}
      </p>
    </section>
  );
}

/* ==========================================================================
 * 2. AS IMPRESSORAS
 * ======================================================================= */

/**
 * O QUE A MÁQUINA DO BALCÃO ENXERGA — uma foto, não um cadastro.
 *
 * O agente substitui a lista inteira a cada relato, então impressora
 * desinstalada some daqui sozinha. Nada aqui é editável: quem instala
 * impressora é o Windows daquela máquina, e um botão "adicionar impressora"
 * neste painel seria uma promessa que nenhuma rota cumpre.
 *
 * A LISTA VAZIA TEM DOIS SIGNIFICADOS, e separá-los é o trabalho deste bloco.
 * Sem agente, ninguém contou nada — e "nenhuma impressora" faria o lojista
 * procurar defeito no cabo USB quando o que falta é o programa. Com agente e
 * lista vazia, aí sim o problema está na máquina.
 */
function ImpressorasBlock({ agent }: { agent: ReturnType<typeof usePrintAgent> }) {
  const semAgente = agentState(agent.status) === 'never';

  return (
    <section className="store-form__section" data-testid="printers-block">
      <div className="store-form__section-head">
        <h2 className="store-form__heading">Impressoras</h2>
        <span className="faint">O que o programa enxerga nesta máquina.</span>
      </div>

      {agent.isLoading ? (
        <p className="muted store__loading">Carregando as impressoras…</p>
      ) : agent.errorMessage ? null : agent.printers.length === 0 ? (
        <p className="field__hint" data-testid="printers-empty">
          {semAgente
            ? 'Nenhuma ainda: quem conta quais impressoras esta máquina tem é o programa de impressão, e ele nunca rodou nesta loja.'
            : 'O programa está rodando e não encontrou impressora nenhuma nesta máquina. Confira as impressoras instaladas no Windows do balcão.'}
        </p>
      ) : (
        <ul className="printers" data-testid="printers-list">
          {agent.printers.map((printer) => (
            <li className="printers__row" key={printer.name} data-testid="printer-row">
              <span className="printers__name">{printer.name}</span>

              {/*
                A PADRÃO É A QUE RECEBE TODO SETOR SEM ESCOLHA — inclusive um
                setor criado depois da instalação, que é o caso em que a via
                sairia no lugar errado sem ninguém notar. É etiqueta, e não uma
                coluna: ela aparece numa linha só.
              */}
              {printer.is_default ? <span className="tag">Padrão</span> : null}

              <span className="printers__seen">Reportada {formatAgo(secondsSince(printer))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Há quantos segundos a impressora foi reportada.
 *
 * Aqui o relógio é o do NAVEGADOR, ao contrário do estado do agente — e é a
 * exceção consciente: `reported_at` é o único carimbo desta lista e o backend
 * não manda a diferença já calculada. O erro possível é o do relógio da
 * máquina de quem olha, e ele custa uma frase auxiliar imprecisa; no estado do
 * agente custaria dizer que a cozinha está imprimindo quando não está.
 */
function secondsSince(printer: PrintAgentPrinter): number | null {
  const carimbo = Date.parse(printer.reported_at);
  if (Number.isNaN(carimbo)) return null;
  return Math.max(0, (Date.now() - carimbo) / 1000);
}

/* ==========================================================================
 * 4. O TESTE
 * ======================================================================= */

/**
 * UMA VIA DE EXEMPLO, PARA CONFERIR A INSTALAÇÃO SEM ESPERAR O PRIMEIRO PEDIDO.
 *
 * UM CONTROLE, NÃO UM BOTÃO POR LINHA. A tentação é pendurar "Testar" em cada
 * impressora e em cada setor — o contrato aceita os dois destinos. Seriam dez
 * botões repetindo a mesma ação para responder à mesma pergunta, numa tela que
 * já tem um interruptor e um seletor por linha de setor. Aqui é um seletor de
 * DESTINO com as duas famílias dentro e um botão só.
 *
 * OS DOIS DESTINOS SÃO CASOS DIFERENTES, e por isso os dois estão na lista:
 *
 *   - por SETOR é o caso comum, "testar a Cozinha": confere a corrente inteira
 *     (setor → impressora escolhida → máquina);
 *   - por IMPRESSORA é o que serve numa máquina recém-instalada, antes de
 *     existir setor nenhum — e é o que separa "a impressora está muda" de "o
 *     setor está apontado para o lugar errado".
 *
 * A RESPOSTA É 202, E A FRASE DE RETORNO DIZ ISSO. O comando foi ENFILEIRADO,
 * não impresso: com o programa desligado, a via sai quando ele voltar. Um
 * "Teste enviado" verde nesse caso deixaria o lojista olhando uma impressora
 * que não vai receber nada hoje.
 */
function TesteBlock({
  agent,
  sectors,
}: {
  agent: ReturnType<typeof usePrintAgent>;
  sectors: readonly PrintSector[];
}) {
  /*
   * O valor do seletor carrega a FAMÍLIA no prefixo (`setor:` / `impressora:`),
   * e não só o id. Sem ele, um setor e uma impressora com o mesmo texto seriam
   * a mesma opção, e o corpo do POST sairia com o campo errado — que o backend
   * aceitaria calado, resolvendo para a impressora padrão.
   */
  const [destino, setDestino] = useState('');

  const opcoes: SelectOption[] = useMemo(() => {
    const ativos = sectors.filter((sector) => sector.is_active);
    return [
      /*
       * A DICA DIZ A FAMÍLIA, e não o detalhe. As duas listas caem numa lista
       * só, e "Chapa" ao lado de "EPSON TM-T20" não diz qual das duas é uma
       * praça da cozinha e qual é uma máquina — que é justamente a diferença
       * entre testar a corrente inteira e testar só o papel.
       */
      ...ativos.map((sector) => ({
        value: `setor:${sector.id}`,
        label: sector.name,
        hint: 'setor',
      })),
      ...agent.printers.map((printer) => ({
        value: `impressora:${printer.name}`,
        label: printer.name,
        hint: printer.is_default ? 'impressora padrão' : 'impressora',
      })),
    ];
  }, [sectors, agent.printers]);

  const escolhida = opcoes.find((opcao) => opcao.value === destino) ?? null;

  async function enviar() {
    if (!escolhida) return;
    const [familia, ...resto] = escolhida.value.split(':');
    const chave = resto.join(':');
    await agent.sendTest(
      familia === 'setor' ? { printing_sector_id: chave } : { printer_name: chave },
      escolhida.label,
    );
  }

  return (
    <section className="store-form__section" data-testid="test-print-block">
      <div className="store-form__section-head">
        <h2 className="store-form__heading">Teste da comanda</h2>
        <span className="faint">Uma via de exemplo, na largura real de 48 colunas.</span>
      </div>

      {opcoes.length === 0 ? (
        <p className="field__hint" data-testid="test-print-empty">
          Não há para onde mandar um teste ainda: crie um setor acima, ou espere o programa de
          impressão contar quais impressoras esta máquina tem.
        </p>
      ) : (
        <div className="print-test">
          {/*
            `ds/Field`, E NÃO UM `<label>` À MÃO EM VOLTA DO SELETOR.

            O campo de "Novo setor" logo acima é um `<label>` embrulhando um
            `<input>`, e isso é HTML válido. Com o `ds/Select` no lugar do input
            não é: a lista de opções dele é renderizada DENTRO do rótulo, e o
            navegador reencaminha para o controle rotulado todo clique que cai
            dentro de um `<label>`. O efeito é escolher a opção e o seletor
            reabrir no mesmo clique — sem erro, sem log, e com a escolha
            gravada, o que faz parecer que só a animação de fechar quebrou.

            `Field` põe o rótulo como IRMÃO do controle, com `htmlFor`, e é por
            isso que ele existe.
          */}
          <div className="print-test__field">
            <Field label="Mandar para">
              <Select
                value={destino}
                onChange={setDestino}
                options={opcoes}
                placeholder="Escolher o destino…"
                data-testid="print-test-destino"
              />
            </Field>
          </div>

          <button
            type="button"
            className="btn btn--primary"
            disabled={!escolhida || agent.isTesting}
            onClick={() => void enviar()}
            data-testid="print-test-send"
          >
            {agent.isTesting ? 'Enviando…' : 'Enviar teste'}
          </button>
        </div>
      )}

      {agent.testError ? (
        <p className="alert alert--error" role="alert" data-testid="print-test-error">
          {agent.testError}
        </p>
      ) : null}

      {/*
        DUAS RESPOSTAS PARA O MESMO 202, e a diferença é `agent_is_online`. Com o
        programa no ar, a via está saindo agora e a frase manda olhar a
        impressora. Com ele fora, ela ficou na fila — e dizer isso é a única
        forma de o lojista não passar cinco minutos ao lado de uma máquina muda.
      */}
      {agent.testOutcome ? (
        agent.testOutcome.agentIsOnline ? (
          <p className="alert alert--info" role="status" data-testid="print-test-result">
            Teste enviado para <strong>{agent.testOutcome.destino}</strong>. A via sai em alguns
            segundos — confira o papel na impressora.
          </p>
        ) : (
          <p className="alert alert--warn" role="status" data-testid="print-test-result">
            Teste enfileirado para <strong>{agent.testOutcome.destino}</strong>, mas o programa de
            impressão está desligado. A via sai quando ele voltar, não agora.
          </p>
        )
      ) : null}
    </section>
  );
}

/* ==========================================================================
 * A IMPRESSORA DE UM SETOR
 * ======================================================================= */

/**
 * EM QUAL IMPRESSORA ESTE SETOR SAI.
 *
 * `null` NÃO É VAZIO: é "deixar o programa decidir", ou seja, cair no mapa do
 * `config.ini` da máquina e, na falta dele, na impressora padrão. É uma escolha
 * legítima — é assim que toda loja instalada antes desta coluna existir continua
 * imprimindo —, então ela é a PRIMEIRA opção da lista e tem nome, em vez de ser
 * um seletor em branco que o lojista lê como pendência.
 *
 * SEM IMPRESSORA REPORTADA, O SELETOR NÃO APARECE. Uma lista com uma opção só
 * ("deixar o programa decidir") é um controle que não escolhe nada. No lugar
 * dela vai o que está gravado, se houver — porque o nome pode ter sido gravado
 * quando a máquina ainda reportava aquela impressora, e some da tela seria
 * perder a única pista de que a escolha existe.
 */
function SectorPrinterField({
  sector,
  printers,
  isSaving,
  onChange,
}: {
  sector: PrintSector;
  printers: readonly PrintAgentPrinter[];
  isSaving: boolean;
  onChange: (printerName: string | null) => void;
}) {
  const opcoes: SelectOption[] = useMemo(() => {
    const nomes = printers.map((printer) => printer.name);
    /*
     * A gravada entra na lista mesmo que a máquina não a reporte mais: o
     * seletor mostraria vazio e o primeiro clique apagaria a escolha sem
     * ninguém pedir. Aparecendo, ela é uma escolha que o lojista vê e desfaz se
     * quiser.
     */
    if (sector.printer_name && !nomes.includes(sector.printer_name)) {
      nomes.push(sector.printer_name);
    }
    return [
      { value: '', label: 'Definida no programa' },
      ...nomes.map((nome) => ({ value: nome, label: nome })),
    ];
  }, [printers, sector.printer_name]);

  if (opcoes.length === 1) {
    return (
      <span className="sectors__printer sectors__printer--vazio" aria-hidden="true">
        —
      </span>
    );
  }

  return (
    <span className="sectors__printer">
      <Select
        value={sector.printer_name ?? ''}
        onChange={(value) => onChange(value === '' ? null : value)}
        options={opcoes}
        disabled={isSaving}
        aria-label={`Impressora do setor ${sector.name}`}
        data-testid={`print-sector-printer-${sector.id}`}
      />
    </span>
  );
}

/**
 * O QUE NÃO IMPRIME EM LUGAR NENHUM.
 *
 * É a razão de esta contagem existir: item sem setor não sai na comanda de
 * produção, e o lojista precisa descobrir isso antes do sábado à noite — não
 * durante, com o salão cheio e a cozinha perguntando do pedido.
 *
 * A CONTAGEM É DA FILIAL, dos dois lados. Ela já cruzou o cardápio do
 * RESTAURANTE com os setores de UMA filial, e o número era impossível de zerar:
 * todo item da outra loja caía em "sem setor". Hoje `useSectorCoverage` varre
 * `GET /admin/products` com `branch_id`, e "5 de 6" é um número que o lojista
 * pode levar a zero.
 *
 * Os dois casos são separados de propósito e têm PESOS diferentes:
 *
 *   - sem setor é ESCOLHA legítima (a bebida que sai do balcão não precisa de
 *     comanda de cozinha), então é linha neutra: conta, aponta onde arrumar e
 *     deixa o lojista julgar. Chamar de erro faria a tela gritar em toda loja
 *     que vende refrigerante;
 *   - setor de outra filial é INCONSISTÊNCIA — ninguém escolheu isso —, e é o
 *     único caso que leva `--alert`.
 */
function SemSetor({ coverage }: { coverage: ReturnType<typeof useSectorCoverage> }) {
  if (coverage.errorMessage) {
    return (
      <p className="field__hint" data-testid="sector-coverage-error">
        Não deu para contar os itens de cada setor agora ({coverage.errorMessage}) — os setores
        acima continuam valendo.
      </p>
    );
  }

  if (coverage.isLoading) {
    return <p className="field__hint">Contando os itens de cada setor…</p>;
  }

  return (
    <div className="sectors__coverage">
      <p className="field__hint" data-testid="sector-coverage">
        {coverage.withoutSector === 0 ? (
          <>Todos os {coverage.total} itens do cardápio desta filial têm setor.</>
        ) : (
          <>
            <strong>{formatItemCount(coverage.withoutSector)}</strong> de {coverage.total} não
            imprime em setor nenhum. Se algum deles precisa sair para a cozinha, o setor se escolhe
            no <Link to="/cardapio">Cardápio</Link> — item por item, ou de uma vez pela categoria.
          </>
        )}
        {coverage.isPartial ? ' A contagem é dos primeiros 2000 itens do cardápio.' : null}
      </p>

      {coverage.strangeSector > 0 ? (
        <p className="alert alert--warn" data-testid="sector-coverage-strange">
          {formatItemCount(coverage.strangeSector)} aponta para um setor que não é desta filial. A
          via desses itens cai na impressora de resgate do programa de impressão.
        </p>
      ) : null}
    </div>
  );
}

/** O campo que aparece no lugar do nome enquanto se renomeia a linha. */
function SectorNameField({
  initial,
  isSaving,
  onCancel,
  onSave,
}: {
  initial: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initial);

  return (
    <span className="sectors__edit">
      <input
        className="input sectors__edit-input"
        value={draft}
        autoFocus
        aria-label={`Novo nome para ${initial}`}
        disabled={isSaving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSave(draft);
          }
          // Escape desiste sem gravar: quem abriu a edição por engano não fica
          // preso nela.
          if (event.key === 'Escape') onCancel();
        }}
        data-testid="print-sector-rename-input"
      />
      <button
        type="button"
        className="btn btn--sm btn--primary"
        disabled={isSaving}
        onClick={() => onSave(draft)}
        data-testid="print-sector-rename-save"
      >
        {isSaving ? 'Salvando…' : 'Salvar'}
      </button>
      <button type="button" className="btn btn--sm" disabled={isSaving} onClick={onCancel}>
        Cancelar
      </button>
    </span>
  );
}
