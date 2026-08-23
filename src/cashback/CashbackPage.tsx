import { useState } from 'react';

import { useResolvedBranch } from '../auth/use-branch-scope';
import { usePermissoes } from '../auth/use-permissions';
import { Field } from '../ds/Field';
import { Input } from '../ds/Input';
import { PageBar } from '../ds/PageBar';
import { Switch } from '../ds/Switch';
import { Tabs } from '../ds/Tabs';
import { branchName } from '../layout/branch-heading';
import { SaveBar } from '../store/SaveBar';
import {
  explicacaoDaOrigem,
  percentuaisIncomuns,
  problemaDoDraft,
  TETO_PERCENTUAL,
  WEEKDAYS,
  type CashbackDraft,
} from './cashback-model';
import { useCashbackRule, type EscopoDaRegra } from './useCashbackRule';
import './CashbackPage.css';

/**
 * ============================================================================
 * CASHBACK — a tela que devolve parte do pedido em crédito
 * ============================================================================
 *
 * ELA NÃO É UMA SEÇÃO DE MINHA LOJA, e a razão é a mesma que tirou o Funil de
 * dentro de Desempenho: o REGIME é outro. Minha loja é o cadastro da operação —
 * endereço, horário, formas de pagamento —, coisas que se encostam uma vez e
 * ficam. Isto é uma CAMPANHA: liga, mede, desliga. Ela mora em Crescimento, ao
 * lado de Cupons, que é a outra forma de dar desconto.
 *
 * ----------------------------------------------------------------------------
 * O AVISO NÃO É DECORAÇÃO, E É POR ISSO QUE ELE ABRE A TELA
 * ----------------------------------------------------------------------------
 *
 * Salvar aqui mexe em FATURAMENTO no mesmo minuto. `enabled` liga o crédito E o
 * resgate juntos, o resgate entra como SUBTRAÇÃO na base da comissão, e o
 * primeiro pedido depois do clique já fecha com outro número. Não existe o
 * "cashback que ninguém usou" — ao contrário do cupom, que pode ficar criado e
 * nunca ser digitado por ninguém.
 *
 * ----------------------------------------------------------------------------
 * DOIS ESCOPOS, E O SEGMENTADO DIZ QUAL
 * ----------------------------------------------------------------------------
 *
 * A herança do cashback é por LINHA: a filial tem a regra inteira ou herda a
 * inteira. São então duas linhas editáveis — a da rede e a da loja —, e a tela
 * NOMEIA qual está aberta em vez de deduzir do seletor do topo.
 *
 * Deduzir seria a armadilha: com "Todas as filiais" significando "a rede", um
 * restaurante de uma loja só — que é a maioria — nunca alcançaria a regra da
 * rede, porque o seletor do topo não tem "todas" para oferecer quando há uma
 * filial só.
 *
 * ----------------------------------------------------------------------------
 * QUEM PODE O QUÊ
 * ----------------------------------------------------------------------------
 *
 * Ler é GERÊNCIA, escrever é SOMENTE DO DONO. O gerente abre a tela e lê os
 * números — some o CONTROLE, fica o DADO, como o nome da impressora do setor
 * para o balcão. Um formulário que aceita digitação e nunca grava é pior que
 * uma tela ausente.
 */
export function CashbackPage() {
  const [escopo, setEscopo] = useState<EscopoDaRegra>('rede');
  const { pode } = usePermissoes();
  const { branchId, branch, isAutoResolved, hasChoice } = useResolvedBranch();

  const regra = useCashbackRule(escopo, escopo === 'rede' ? '' : branchId);
  const { draft } = regra;

  const podeEscrever = pode(escopo === 'rede' ? 'cashback.editarRede' : 'cashback.editarFilial');

  function alterar(patch: Partial<CashbackDraft>) {
    if (!draft) return;
    regra.setDraft({ ...draft, ...patch });
  }

  function alterarDia(weekday: number, percent: string) {
    if (!draft) return;
    regra.setDraft({
      ...draft,
      dias: draft.dias.map((dia) => (dia.weekday === weekday ? { ...dia, percent } : dia)),
    });
  }

  const problema = draft ? problemaDoDraft(draft) : null;
  const incomuns = draft ? percentuaisIncomuns(draft) : [];
  const origem = regra.view ? explicacaoDaOrigem(regra.view, escopo) : null;

  return (
    <>
      <PageBar
        title="Cashback"
        aside={
          <Tabs
            label="Qual regra editar"
            variant="barra"
            testIdPrefix="cashback-escopo"
            tabs={[
              { id: 'rede', label: 'Regra da rede' },
              { id: 'filial', label: 'Esta loja' },
            ]}
            value={escopo}
            onChange={(id) => setEscopo(id as EscopoDaRegra)}
          />
        }
      />

      <div className="cashback">
        {/*
          O AVISO ABRE A TELA E NÃO SOME. Ele não é o resultado de nada que o
          lojista fez — é a natureza do que esta tela grava —, então não é um
          alerta que aparece depois do erro: é a primeira coisa que se lê.
        */}
        <p className="alert alert--warn cashback__aviso" data-testid="cashback-aviso">
          <strong>Isto mexe em faturamento no mesmo minuto.</strong> Ligar a campanha liga o crédito
          e o resgate juntos, e o resgate entra como subtração na base da comissão — o primeiro
          pedido depois de salvar já fecha com outro número.
        </p>

        {escopo === 'filial' && hasChoice ? (
          <p className="faint cashback__filial" data-testid="cashback-filial">
            {isAutoResolved ? 'Sem filial escolhida, mostrando ' : 'Editando '}
            <strong>{branch ? branchName(branch) : '—'}</strong>. Troque no seletor do topo.
          </p>
        ) : null}

        {regra.errorMessage ? (
          <p className="alert alert--error" role="alert" data-testid="cashback-error">
            {regra.errorMessage}
          </p>
        ) : null}

        {regra.isLoading ? (
          <p className="muted">Carregando a regra…</p>
        ) : !draft ? (
          <p className="muted">Nenhuma filial para mostrar.</p>
        ) : (
          <>
            {/*
              A ORIGEM — a peça que só existe porque `source` existe.
              Sem ela, a filial que herda e a que tem regra própria mostram o
              mesmo formulário, e quem ajusta a terça-feira "da rede" numa tela
              de filial na verdade DESLIGA a herança daquela loja para sempre.
            */}
            {origem ? (
              <section className="cashback__origem" data-testid="cashback-origem">
                <p className="t-section">{origem.titulo}</p>
                <p className="t-aux">{origem.detalhe}</p>
                {escopo === 'filial' &&
                regra.view?.source === 'branch' &&
                pode('cashback.apagarSobrescrita') ? (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost-danger"
                    disabled={regra.isSaving}
                    onClick={() => void regra.apagarSobrescrita()}
                    data-testid="cashback-apagar"
                  >
                    Voltar a herdar a regra da rede
                  </button>
                ) : null}
              </section>
            ) : null}

            <fieldset className="cashback__form" disabled={!podeEscrever}>
              {/*
                A CHAVE É O PRIMEIRO CONTROLE, e o rótulo diz as DUAS coisas que
                ela liga. "Ativar cashback" esconderia que desligar também tira
                do cliente o direito de gastar o que já acumulou.
              */}
              <Switch
                checked={draft.enabled}
                onChange={(next) => alterar({ enabled: next })}
                label="Creditar e aceitar resgate de cashback"
                hint={
                  draft.enabled
                    ? 'Desligar interrompe o crédito E o resgate. O saldo já acumulado não some — fica parado até alguém religar.'
                    : 'Enquanto estiver desligado, ninguém acumula nem gasta cashback por esta regra.'
                }
                data-testid="cashback-enabled"
              />

              <div className="cashback__grade">
                <Field
                  label="Percentual base"
                  hint="Quanto do pedido volta como crédito, nos dias sem percentual próprio."
                  error={problema?.campo === 'defaultPercent' ? problema.message : null}
                >
                  <Input
                    inputMode="decimal"
                    suffix="%"
                    value={draft.defaultPercent}
                    onValueChange={(value) => alterar({ defaultPercent: value })}
                    data-testid="cashback-default-percent"
                  />
                </Field>

                <Field
                  label="Saldo mínimo para resgatar"
                  hint="Abaixo disso o crédito fica guardado. Vazio é zero — resgata de qualquer valor."
                  error={problema?.campo === 'minRedeemBalance' ? problema.message : null}
                >
                  <Input
                    inputMode="decimal"
                    prefix="R$"
                    value={draft.minRedeemBalance}
                    onValueChange={(value) => alterar({ minRedeemBalance: value })}
                    data-testid="cashback-min-redeem"
                  />
                </Field>

                <Field
                  label="Validade do crédito"
                  hint="O relógio reinicia a cada pedido: quem continua comprando não perde saldo."
                  error={problema?.campo === 'expiryDays' ? problema.message : null}
                >
                  <Input
                    inputMode="numeric"
                    suffix="dias"
                    value={draft.expiryDays}
                    onValueChange={(value) => alterar({ expiryDays: value })}
                    data-testid="cashback-expiry"
                  />
                </Field>
              </div>

              {/*
                A GRADE DA SEMANA — e o vazio dela é a informação mais
                importante da tela.

                Dia em branco HERDA o percentual base. Não é zero, e a diferença
                não é sutil: com zero, quem configurasse só a terça de 10%
                desligaria o cashback dos outros seis dias sem erro, sem log e
                com a tela mostrando exatamente o que ele digitou.

                É a INVERSÃO do PUT de horários, onde dia ausente significa dia
                FECHADO. As duas grades se parecem e significam o oposto — por
                isso o texto de apoio diz o que o vazio faz, em vez de deixar
                para o lojista descobrir.
              */}
              <section className="cashback__semana">
                <div className="cashback__semana-head">
                  <h2 className="t-section">Percentual por dia</h2>
                  <p className="t-aux">
                    Para mover o dia fraco. <strong>Dia em branco usa o percentual base</strong> — em
                    branco não é zero.
                  </p>
                </div>

                <ul className="cashback__dias">
                  {WEEKDAYS.map((dia) => {
                    const linha = draft.dias.find((d) => d.weekday === dia.weekday);
                    const erro =
                      problema?.campo === `dia-${dia.weekday}` ? problema.message : undefined;
                    return (
                      <li className="cashback__dia" key={dia.weekday}>
                        <Field label={dia.label} error={erro ?? null}>
                          <Input
                            inputMode="decimal"
                            suffix="%"
                            placeholder={draft.defaultPercent || 'base'}
                            value={linha?.percent ?? ''}
                            onValueChange={(value) => alterarDia(dia.weekday, value)}
                            data-testid={`cashback-dia-${dia.weekday}`}
                          />
                        </Field>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/*
                O AVISO DE PERCENTUAL INCOMUM — ele avisa e NÃO barra.

                O teto duro (30%) mora na validação e recusa o salvamento: ele é
                guarda de digitação, o que separa "10" de "100". Este aqui é
                opinião — acima de 10% ainda pode ser deliberado, e barrar o
                lojista de fazer o que ele quis seria a tela decidindo o negócio
                dele.
              */}
              {incomuns.length > 0 ? (
                <p className="alert alert--warn" data-testid="cashback-incomum">
                  Acima de 10% é raro, e o teto desta tela é {TETO_PERCENTUAL}%. Confira antes de
                  salvar: <strong>{incomuns.join(', ')}</strong>.
                </p>
              ) : null}
            </fieldset>

            {/*
              A BARRA DE SALVAR SÓ EXISTE PARA QUEM GRAVA. Para o gerente ela
              seria uma faixa permanente com um botão que responde 403 — o
              oposto de "some o controle, fica o dado".
            */}
            {podeEscrever ? (
              <SaveBar
                isSaving={regra.isSaving}
                isDirty={regra.isDirty}
                savedAt={regra.savedAt}
                /*
                 * O ERRO DE VALIDAÇÃO SOBE PARA A BARRA, além de ficar no campo.
                 * O formulário tem onze campos e a grade da semana é a parte de
                 * baixo: com a barra grudada no rodapé, o lojista clica em
                 * Salvar sem o campo culpado na tela, e sem esta frase o botão
                 * simplesmente não faria nada.
                 */
                errorMessage={regra.errorMessage ?? (problema ? problema.message : null)}
                onSave={() => {
                  if (problemaDoDraft(draft)) return;
                  void regra.salvar(draft);
                }}
                onReset={() => void regra.recarregar()}
              />
            ) : (
              <p className="faint" data-testid="cashback-somente-leitura">
                Só o dono do restaurante altera a regra de cashback.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
