import { usePermissoes } from '../auth/use-permissions';
import { semTaxa, textoDaTaxa } from '../couriers/courier-fee';
import type { useCourierFee } from '../couriers/useCourierFee';

/**
 * ============================================================================
 * A TAXA POR CORRIDA — o que a LOJA paga ao motoboy
 * ============================================================================
 *
 * ELA MORA AO LADO DO FRETE PORQUE A PERGUNTA É A MESMA ("quanto custa essa
 * entrega?"), e é exatamente por isso que ela precisa dizer, na primeira linha,
 * que é o outro lado do balcão. Dois pares de campos com a mesma fórmula, na
 * mesma aba, é a receita para alguém ajustar o valor errado — e o valor errado
 * aqui é o que o CLIENTE paga.
 *
 * SEÇÃO PRÓPRIA, ROTA PRÓPRIA, BOTÃO PRÓPRIO, pelo mesmo motivo das faixas de
 * prazo logo abaixo: `PATCH .../courier-fee` é SOMENTE_DONO enquanto o resto da
 * aba é da gerência. Um botão só faria o 403 de uma metade parecer falha da
 * outra, e faria salvar o frete reenviar a taxa do motoboy junto.
 *
 * ----------------------------------------------------------------------------
 * QUEM LÊ E QUEM ESCREVE SÃO PAPÉIS DIFERENTES, E A TELA MOSTRA OS DOIS ESTADOS
 * ----------------------------------------------------------------------------
 *
 * A gerência LÊ (precisa saber quanto a loja paga para conferir o acerto do
 * motoboy no fim do dia) e não grava. Para ela a seção aparece inteira, com o
 * valor em texto e sem os campos — o painel SOME, NÃO DESABILITA: campo
 * cinzento sem explicação é a pessoa tentando e não conseguindo, e um `title`
 * não sobrevive ao toque.
 *
 * O que NÃO some é a seção: esconder tudo faria a gerência concluir que a loja
 * não paga o motoboy pelo painel, e ela voltaria a perguntar ao dono por
 * WhatsApp — que é o trabalho que esta tela existe para acabar.
 */
export function CourierFeeSection({ taxa }: { taxa: ReturnType<typeof useCourierFee> }) {
  const { pode } = usePermissoes();
  const podeEditar = pode('entregadores.editarTaxa');

  const { fee, draft, isDirty, isLoading, isSaving, errorMessage, problem, salvou } = taxa;

  return (
    <section className="store-form__section" data-testid="courier-fee">
      <h2 className="store-form__heading">O que a loja paga ao entregador</h2>
      <p className="field__hint">
        É a taxa da CORRIDA, e não o frete acima: este número não aparece para o cliente e não entra
        no total do pedido. Ele existe para o acerto com o motoboy no fim do dia.
      </p>

      {isLoading ? <p className="muted">Carregando a taxa…</p> : null}

      {/*
        LEITURA QUE FALHOU NÃO VIRA "SEM TAXA". Sem a resposta, a tela não
        afirma nada sobre quanto a loja paga — dizer "sem taxa" numa queda de
        rede é a pior frase que esta seção pode dizer errado.
      */}
      {errorMessage ? (
        <p className="alert alert--error" role="alert" data-testid="courier-fee-error">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !errorMessage ? (
        <>
          <p className="store-form__valor" data-testid="courier-fee-atual">
            {textoDaTaxa(fee)}
          </p>

          {/*
            "SEM TAXA" É UM ESTADO EXPLICADO, e não um campo em branco. Ele é o
            padrão de toda filial que nunca configurou nada, e o dono precisa
            saber o que acontece com o histórico do motoboy nesse estado — senão
            ele lê "R$ 0,00" nas corridas e conclui que já pagou.
          */}
          {semTaxa(fee) ? (
            <p className="field__hint" data-testid="courier-fee-sem-taxa">
              Sem taxa, as corridas entram no histórico do entregador <strong>sem valor</strong> — e
              não como zero. Quem combina o pagamento é você, fora do painel.
            </p>
          ) : null}
        </>
      ) : null}

      {podeEditar && !isLoading && !errorMessage ? (
        <>
          <div className="store-form__grid">
            <label className="field">
              <span className="field__label">Taxa por corrida</span>
              <input
                className="input tnum"
                inputMode="decimal"
                value={draft.base}
                onChange={(event) => taxa.editar({ base: event.target.value })}
                data-testid="courier-fee-base"
              />
              <span className="field__hint">Em branco é sem taxa fixa.</span>
            </label>

            <label className="field">
              <span className="field__label">Valor por km</span>
              <input
                className="input tnum"
                inputMode="decimal"
                value={draft.perKm}
                onChange={(event) => taxa.editar({ perKm: event.target.value })}
                data-testid="courier-fee-per-km"
              />
              <span className="field__hint">
                Em branco é só a taxa fixa. Preencher os dois soma os dois.
              </span>
            </label>
          </div>

          {/*
            O AVISO QUE EVITA O CHAMADO. Mudar a taxa às 19h não muda a corrida
            que o motoboy pegou às 18h: o valor é congelado na atribuição
            (`courier_fee_snapshot`), como `unit_price_snapshot` faz com o preço
            do item. Sem esta linha, o dono corrige a taxa e vai conferir o
            histórico esperando ver o número novo lá atrás.
          */}
          <p className="field__hint" data-testid="courier-fee-congelada">
            Mudar aqui vale para as <strong>próximas</strong> corridas. As que já foram atribuídas
            guardam a taxa do momento em que saíram, e não mudam.
          </p>

          {problem ? (
            <p className="alert alert--error" role="alert" data-testid="courier-fee-problema">
              {problem}
            </p>
          ) : null}

          {salvou && !isDirty ? (
            <p className="alert alert--info" role="status" data-testid="courier-fee-salvo">
              Taxa salva.
            </p>
          ) : null}

          {isDirty ? (
            <div className="faixas__salvar-botoes">
              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={isSaving}
                onClick={() => void taxa.salvar()}
                data-testid="courier-fee-save"
              >
                {isSaving ? 'Salvando…' : 'Salvar a taxa'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {!podeEditar && !isLoading && !errorMessage ? (
        <p className="field__hint" data-testid="courier-fee-so-leitura">
          Quem muda a taxa é o proprietário.
        </p>
      ) : null}
    </section>
  );
}
