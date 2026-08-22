import { useEffect, useState } from 'react';

import type { RestaurantSettingsUpdate } from '../api/types';
import { Checkbox } from '../ds/Checkbox';
import { Field } from '../ds/Field';
import { Input } from '../ds/Input';
import { RangeInput } from '../ds/RangeInput';
import { Textarea } from '../ds/Textarea';
import {
  checkFooter,
  countFooterLines,
  FOOTER_MAX_CHARS,
  FOOTER_MAX_LINES,
} from '../print-sectors/print-settings';
import { SaveBar } from './SaveBar';
import {
  checkEstimatedRange,
  formatDecimalInput,
  formatIntegerInput,
  parseDecimal,
  parseInteger,
} from './settings-model';
import type { useStoreSettings } from './useStoreSettings';

type Draft = {
  minOrderValue: string;
  estimatedMin: string;
  estimatedMax: string;
  serviceFeeEnabled: boolean;
  serviceFeeAmount: string;
  freeDeliveryEnabled: boolean;
  freeDeliveryMin: string;
  /** A mensagem da MARCA no rodapé da comanda. Vazio = não há mensagem. */
  receiptFooter: string;
};

const EMPTY: Draft = {
  minOrderValue: '',
  estimatedMin: '',
  estimatedMax: '',
  serviceFeeEnabled: true,
  serviceFeeAmount: '',
  /*
   * DESLIGADO POR PADRÃO, e a assimetria com a taxa de serviço acima é
   * proposital: taxa ligada sem valor cobra zero e não machuca ninguém; frete
   * grátis ligado por omissão dá a entrega de graça em nome de um lojista que
   * não pediu. É o que o backend resolve, e a tela não pode abrir dizendo outra
   * coisa.
   */
  freeDeliveryEnabled: false,
  freeDeliveryMin: '',
  receiptFooter: '',
};

/**
 * Configurações do RESTAURANTE inteiro — as mesmas para todas as filiais. É a
 * única aba desta tela que funciona com "Todas as filiais" no cabeçalho.
 *
 * "ACEITA ENTREGA" E "ACEITA RETIRADA" SAÍRAM DAQUI. Eles passaram a ser de
 * cada filial (`PATCH /admin/branches/{id}/order-types`) e não existem mais em
 * `AdminRestaurantSettingsUpdate` — mandá-los neste PATCH responde 422, e
 * levava junto o resto do formulário. O quiosque que só faz retirada desligava
 * a entrega da rede inteira, que é o defeito que a mudança fecha.
 *
 * `default_delivery_fee` NÃO ESTÁ AQUI, de propósito. A API aceita editá-lo,
 * mas ele não entra em cobrança nenhuma: o frete cobrado sai das regras por km
 * da filial (aba Entrega). Um campo de "taxa de entrega padrão" que não altera
 * o que o cliente paga é pior que campo faltando — o lojista mexe nele achando
 * que baixou o frete e o app continua cobrando o mesmo.
 *
 * ============================================================================
 * O DESENHO DO FORMULÁRIO — o que mudou na rodada de direção visual
 * ============================================================================
 *
 * ELE USA O DESIGN SYSTEM AGORA. Eram `<label className="field">` e
 * `<input className="input">` montados à mão, com o rótulo, a ajuda e o campo
 * ligados só pelo aninhamento. `Field` + `Input` fazem `htmlFor`/`id`,
 * `aria-describedby` e `aria-invalid` uma vez só, e o afixo "R$" passa a viver
 * DENTRO da caixa.
 *
 * O CAMPO TEM A LARGURA DO QUE CABE DENTRO DELE. "20,00" morava numa caixa de
 * 912px porque a grade esticava tudo até a coluna acabar — é o sintoma nº 1 de
 * formulário com aparência de HTML padrão. Com `--dinheiro` e `--faixa` (tetos
 * de conteúdo declarados em tokens.css), a caixa diz pelo tamanho o que se
 * escreve nela.
 *
 * DOIS GRUPOS, UMA SUPERFÍCIE. Eram dois cartões contornados para dois grupos
 * de dois campos. Agora é uma superfície com um fio entre os grupos, e o nome
 * do grupo mora numa coluna própria à esquerda: a hierarquia passa a ser
 * posição, e não mais dois títulos de 16px dentro de uma tela que já tinha
 * outro.
 */
export function GeneralTab({ settings }: { settings: ReturnType<typeof useStoreSettings> }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [baseline, setBaseline] = useState<Draft>(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);

  const loaded = settings.settings;

  useEffect(() => {
    if (!loaded) return;
    const next: Draft = {
      minOrderValue: formatDecimalInput(loaded.min_order_value),
      estimatedMin: formatIntegerInput(loaded.estimated_delivery_time_min),
      estimatedMax: formatIntegerInput(loaded.estimated_delivery_time_max),
      // O backend manda `boolean | null` com padrão true: só o `false`
      // explícito desliga.
      serviceFeeEnabled: loaded.service_fee_enabled !== false,
      serviceFeeAmount: formatDecimalInput(loaded.service_fee_amount),
      // Nulo aqui é "não configurado", e o backend o resolve como desligado —
      // não é "herda": acima do restaurante não há de quem herdar.
      freeDeliveryEnabled: loaded.free_delivery_enabled === true,
      freeDeliveryMin: formatDecimalInput(loaded.free_delivery_min_order_value),
      /*
       * AQUI NÃO HÁ TRÊS ESTADOS, e é a diferença para a mesma mensagem na
       * filial: acima do restaurante não há de quem herdar, então vazio e nulo
       * dizem a mesma coisa — não há mensagem da marca. Quem precisa distinguir
       * "herdar" de "não imprimir" é a filial, em Impressão.
       */
      receiptFooter: loaded.receipt_footer_message ?? '',
    };
    setDraft(next);
    setBaseline(next);
  }, [loaded]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  function patch(change: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...change }));
    setProblem(null);
  }

  async function handleSave() {
    const minOrder = parseDecimal(draft.minOrderValue, { allowEmpty: false });
    if (!minOrder.ok) return setProblem(`Valor mínimo do pedido: ${minOrder.message}`);

    const estimatedMin = parseInteger(draft.estimatedMin);
    if (!estimatedMin.ok) return setProblem(`Tempo estimado mínimo: ${estimatedMin.message}`);

    const estimatedMax = parseInteger(draft.estimatedMax);
    if (!estimatedMax.ok) return setProblem(`Tempo estimado máximo: ${estimatedMax.message}`);

    const rangeProblem = checkEstimatedRange(estimatedMin.value, estimatedMax.value);
    if (rangeProblem) return setProblem(rangeProblem);

    const serviceFee = parseDecimal(draft.serviceFeeAmount, {
      // Com a taxa ligada o valor é obrigatório: taxa ligada e vazia cobraria
      // um número que ninguém escolheu.
      allowEmpty: !draft.serviceFeeEnabled,
    });
    if (!serviceFee.ok) return setProblem(`Taxa de serviço: ${serviceFee.message}`);

    /*
     * O MESMO TETO DA FILIAL, conferido pela mesma função — 240 caracteres e 6
     * linhas são da BOBINA, não do banco, e valem para as duas pontas. Aqui o
     * modo é sempre "escrever": o restaurante não herda de ninguém.
     */
    const rodape = checkFooter({
      footerMode: draft.receiptFooter.trim() === '' ? 'nao-imprime' : 'propria',
      footerText: draft.receiptFooter,
      customerDelivery: 0,
      productionDelivery: 0,
      customerPickup: 0,
      productionPickup: 0,
    });
    if (!rodape.valid) return setProblem(`Mensagem no rodapé: ${rodape.message}`);

    const freteGratisMin = parseDecimal(draft.freeDeliveryMin, {
      // Com a campanha ligada o valor é obrigatório: ligada e sem teto, a
      // entrega sai de graça em todo pedido da rede inteira.
      allowEmpty: !draft.freeDeliveryEnabled,
    });
    if (!freteGratisMin.ok) return setProblem(`Frete grátis: ${freteGratisMin.message}`);

    const body: RestaurantSettingsUpdate = {
      min_order_value: minOrder.value,
      estimated_delivery_time_min: estimatedMin.value,
      estimated_delivery_time_max: estimatedMax.value,
      service_fee_enabled: draft.serviceFeeEnabled,
      service_fee_amount: serviceFee.value ?? 0,
      free_delivery_enabled: draft.freeDeliveryEnabled,
      free_delivery_min_order_value: freteGratisMin.value,
      // Vazio vira `null`: "não há mensagem da marca". Isso NÃO cala a filial
      // que gravou a própria — só a que estava herdando esta.
      receipt_footer_message: draft.receiptFooter.trim() === '' ? null : draft.receiptFooter,
    };

    if (await settings.save(body)) setBaseline(draft);
  }

  if (settings.isLoading)
    return <p className="muted store__loading">Carregando as configurações…</p>;

  return (
    <form
      className="store-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <div className="store-form__folha">
        <section className="store-form__group">
          <h3 className="store-form__heading">Pedido</h3>

          <div className="store-form__fields">
            <Field label="Valor mínimo do pedido" hint="Abaixo disso o cliente não fecha o pedido.">
              {/* O "R$" é afixo interno: fora da caixa ele lê como outra coluna. */}
              <Input
                className="ds-control--dinheiro tnum"
                prefix="R$"
                inputMode="decimal"
                value={draft.minOrderValue}
                onValueChange={(minOrderValue) => patch({ minOrderValue })}
                data-testid="settings-min-order"
              />
            </Field>

            {/*
              Mínimo e máximo são UM campo: eles formam uma faixa, sempre são
              editados juntos e o backend os valida em par. Em duas caixas
              rotuladas separadamente, cada uma pedia o próprio rótulo de três
              palavras e a própria linha de ajuda — três campos onde há dois
              números.
            */}
            <Field label="Tempo estimado" hint="É a faixa que o cliente vê ao escolher a loja.">
              <RangeInput
                className="ds-range--faixa"
                suffix="min"
                from={{
                  value: draft.estimatedMin,
                  onValueChange: (estimatedMin) => patch({ estimatedMin }),
                  label: 'Tempo estimado mínimo, em minutos',
                  'data-testid': 'settings-eta-min',
                }}
                to={{
                  value: draft.estimatedMax,
                  onValueChange: (estimatedMax) => patch({ estimatedMax }),
                  label: 'Tempo estimado máximo, em minutos',
                  'data-testid': 'settings-eta-max',
                }}
              />
            </Field>
          </div>
        </section>

        <section className="store-form__group">
          <h3 className="store-form__heading">Taxa de serviço</h3>

          {/* A caixa de marcar comanda o campo abaixo: desligada, ele apaga. */}
          <div className="store-form__fields">
            <Checkbox
              checked={draft.serviceFeeEnabled}
              onChange={(serviceFeeEnabled) => patch({ serviceFeeEnabled })}
              label="Cobrar taxa de serviço"
              data-testid="settings-service-fee-enabled"
            />

            <Field label="Valor da taxa" disabled={!draft.serviceFeeEnabled}>
              <Input
                className="ds-control--dinheiro tnum"
                prefix="R$"
                inputMode="decimal"
                value={draft.serviceFeeAmount}
                onValueChange={(serviceFeeAmount) => patch({ serviceFeeAmount })}
                data-testid="settings-service-fee-amount"
              />
            </Field>
          </div>
        </section>

        {/*
          A MENSAGEM DA MARCA NO RODAPÉ DA COMANDA.

          Ela mora aqui, e não em Impressão, porque é padrão de RESTAURANTE como
          os números acima: a filial que não gravou a própria imprime esta. Em
          Impressão, cada filial escolhe entre herdar isto, escrever a dela ou
          não imprimir rodapé nenhum.

          É espaço de graça no papel que já sai e já chega na mão de quem pediu
          — e deixa de ser de graça quando vira meio metro de propaganda em todo
          pedido, que é o que os dois tetos seguram.
        */}
        {/*
          FRETE GRÁTIS ACIMA DE X — o padrão da rede, que cada filial herda,
          sobrescreve ou RECUSA em Valores.

          Ele fica aqui e não em Entrega porque é termo comercial e herda, como
          o valor mínimo e a taxa de serviço logo acima. As regras de Entrega
          (base, por km, raio) são da filial e não herdam nada — misturar os
          dois regimes na mesma tela é o jeito mais barato de fazer alguém
          preencher o campo errado.
        */}
        <section className="store-form__group">
          <h3 className="store-form__heading">Frete grátis</h3>

          <div className="store-form__fields">
            <Checkbox
              checked={draft.freeDeliveryEnabled}
              onChange={(freeDeliveryEnabled) => patch({ freeDeliveryEnabled })}
              label="Dar frete grátis acima de um valor"
              data-testid="settings-free-delivery-enabled"
            />

            <Field
              label="Acima de"
              disabled={!draft.freeDeliveryEnabled}
              hint="Vale sobre o SUBTOTAL, e o pedido que bate o valor exato já entra. Quem não quiser dar desliga em Valores, na filial."
            >
              <Input
                className="ds-control--dinheiro tnum"
                prefix="R$"
                inputMode="decimal"
                value={draft.freeDeliveryMin}
                onValueChange={(freeDeliveryMin) => patch({ freeDeliveryMin })}
                data-testid="settings-free-delivery-min"
              />
            </Field>
          </div>
        </section>

        <section className="store-form__group">
          <h3 className="store-form__heading">Rodapé da comanda</h3>

          <div className="store-form__fields">
            {/* A mesma largura de bobina do campo em Impressão: 48 colunas. */}
            <div className="rodape__campo">
              <Field
                label="Mensagem da marca"
                hint={`Sai no fim da via do cliente, em todas as filiais que não escreverem a própria. Até ${FOOTER_MAX_CHARS} caracteres e ${FOOTER_MAX_LINES} linhas.`}
              >
                <Textarea
                  rows={3}
                  maxLength={FOOTER_MAX_CHARS}
                  value={draft.receiptFooter}
                  placeholder="@nossaloja · peça direto e ganhe 5% de volta"
                  onValueChange={(receiptFooter) => patch({ receiptFooter })}
                  data-testid="settings-receipt-footer"
                />
              </Field>

              {/*
                O CONTADOR É DO CAMPO, e por isso mora DENTRO do mesmo item da
                grade. Solto como irmão, `store-form__fields` o tratava como um
                segundo campo e o punha na coluna ao lado — "40/240" a 400px da
                caixa que ele conta.
              */}
              <div className="rodape__meta">
                <span className="faint">
                  {countFooterLines(draft.receiptFooter)} de {FOOTER_MAX_LINES} linhas
                </span>
                <span className="faint tnum">
                  {draft.receiptFooter.length}/{FOOTER_MAX_CHARS}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <SaveBar
        isSaving={settings.isSaving}
        isDirty={isDirty}
        savedAt={settings.savedAt}
        errorMessage={problem ?? settings.errorMessage}
        onSave={() => void handleSave()}
        onReset={() => {
          setDraft(baseline);
          setProblem(null);
        }}
      />
    </form>
  );
}
