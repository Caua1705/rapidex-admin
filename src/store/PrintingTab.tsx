import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { PrintSector } from '../api/types';
import { checkSectorName } from '../print-sectors/print-sectors';
import { formatItemCount } from '../print-sectors/sector-coverage';
import { usePrintSectors } from '../print-sectors/usePrintSectors';
import { useSectorCoverage } from '../print-sectors/useSectorCoverage';
import { EditIcon, PlusIcon } from '../ds/icons';
import { Switch } from '../ds/Switch';

/**
 * ============================================================================
 * IMPRESSÃO — a tela onde a impressora da loja é configurada
 * ============================================================================
 *
 * O QUE ESTA TELA PRECISA DEIXAR ÓBVIO, e que nenhum lojista adivinha: o
 * navegador NÃO fala com impressora térmica. Quem imprime é um programa
 * instalado na máquina do balcão (o `print-agent/`, no repositório do
 * backend), que fica escutando os pedidos e manda as vias para as impressoras
 * daquela máquina. O painel é o CONTROLE desse programa, não o canal da
 * impressão. Quem abre esta tela esperando um botão "imprimir" precisa
 * entender isso na primeira linha, ou vai passar a noite clicando.
 *
 * ----------------------------------------------------------------------------
 * O QUE ESTÁ AQUI E O QUE NÃO ESTÁ, E POR QUÊ
 * ----------------------------------------------------------------------------
 *
 * Dos quatro blocos desta tela, só o TERCEIRO tem backend hoje. O programa de
 * impressão é um consumidor puro da API — ele faz login, abre o stream de
 * pedidos e busca as vias em `GET /admin/orders/{id}/print-jobs`, e não manda
 * NADA de volta. Não há heartbeat, não há relato das impressoras da máquina e
 * não há rota de impressão de teste; as impressoras vivem num `config.ini`
 * local que mapeia nome de setor → nome da impressora no Windows, e o painel
 * não o enxerga.
 *
 * Então os blocos 1, 2 e 4 mostram o estado honesto do que ainda não existe —
 * título e uma frase do que vão fazer (§10 da skill de design). NENHUM dado
 * inventado: sem heartbeat não há "conectado às 20:41" a exibir, e um ponto
 * verde inventado nesta tela é pior que a ausência dele — ele faria o lojista
 * parar de procurar o defeito justamente quando a comanda não sai.
 *
 * O que falta, com nome, está no relatório entregue junto desta tela.
 */
export function PrintingTab({ branchId }: { branchId: string }) {
  const printing = usePrintSectors(branchId);
  const coverage = useSectorCoverage(printing.sectors);
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
      <section className="store-form__section" data-testid="print-agent-block">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Programa de impressão</h2>
        </div>

        {/*
          A EXPLICAÇÃO É O CONTEÚDO DESTE BLOCO, não um preâmbulo dele. Em
          linguagem de lojista: sem "agente", sem "daemon", sem "headless" —
          palavras que não dizem nada a quem tem uma pizzaria e fazem a tela
          parecer documentação de outra pessoa.
        */}
        <p className="field__hint">
          A comanda não sai do navegador: quem imprime é um programa instalado no computador do
          balcão, ligado às impressoras daquela máquina. O painel diz o que imprimir; o programa põe
          no papel. Com o computador desligado, nenhuma comanda sai — mesmo com o painel aberto no
          celular.
        </p>

        {/*
          O ESTADO HONESTO. Sem heartbeat não existe "conectado" a afirmar, e
          inventar um ponto verde aqui faria o lojista parar de procurar o
          defeito exatamente quando a comanda não está saindo.
        */}
        <p className="field__hint" data-testid="print-agent-status">
          O painel ainda não mostra se o programa está rodando nesta loja. Enquanto isso, quem
          confere é quem está no balcão: o programa é instalado junto com o restaurante e registra o
          que imprimiu num arquivo de log na própria máquina.
        </p>
      </section>

      {/* --- 2. AS IMPRESSORAS -------------------------------------------- */}
      <section className="store-form__section" data-testid="printers-block">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Impressoras</h2>
        </div>

        {/*
          Sem lista vazia sem explicação: uma lista de zero impressoras faria o
          lojista concluir que a máquina não tem nenhuma, quando o que falta é
          o programa contar quais ele enxerga.
        */}
        <p className="field__hint" data-testid="printers-empty">
          As impressoras que o programa enxerga vão aparecer aqui, com um teste por impressora. Hoje
          elas são escolhidas na configuração do próprio programa, no computador do balcão: cada
          setor abaixo é ligado ao nome de uma impressora daquela máquina.
        </p>
      </section>

      {/* --- 3. OS SETORES — o bloco que tem backend ----------------------- */}
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
                  </>
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

                <Switch
                  hideLabel
                  checked={sector.is_active}
                  disabled={printing.pendingIds.includes(sector.id)}
                  label={`${sector.name}: ${sector.is_active ? 'desativar' : 'ativar'}`}
                  onChange={(next) => void printing.setActive(sector.id, next)}
                />
              </li>
            ))}
          </ul>
        )}

        <SemSetor coverage={coverage} />
      </section>

      {/* --- 3b. NOVO SETOR ----------------------------------------------- */}
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

      {/* --- 4. O TESTE DA COMANDA ---------------------------------------- */}
      <section className="store-form__section" data-testid="test-print-block">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Teste da comanda</h2>
        </div>

        <p className="field__hint" data-testid="test-print-empty">
          Um botão aqui vai mandar uma comanda de exemplo, na largura real de 48 colunas, para a
          impressora do setor escolhido — é o que confere a instalação sem esperar o primeiro pedido
          de verdade. Hoje esse teste é feito na própria máquina do balcão, junto com a instalação.
        </p>
      </section>
    </div>
  );
}

/**
 * O QUE NÃO IMPRIME EM LUGAR NENHUM.
 *
 * É a razão de esta contagem existir: item sem setor não sai na comanda de
 * produção, e o lojista precisa descobrir isso antes do sábado à noite — não
 * durante, com o salão cheio e a cozinha perguntando do pedido.
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
          <>Todos os {coverage.total} itens do cardápio têm setor.</>
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
          {formatItemCount(coverage.strangeSector)} aponta para um setor que não é desta filial.
          A via desses itens cai na impressora de resgate do programa de impressão.
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
