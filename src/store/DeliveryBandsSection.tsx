import { useEffect, useState } from 'react';

import { usePermissoes } from '../auth/use-permissions';
// Remover é o `XIcon` do sistema: não existe ícone de lixeira, e criar um
// aqui começaria um segundo conjunto de ícones por causa de uma linha.
import { PlusIcon, XIcon } from '../ds/icons';
import { bandsFromDraft, draftFromBands, novaFaixa, type BandDraft } from './delivery-bands';
import type { useDeliveryBands } from './useDeliveryBands';

/**
 * ============================================================================
 * O PRAZO POR DISTÂNCIA — a tabelinha que substitui o tempo do Google
 * ============================================================================
 *
 * O QUE ESTA TABELA RESOLVE. O prazo saía do tempo de rota do Google, que é
 * tempo de DIRIGIR: ele não inclui ensacar o pedido, a segunda entrega da mesma
 * corrida, estacionar e subir escada. Por isso o prazo saía curto justamente no
 * bairro longe, que é onde o cliente já desconfia. O lojista sabe esse número;
 * a API não.
 *
 * OS MINUTOS SÃO O DESLOCAMENTO, E O PREPARO CONTINUA SOMANDO. Está escrito na
 * tela, uma vez, porque é a única maneira de o lojista digitar o número certo:
 * quem acha que a faixa é o prazo total escreve 50 onde devia escrever 25, e o
 * cliente passa a receber uma promessa com o preparo contado duas vezes.
 *
 * ELA NÃO É O "TEMPO ESTIMADO" DE GERAL, e a seção diz isso — é o erro mais
 * fácil desta tela. Aquele é o rótulo de VITRINE do cardápio, mostrado antes de
 * existir endereço; este é o prazo de um endereço concreto, e um nunca vira o
 * outro.
 *
 * A LINHA É UM TETO, não um intervalo. Vale a primeira faixa, em ordem
 * crescente, cujo teto alcança a distância — então a tabela não tem buraco: o
 * que a linha de cima não pegou cai na de baixo. É por isso que a coluna se
 * chama "até".
 */
export function DeliveryBandsSection({ bands }: { bands: ReturnType<typeof useDeliveryBands> }) {
  const { pode } = usePermissoes();
  const podeEditar = pode('loja.editarFaixasDePrazo');

  const [draft, setDraft] = useState<BandDraft[]>([]);
  const [baseline, setBaseline] = useState<BandDraft[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const { bands: gravadas } = bands;

  useEffect(() => {
    if (!gravadas) return;
    const proximo = draftFromBands(gravadas);
    setDraft(proximo);
    setBaseline(proximo);
  }, [gravadas]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  function patch(key: string, mudanca: Partial<BandDraft>) {
    setDraft((atual) =>
      atual.map((linha) => (linha.key === key ? { ...linha, ...mudanca } : linha)),
    );
    setProblem(null);
  }

  async function handleSave() {
    const resultado = bandsFromDraft(draft);
    if (!resultado.ok) return setProblem(resultado.message);
    await bands.save(resultado.bands);
  }

  return (
    <section className="store-form__section" data-testid="delivery-bands">
      <div className="store-form__section-head">
        <h2 className="store-form__heading">Prazo por distância</h2>
        <span className="faint">Substitui o tempo de rota. O preparo continua somando.</span>
      </div>

      {/*
        A RESSALVA QUE SEPARA ESTA TABELA DO CAMPO DE GERAL. As duas coisas são
        minutos de entrega em telas do mesmo painel, e uma delas é vitrine.
      */}
      <p className="field__hint">
        Não é o “tempo estimado” de Geral, que é o rótulo do cardápio, mostrado antes de o cliente
        digitar o endereço. Aqui é o prazo real de cada distância. Sem faixa cadastrada, vale o
        tempo de rota do Google.
      </p>

      {bands.isLoading ? (
        <p className="muted store__loading">Carregando as faixas…</p>
      ) : bands.loadError ? (
        <p className="alert alert--error" role="alert">
          {bands.loadError}
        </p>
      ) : (
        <>
          {draft.length === 0 ? (
            <p className="field__hint" data-testid="delivery-bands-vazio">
              Nenhuma faixa cadastrada: o prazo de entrega sai do tempo de rota do Google, somado ao
              preparo.
            </p>
          ) : (
            <div className="faixas">
              <span className="faixas__col">Até</span>
              <span className="faixas__col">Deslocamento</span>
              <span aria-hidden="true" />

              {draft.map((linha) => (
                <div className="faixas__linha" key={linha.key}>
                  <span className="faixas__km">
                    <input
                      className="input tnum"
                      inputMode="decimal"
                      aria-label="Distância máxima desta faixa, em quilômetros"
                      value={linha.maxDistanceKm}
                      disabled={!podeEditar}
                      onChange={(evento) =>
                        patch(linha.key, { maxDistanceKm: evento.target.value })
                      }
                      data-testid={`band-km-${linha.key}`}
                    />
                    <span className="faixas__unidade">km</span>
                  </span>

                  <span className="faixas__tempo">
                    <input
                      className="input tnum"
                      inputMode="numeric"
                      aria-label="Tempo mínimo de deslocamento, em minutos"
                      value={linha.timeMin}
                      disabled={!podeEditar}
                      onChange={(evento) => patch(linha.key, { timeMin: evento.target.value })}
                      data-testid={`band-min-${linha.key}`}
                    />
                    <span className="faixas__sep" aria-hidden="true">
                      a
                    </span>
                    <input
                      className="input tnum"
                      inputMode="numeric"
                      aria-label="Tempo máximo de deslocamento, em minutos"
                      value={linha.timeMax}
                      disabled={!podeEditar}
                      onChange={(evento) => patch(linha.key, { timeMax: evento.target.value })}
                      data-testid={`band-max-${linha.key}`}
                    />
                    <span className="faixas__unidade">min</span>
                  </span>

                  {podeEditar ? (
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost icon-btn"
                      aria-label={`Remover a faixa até ${linha.maxDistanceKm || '—'} km`}
                      onClick={() => {
                        setDraft((atual) => atual.filter((outra) => outra.key !== linha.key));
                        setProblem(null);
                      }}
                      data-testid={`band-remove-${linha.key}`}
                    >
                      <XIcon size={14} />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          )}

          {podeEditar ? (
            <div className="faixas__acoes">
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => setDraft((atual) => [...atual, novaFaixa()])}
                data-testid="band-add"
              >
                <PlusIcon />
                Nova faixa
              </button>

              {/*
                APAGAR TUDO É UMA AÇÃO NOMEADA, e não o efeito colateral de
                remover a última linha: `{"bands": []}` não é "sem entrega", é o
                prazo voltando a sair do Google. Dito assim, quem clica sabe o
                que ganha em troca.
              */}
              {draft.length > 0 ? (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setDraft([]);
                    setProblem(null);
                  }}
                  data-testid="band-clear"
                >
                  Voltar a usar o tempo do Google
                </button>
              ) : null}
            </div>
          ) : null}

          {/*
            A TABELA SALVA A SI MESMA, e não pela barra grudenta da aba.
            
            São duas gravações independentes na mesma tela: a cobrança vai por
            `PATCH .../{id}` e as faixas por `PUT .../delivery-time-bands`, com
            permissões diferentes. Duas barras grudentas se empilhariam no
            rodapé, e o botão de uma é `type="submit"` — clicar em salvar as
            faixas mandaria a taxa junto, que é a gravação que ninguém pediu.
          */}
          {podeEditar && (isDirty || problem || bands.saveError) ? (
            <div className="faixas__salvar">
              {(problem ?? bands.saveError) ? (
                <p className="alert alert--error" role="alert" data-testid="delivery-bands-error">
                  {problem ?? bands.saveError}
                </p>
              ) : null}

              {isDirty ? (
                <div className="faixas__salvar-botoes">
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={bands.isSaving}
                    onClick={() => {
                      setDraft(baseline);
                      setProblem(null);
                    }}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--primary"
                    disabled={bands.isSaving}
                    onClick={() => void handleSave()}
                    data-testid="delivery-bands-save"
                  >
                    {bands.isSaving ? 'Salvando…' : 'Salvar faixas'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
