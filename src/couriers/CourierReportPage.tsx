import { useState, type ReactNode } from 'react';

import { useSession } from '../auth/session-context';
import { usePermissoes } from '../auth/use-permissions';
import { DataTable, PageBar, type Column } from '../ds';
import { formatPhone } from '../customers/customer-model';
import { branchName } from '../layout/branch-heading';
import { formatCurrency } from '../orders/format';
import { datesForPreset, type PerformancePreset } from '../performance/report-model';
import { linhasDoRelatorio, textoSemTaxa, totalAPagar } from './courier-report';
import { useCourierReport } from './useCourierReport';
import './CourierReportPage.css';

const PERIODOS: readonly { value: PerformancePreset; label: string }[] = [
  { value: 'last7', label: '7 dias' },
  { value: 'last30', label: '30 dias' },
  { value: 'custom', label: 'Escolher…' },
];

type Linha = {
  id: string;
  entregador: ReactNode;
  entregas: string;
  semTaxa: ReactNode;
  total: string;
};

const COLUNAS: readonly Column<Linha>[] = [
  { key: 'entregador', header: 'Entregador' },
  { key: 'entregas', header: 'Entregas', align: 'end' },
  { key: 'semTaxa', header: 'Sem taxa', align: 'end' },
  { key: 'total', header: 'A pagar', align: 'end' },
];

/**
 * ============================================================================
 * O DIA DE PAGAR — quanto a loja deve a cada entregador
 * ============================================================================
 *
 * É a única tela deste domínio que não é de operação: ela abre uma vez por
 * semana ou por mês, com o dono conferindo número por número antes de
 * transferir. Isso decide tudo o que vem abaixo.
 *
 * ----------------------------------------------------------------------------
 * OS NÚMEROS BATEM COM O QUE O MOTOBOY VÊ
 * ----------------------------------------------------------------------------
 *
 * O contrato diz que é a mesma conta do histórico que ele abre pelo link dele,
 * agrupada. Por isso esta tela **não recalcula nada**: não soma as linhas para
 * conferir o total, não arredonda, não reordena. Uma segunda conta aqui viraria
 * uma divergência no balcão, com o motoboy mostrando o celular — e quem estaria
 * errado seria o painel, porque a definição de entrega é do backend.
 *
 * ----------------------------------------------------------------------------
 * O QUE NÃO TEM TAXA FICA AO LADO, NUNCA DENTRO
 * ----------------------------------------------------------------------------
 *
 * "Sem taxa" é coluna própria e o rodapé a repete em palavras. São corridas de
 * uma filial que não tinha taxa configurada na atribuição: não há valor
 * congelado nelas, e o dono acerta à mão. Somá-las como zero seria afirmar que
 * foram de graça.
 *
 * ----------------------------------------------------------------------------
 * QUEM SAIU CONTINUA NA LISTA
 * ----------------------------------------------------------------------------
 *
 * `is_deleted` é quem já não trabalha na loja e ainda tem corrida a receber.
 * Escondê-lo seria o dono não pagar quem trabalhou, numa tela que existe para
 * o dia de pagar.
 */
export function CourierReportPage() {
  const { podeLerDinheiro } = usePermissoes();
  const { branches, activeBranchId } = useSession();

  const [preset, setPreset] = useState<PerformancePreset>('last30');
  const [range, setRange] = useState(() =>
    datesForPreset('last30', { startDate: '', endDate: '' }),
  );

  /*
   * A FILIAL SAI DO SELETOR DO TOPO, e vazio soma o restaurante inteiro — o
   * `branch_id` só restringe. Para o GERENTE, vazio é 403: ele precisa do
   * recorte, e `podeLerDinheiro` é a regra que sabe disso.
   */
  const podeLer = podeLerDinheiro(activeBranchId);
  const relatorio = useCourierReport(range, activeBranchId, podeLer);

  function escolherPreset(proximo: PerformancePreset) {
    setPreset(proximo);
    setRange((atual) => datesForPreset(proximo, atual));
  }

  const dados = relatorio.relatorio;
  const linhas: Linha[] = dados
    ? linhasDoRelatorio(dados).map((linha) => ({
        id: linha.id,
        entregador: (
          <span className="pagar__pessoa">
            <span className="pagar__nome">{linha.nome}</span>
            <a className="faint" href={`tel:${linha.telefone}`}>
              {formatPhone(linha.telefone)}
            </a>
            {/*
              QUEM SAIU VEM MARCADO, e a etiqueta explica em vez de só pintar:
              "excluído" sozinho leria como erro de cadastro, e o que ela diz é
              que ainda há dinheiro a pagar a essa pessoa.
            */}
            {linha.saiu ? (
              <span className="tag pagar__saiu" data-testid={`pagar-saiu-${linha.id}`}>
                Saiu da loja
              </span>
            ) : null}
          </span>
        ),
        entregas: String(linha.entregas),
        semTaxa: linha.semTaxa > 0 ? <strong>{linha.semTaxa}</strong> : '—',
        total: linha.total === null ? '—' : formatCurrency(linha.total),
      }))
    : [];

  const total = dados ? totalAPagar(dados) : null;
  const avisoSemTaxa = dados ? textoSemTaxa(dados.deliveries_without_fee) : null;

  return (
    <div className="pagar">
      <PageBar title="A pagar aos entregadores">
        <div className="seg" role="group" aria-label="Período">
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.value}
              type="button"
              className="seg__opt"
              aria-pressed={preset === periodo.value}
              onClick={() => escolherPreset(periodo.value)}
              data-testid={`pagar-periodo-${periodo.value}`}
            >
              {periodo.label}
            </button>
          ))}
        </div>

        {preset === 'custom' ? (
          <div className="pagar__datas">
            <input
              className="input"
              type="date"
              value={range.startDate}
              onChange={(event) => setRange((a) => ({ ...a, startDate: event.target.value }))}
              aria-label="Data inicial"
              data-testid="pagar-inicio"
            />
            <span className="faint" aria-hidden="true">
              até
            </span>
            <input
              className="input"
              type="date"
              value={range.endDate}
              onChange={(event) => setRange((a) => ({ ...a, endDate: event.target.value }))}
              aria-label="Data final"
              data-testid="pagar-fim"
            />
          </div>
        ) : null}
      </PageBar>

      {/*
        O GERENTE PRECISA DO RECORTE. Sem filial escolhida a rota responde 403 —
        ler o dinheiro do restaurante inteiro não é dele. A tela diz o que
        fazer, em vez de deixar o 403 chegar como "você não tem permissão": ele
        TEM, de uma loja.
      */}
      {!podeLer ? (
        <p className="alert alert--info pagar__aviso" data-testid="pagar-escolha-filial">
          Escolha uma filial no topo para ver quanto ela deve. O total do restaurante inteiro é do
          proprietário.
        </p>
      ) : null}

      {podeLer ? (
        <>
          {relatorio.problema ? (
            <p
              className="alert alert--error pagar__aviso"
              role="alert"
              data-testid="pagar-periodo-erro"
            >
              {relatorio.problema}
            </p>
          ) : null}

          {relatorio.errorMessage ? (
            <p className="alert alert--error pagar__aviso" role="alert" data-testid="pagar-erro">
              {relatorio.errorMessage}
            </p>
          ) : null}

          {relatorio.isLoading && !dados ? (
            <p className="muted pagar__estado">Carregando…</p>
          ) : null}

          {dados ? (
            <>
              {/*
                O TOTAL VEM ANTES DA TABELA. É o número que o dono veio buscar;
                a tabela é a conferência dele, e quem confere já sabe o total.
              */}
              <section className="pagar__resumo" data-testid="pagar-resumo">
                <p className="pagar__rotulo">
                  A pagar{' '}
                  {dados.branch_id
                    ? `na ${nomeDaFilial(branches, dados.branch_id)}`
                    : 'no restaurante'}
                </p>
                <p className="pagar__total" data-testid="pagar-total">
                  {total === null ? '—' : formatCurrency(total)}
                </p>
                <p className="faint">
                  {dados.deliveries_count} entregas · {dados.period.days} dias
                </p>

                {/*
                  O QUE FICA DE FORA DA SOMA, EM PALAVRAS. É a única informação
                  desta tela que vira conversa em vez de transferência, e por
                  isso ela não é só um número numa coluna.
                */}
                {avisoSemTaxa ? (
                  <p className="alert alert--warn pagar__sem-taxa" data-testid="pagar-sem-taxa">
                    {avisoSemTaxa}. Elas <strong>não estão</strong> no total acima.
                  </p>
                ) : null}
              </section>

              <DataTable
                caption="Quanto a loja deve a cada entregador no período"
                captionHidden
                columns={COLUNAS}
                rows={linhas}
                empty={
                  <p className="muted pagar__estado" data-testid="pagar-vazio">
                    Nenhuma entrega concluída neste período.
                  </p>
                }
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** O nome da filial do recorte, para o rótulo do total. */
function nomeDaFilial(branches: ReturnType<typeof useSession>['branches'], id: string): string {
  const filial = branches.find((entrada) => entrada.id === id);
  return filial ? branchName(filial) : 'filial';
}
