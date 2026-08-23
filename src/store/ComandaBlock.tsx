import { useEffect, useState } from 'react';

import { Field } from '../ds/Field';
import { Select } from '../ds/Select';
import { Textarea } from '../ds/Textarea';
import {
  bodyFromDraft,
  countFooterLines,
  describeCopies,
  draftFromSettings,
  COPIES_MAX,
  EMPTY_PRINT_DRAFT,
  FOOTER_MAX_CHARS,
  FOOTER_MAX_LINES,
  type FooterMode,
  type PrintSettingsDraft,
} from '../print-sectors/print-settings';
import type { usePrintSettings } from '../print-sectors/usePrintSettings';
import { SaveBar } from './SaveBar';

/** As opções de contagem: 0 a 5, e o zero é a primeira porque é uma escolha. */
const OPCOES_DE_VIA = Array.from({ length: COPIES_MAX + 1 }, (_, n) => ({
  value: String(n),
  label: String(n),
}));

/*
 * "HERDAR", E NÃO "HERDAR DA MARCA": é o rótulo que a taxa de serviço já usa em
 * Valores, na mesma gramática de três opções, e os quatro caracteres a mais
 * faziam o trilho estourar os 390px do telefone — "Escrever a desta loja" saía
 * cortado na margem direita. De quem se herda está dito na ajuda logo abaixo, e
 * o que se escreve está dito no rótulo do campo que a terceira opção abre.
 */
const MODOS: readonly { value: FooterMode; label: string }[] = [
  { value: 'herda', label: 'Herdar' },
  { value: 'nao-imprime', label: 'Não imprimir' },
  { value: 'propria', label: 'Escrever a desta loja' },
];

/**
 * ============================================================================
 * COMO A COMANDA SAI — as vias e o rodapé
 * ============================================================================
 *
 * Dois blocos e um formulário só, porque são a mesma pergunta do lojista ("como
 * a minha comanda sai?") e porque as duas configurações vivem na mesma rota.
 *
 * ----------------------------------------------------------------------------
 * OS DOIS REGIMES, DITOS SEM PARÁGRAFO
 * ----------------------------------------------------------------------------
 *
 * A mensagem HERDA o padrão da marca; as vias NÃO herdam nada. Explicar isso em
 * prosa custaria uma dobra de tela numa página que se usa em pé, no balcão. Ele
 * está dito de duas maneiras que não custam altura nenhuma:
 *
 *   - a nota do bloco das vias diz "só desta filial";
 *   - o rodapé abre com uma opção chamada "Herdar", e a ajuda dela diz de quem.
 *
 * Um bloco oferece herdar e o outro não — a diferença se lê na existência do
 * controle, que é onde ela de fato mora.
 *
 * ----------------------------------------------------------------------------
 * O RODAPÉ SÃO TRÊS OPÇÕES, E NÃO UMA CAIXA DE TEXTO
 * ----------------------------------------------------------------------------
 *
 * O campo tem três estados no backend e dois deles apareceriam IGUAIS numa
 * caixa vazia: "voltar a herdar a mensagem da marca" (`null`) e "esta loja não
 * imprime rodapé" (`""`). Mandar o segundo onde se queria o primeiro desliga a
 * campanha da rede naquela loja, e ninguém descobre — não há tela onde isso
 * apareça, só a bobina que parou de sair com a mensagem.
 *
 * É a mesma gramática da taxa de serviço em Valores (Herdar · Cobrar · Não
 * cobrar), e de propósito: o lojista já aprendeu que a primeira opção é seguir
 * a rede e que a do meio é uma escolha desta loja, não a ausência de uma.
 *
 * A CAIXA VAZIA EM "ESCREVER" É ERRO, e não um `""` silencioso — quem quer
 * desligar tem uma opção com esse nome. Ver `print-settings.ts`.
 *
 * ----------------------------------------------------------------------------
 * AS VIAS SÃO SELETORES, E ISSO TAMBÉM É SOBRE O VAZIO
 * ----------------------------------------------------------------------------
 *
 * Num campo de número, apagar o conteúdo devolve uma caixa vazia — e vazio aqui
 * não tem significado nenhum: `null` numa contagem é 422, porque as quatro
 * colunas são `NOT NULL` e não herdam nada. Um seletor de 0 a 5 não tem estado
 * vazio para oferecer, e põe o ZERO como uma escolha visível em vez de um campo
 * que alguém limpou. Zero é o caso de uso que originou a coisa toda: a retirada
 * normalmente não leva a via do cliente, que é a que iria grampeada na sacola.
 */
export function ComandaBlock({
  print,
  podeEditar,
}: {
  print: ReturnType<typeof usePrintSettings>;
  /** `PATCH .../print-settings` é da gerência; o GET é de quem opera. */
  podeEditar: boolean;
}) {
  const [draft, setDraft] = useState<PrintSettingsDraft>(EMPTY_PRINT_DRAFT);
  const [baseline, setBaseline] = useState<PrintSettingsDraft>(EMPTY_PRINT_DRAFT);
  const [problem, setProblem] = useState<string | null>(null);

  const { settings } = print;

  /*
   * O QUE VOLTOU DO BACKEND REPINTA O CAMPO. Ele normaliza o texto na gravação,
   * então o rascunho pode divergir do que ficou gravado logo depois de salvar —
   * a tela mostrando uma coisa e a bobina imprimindo outra é o defeito que
   * ninguém descobre até o papel sair.
   */
  useEffect(() => {
    if (!settings) return;
    const proximo = draftFromSettings(settings);
    setDraft(proximo);
    setBaseline(proximo);
  }, [settings]);

  if (print.isLoading) return <p className="muted store__loading">Carregando a comanda…</p>;

  if (!settings)
    return (
      <p className="alert alert--error" role="alert">
        {print.loadError ?? 'Não consegui ler a configuração da comanda desta filial.'}
      </p>
    );

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  function patch(mudanca: Partial<PrintSettingsDraft>) {
    setDraft((atual) => ({ ...atual, ...mudanca }));
    setProblem(null);
  }

  async function handleSave() {
    if (!settings) return;

    const resultado = bodyFromDraft(draft, settings);
    if (!resultado.ok) return setProblem(resultado.message);

    // Nada mudou de fato: não gasta a requisição, e o efeito acima já
    // devolveria o mesmo rascunho.
    if (resultado.vazio) {
      setBaseline(draft);
      return;
    }

    await print.save(resultado.body);
  }

  const efetivo = settings.effective_receipt_footer_message ?? '';
  const caracteres = draft.footerText.length;
  const linhas = countFooterLines(draft.footerText);

  return (
    <>
      {/* --- AS VIAS ------------------------------------------------------ */}
      <section className="store-form__section" data-testid="print-copies-block">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Vias impressas</h2>
          {/*
            "Só desta filial" é metade da explicação dos dois regimes, e ela
            cabe na nota que o bloco já tinha.
          */}
          <span className="faint">Quantas folhas saem por pedido. Só desta filial.</span>
        </div>

        {podeEditar ? (
          <div className="vias">
            <span className="vias__canto" aria-hidden="true" />
            <span className="vias__coluna">Entrega</span>
            <span className="vias__coluna">Retirada</span>

            <ViaLinha
              nome="Do cliente"
              ajuda="a que vai na sacola"
              entrega={{
                value: draft.customerDelivery,
                label: 'Vias do cliente na entrega',
                testId: 'print-copies-customer-delivery',
                onChange: (customerDelivery) => patch({ customerDelivery }),
              }}
              retirada={{
                value: draft.customerPickup,
                label: 'Vias do cliente na retirada',
                testId: 'print-copies-customer-pickup',
                onChange: (customerPickup) => patch({ customerPickup }),
              }}
            />

            <ViaLinha
              nome="Da produção"
              ajuda="uma por setor"
              entrega={{
                value: draft.productionDelivery,
                label: 'Vias da produção na entrega',
                testId: 'print-copies-production-delivery',
                onChange: (productionDelivery) => patch({ productionDelivery }),
              }}
              retirada={{
                value: draft.productionPickup,
                label: 'Vias da produção na retirada',
                testId: 'print-copies-production-pickup',
                onChange: (productionPickup) => patch({ productionPickup }),
              }}
            />
          </div>
        ) : (
          /*
            SEM O CONTROLE, O NÚMERO CONTINUA ESCRITO — a mesma regra do nome da
            impressora nesta tela. Quem está em pé ao lado da bobina é quem
            pergunta "por que saíram duas vias?", e é por isso que a LEITURA
            desta configuração é de quem opera.
          */
          <dl className="store-form__leitura" data-testid="print-copies-readonly">
            <dt>Entrega</dt>
            <dd>{describeCopies(draft.customerDelivery, draft.productionDelivery)}</dd>
            <dt>Retirada</dt>
            <dd>{describeCopies(draft.customerPickup, draft.productionPickup)}</dd>
          </dl>
        )}

        <span className="field__hint">
          Zero não imprime — a retirada normalmente não leva a via do cliente.
        </span>
      </section>

      {/* --- O RODAPÉ ----------------------------------------------------- */}
      <section className="store-form__section" data-testid="print-footer-block">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Mensagem no rodapé</h2>
          <span className="faint">
            Sai no fim da via do cliente. A da produção não leva — ela é a comanda da cozinha.
          </span>
        </div>

        {podeEditar ? (
          <>
            <div className="field">
              <span className="field__label">Como esta filial imprime</span>
              <div className="seg" role="group" aria-label="Mensagem do rodapé desta filial">
                {MODOS.map((modo) => (
                  <button
                    key={modo.value}
                    type="button"
                    className="seg__opt"
                    aria-pressed={draft.footerMode === modo.value}
                    onClick={() => patch({ footerMode: modo.value })}
                    data-testid={`print-footer-mode-${modo.value}`}
                  >
                    {modo.label}
                  </button>
                ))}
              </div>
              <span className="field__hint" data-testid="print-footer-hint">
                {ajudaDoModo(draft.footerMode)}
              </span>
            </div>

            {/*
              A PRÉVIA SÓ EXISTE ENQUANTO A FILIAL HERDA. Nos outros dois modos,
              o que vai sair está escrito no próprio controle: a caixa de texto
              mostra o texto, e "Não imprimir" não tem o que prever.
            */}
            {draft.footerMode === 'herda' ? <Previa texto={efetivo} /> : null}

            {/* A caixa tem a largura da BOBINA (48 colunas) — ver StorePage.css. */}
            {draft.footerMode === 'propria' ? (
              <div className="rodape__campo">
                <Field
                  label="Mensagem desta loja"
                  hint={`Até ${FOOTER_MAX_CHARS} caracteres e ${FOOTER_MAX_LINES} linhas. A quebra de linha que você escrever é respeitada na bobina.`}
                >
                  <Textarea
                    rows={4}
                    maxLength={FOOTER_MAX_CHARS}
                    value={draft.footerText}
                    placeholder="@nossaloja · peça direto e ganhe 5% de volta"
                    onValueChange={(footerText) => patch({ footerText })}
                    data-testid="print-footer-text"
                  />
                </Field>

                {/* O contador é do campo, então mora dentro dele. */}
                <div className="rodape__meta">
                  <span className="faint">
                    {linhas} de {FOOTER_MAX_LINES} linhas
                  </span>
                  <span className="faint tnum">
                    {caracteres}/{FOOTER_MAX_CHARS}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          /* Leitura: o que vai sair na bobina, e de onde veio. */
          <div data-testid="print-footer-readonly">
            <span className="field__hint">{leituraDoModo(draft.footerMode)}</span>
            {efetivo ? <Previa texto={efetivo} /> : null}
          </div>
        )}
      </section>

      {podeEditar ? (
        <SaveBar
          isSaving={print.isSaving}
          isDirty={isDirty}
          savedAt={print.savedAt}
          errorMessage={problem ?? print.saveError}
          onSave={() => void handleSave()}
          onReset={() => {
            setDraft(baseline);
            setProblem(null);
          }}
        />
      ) : null}
    </>
  );
}

/** Uma linha da grade: o nome da via, e a contagem em cada tipo de pedido. */
function ViaLinha({
  nome,
  ajuda,
  entrega,
  retirada,
}: {
  nome: string;
  ajuda: string;
  entrega: Contagem;
  retirada: Contagem;
}) {
  return (
    <>
      <span className="vias__nome">
        {nome}
        <span className="vias__ajuda">{ajuda}</span>
      </span>
      <ContagemSelect {...entrega} />
      <ContagemSelect {...retirada} />
    </>
  );
}

type Contagem = {
  value: number;
  label: string;
  testId: string;
  onChange: (value: number) => void;
};

function ContagemSelect({ value, label, testId, onChange }: Contagem) {
  return (
    <Select
      value={String(value)}
      onChange={(escolhido) => onChange(Number(escolhido))}
      options={OPCOES_DE_VIA}
      aria-label={label}
      data-testid={testId}
    />
  );
}

/**
 * O QUE VAI SAIR NA BOBINA, acinzentado.
 *
 * Plano de agrupamento e tinta de apoio: é uma citação do que está gravado
 * noutro lugar, não um campo desta tela. `pre-line` porque a quebra de linha do
 * lojista é respeitada na impressão — mostrá-la corrida aqui faria a prévia
 * mentir sobre o formato.
 */
function Previa({ texto }: { texto: string }) {
  if (texto === '')
    return (
      <p className="field__hint" data-testid="print-footer-preview-empty">
        A marca não tem mensagem gravada, então hoje nada sai no rodapé.
      </p>
    );

  return (
    <div className="rodape__previa" data-testid="print-footer-preview">
      <span className="field__label">O que sai hoje</span>
      <p className="rodape__texto">{texto}</p>
    </div>
  );
}

function ajudaDoModo(modo: FooterMode): string {
  if (modo === 'nao-imprime')
    return 'Escolha desta loja: nem a mensagem dela, nem a da marca. Volte para “Herdar da marca” para seguir a rede de novo.';
  if (modo === 'propria')
    return 'Só esta loja imprime este texto. As outras seguem o que a marca escrever.';
  return 'Segue o que a marca escrever, hoje e depois.';
}

function leituraDoModo(modo: FooterMode): string {
  if (modo === 'nao-imprime') return 'Esta filial não imprime rodapé na via do cliente.';
  if (modo === 'propria') return 'Esta filial imprime a mensagem dela:';
  return 'Esta filial segue a mensagem da marca:';
}
