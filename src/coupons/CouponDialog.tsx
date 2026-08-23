import { useId, useRef, useState, type FormEvent } from 'react';

import type { CouponTemplate } from '../api/types';
import { Checkbox, Field, FieldRow, Input, Switch, Textarea } from '../ds';
import { AlertIcon } from '../ds/icons';
import { Modal } from '../ui/Modal';
import { ArtePicker } from './ArtePicker';
import { temErro, validarRascunho, SEM_ERRO, type ErrosDoCupom } from './coupon-form';
import { aceitaTeto, tipoDaArte, type CouponDraft, type GrupoDeArtes } from './coupon-model';
import { resumoDoCupom } from './coupon-phrase';

/**
 * Nova campanha / editar campanha.
 *
 * A ORDEM DOS BLOCOS É A ORDEM DA DECISÃO, e ela começa na arte porque a arte
 * decide o resto: ela fixa o tipo e o valor do desconto, e é ela que faz o
 * campo de teto existir ou não. Pôr o nome primeiro — como um formulário
 * costuma fazer — obrigaria o lojista a batizar uma campanha antes de saber
 * qual campanha ele está criando.
 *
 * NÃO EXISTE CAMPO DE DESCONTO. Não é simplificação: a arte já traz o valor
 * desenhado, e um campo aberto ao lado dela cria o caminho de escolher a arte
 * de 10% e digitar 7% — a vitrine anunciaria 10% e o checkout descontaria 7%.
 * O backend confere o TIPO contra a arte e não confere o VALOR, então a trava é
 * daqui (`bodyFrom`).
 *
 * O QUE NÃO EXISTE NESTE FORMULÁRIO E NÃO É ESQUECIMENTO: horário, dia da
 * semana, tipo de pedido, produto, forma de pagamento e filial. O modelo não
 * tem esses campos — `restaurant_coupons` não tem coluna nenhuma disso — e
 * cupom é do restaurante inteiro, valendo em todas as lojas.
 */
export function CouponDialog({
  initial,
  grupos,
  artes,
  onClose,
  onSave,
  isSaving,
}: {
  initial: CouponDraft;
  /** As artes que sobraram, já sem as usadas e já com a da própria campanha. */
  grupos: readonly GrupoDeArtes[];
  /** O catálogo ativo inteiro — para achar a arte escolhida pelo id. */
  artes: readonly CouponTemplate[];
  onClose: () => void;
  onSave: (rascunho: CouponDraft, arte: CouponTemplate) => Promise<ErrosDoCupom | null>;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [erroDoServidor, setErroDoServidor] = useState<ErrosDoCupom>(SEM_ERRO);
  /*
   * Os erros do formulário só aparecem depois da primeira tentativa. Acender o
   * "o código é obrigatório" no instante em que o diálogo abre é acusar o
   * lojista de um campo que ele ainda não teve chance de preencher.
   */
  const [tentou, setTentou] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();

  const isEdit = draft.id !== null;
  const arte = artes.find((item) => item.id === draft.templateId) ?? null;
  const tipo = arte ? tipoDaArte(arte) : null;

  /*
   * A ARTE DESTA CAMPANHA SAIU DO CATÁLOGO DA PLATAFORMA.
   *
   * `GET /admin/coupon-templates` devolve só as ativas, e `artesDisponiveis` já
   * reinclui a arte da própria campanha na edição — então uma campanha em
   * edição sem arte casada só pode ser isto. Não é um detalhe visual: enquanto
   * a arte não trocar, o backend responde 400 a QUALQUER patch deste cupom,
   * inclusive a um que só o desligue.
   */
  const arteForaDoAr = isEdit && draft.templateId !== '' && !arte;

  const errosLocais = validarRascunho(draft, arte);
  const erros: ErrosDoCupom = {
    campos: { ...(tentou ? errosLocais.campos : {}), ...erroDoServidor.campos },
    geral: erroDoServidor.geral,
  };

  const resumo = resumoDoCupom(draft, arte);

  function mexer(mudanca: Partial<CouponDraft>) {
    setDraft((atual) => ({ ...atual, ...mudanca }));
    /*
     * Mexeu, o erro do servidor sobre aquele campo deixa de valer: ele descreve
     * o corpo que FOI mandado, não o que está na tela agora. Um "código já
     * existe" que sobrevive à digitação do código novo faz o lojista achar que
     * não adiantou trocar.
     */
    setErroDoServidor((atual) => {
      const campos = { ...atual.campos };
      for (const chave of Object.keys(mudanca) as (keyof CouponDraft)[]) {
        if (chave !== 'id') delete campos[chave];
      }
      return { campos, geral: atual.geral };
    });
  }

  /**
   * Trocar a arte LIMPA O TETO quando a arte nova não é percentual.
   *
   * O campo some da tela, mas o rascunho continuaria carregando o texto de
   * antes — e `max_discount_amount` fora de percentual é 422. Sem esta linha, o
   * lojista trocaria uma arte de 20% por uma de R$ 5 e levaria uma recusa
   * apontando um campo que ele não está mais vendo.
   */
  function escolherArte(templateId: string) {
    const nova = artes.find((item) => item.id === templateId) ?? null;
    const novoTipo = nova ? tipoDaArte(nova) : null;
    mexer({
      templateId,
      ...(aceitaTeto(novoTipo) ? {} : { maxDiscountAmount: '' }),
    });
  }

  async function submeter(evento: FormEvent) {
    evento.preventDefault();
    setTentou(true);

    if (!arte || temErro(errosLocais)) {
      /* O foco vai para o primeiro campo recusado — sem isso, num formulário
         que rola, o erro pode estar fora da tela quando o botão é apertado. */
      window.requestAnimationFrame(() => {
        const invalido = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        invalido?.focus();
      });
      return;
    }

    const falha = await onSave(draft, arte);
    if (falha) setErroDoServidor(falha);
    else onClose();
  }

  return (
    <Modal
      title={isEdit ? 'Editar campanha' : 'Nova campanha'}
      onClose={onClose}
      footer={
        <>
          {erros.geral ? (
            <p className="alert alert--error cupom__erro-geral" role="alert">
              {erros.geral}
            </p>
          ) : null}
          <button type="button" className="btn" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn btn--primary" disabled={isSaving}>
            {isSaving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar campanha'}
          </button>
        </>
      }
    >
      <form id={formId} ref={formRef} className="cupom" onSubmit={submeter} noValidate>
        {/* ---- A ARTE, que decide o resto ---------------------------------- */}
        <section className="cupom__bloco">
          <div className="cupom__cabecalho">
            <h3 className="t-section cupom__titulo">A arte que o cliente vê</h3>
            <p className="t-aux cupom__ajuda">
              Cada arte já traz o valor desenhado. É ela que fixa o desconto — por isso não há
              campo de valor aqui: escolher a arte de 10% e digitar outro número faria a vitrine e
              o checkout discordarem.
            </p>
          </div>

          {arteForaDoAr ? (
            <p className="alert alert--warn cupom__aviso" role="alert">
              <AlertIcon size={14} aria-hidden="true" /> A arte desta campanha saiu do catálogo da
              plataforma. Escolha outra para conseguir salvar — <strong>inclusive para desligar o
              cupom</strong>, que hoje também depende de uma arte no ar.
            </p>
          ) : null}

          <Field label="Arte" hideLabel error={erros.campos.templateId ?? null}>
            <ArtePicker
              grupos={grupos}
              value={draft.templateId}
              onChange={escolherArte}
              disabled={isSaving}
            />
          </Field>
        </section>

        {/* ---- O que a campanha É ------------------------------------------ */}
        <section className="cupom__bloco">
          <h3 className="t-section cupom__titulo">A campanha</h3>

          <FieldRow>
            <Field label="Nome" required error={erros.campos.title ?? null}>
              <Input
                value={draft.title}
                onValueChange={(value) => mexer({ title: value })}
                placeholder="Setembro sem frete"
                maxLength={200}
              />
            </Field>

            <Field
              label="Código"
              required
              hint="O cliente também acha o cupom na vitrine sem digitar — o código é para quem recebeu por fora."
              error={erros.campos.code ?? null}
            >
              <Input
                className="cupom__campo--codigo"
                value={draft.code}
                /* Maiúsculas na digitação: PROMO10 e promo10 colidem no mesmo
                   índice do banco, e o backend normaliza assim de qualquer
                   jeito. Deixar a tela mostrar minúsculas seria mostrar um
                   código que não é o que vai ser gravado. */
                onValueChange={(value) => mexer({ code: value.toUpperCase() })}
                placeholder="SETEMBRO"
                maxLength={100}
              />
            </Field>
          </FieldRow>

          <Field
            label="Descrição"
            hint="Uma linha que o cliente lê na vitrine, abaixo do nome. Opcional."
            error={erros.campos.description ?? null}
          >
            <Textarea
              value={draft.description}
              onValueChange={(value) => mexer({ description: value })}
              rows={2}
              placeholder="Válido em todos os pedidos de entrega."
            />
          </Field>
        </section>

        {/* ---- Quando ------------------------------------------------------ */}
        <section className="cupom__bloco">
          <h3 className="t-section cupom__titulo">Quando vale</h3>

          <FieldRow>
            <Field label="Começa em" required error={erros.campos.validFrom ?? null}>
              <Input
                type="date"
                className="cupom__campo--data"
                value={draft.validFrom}
                onValueChange={(value) => mexer({ validFrom: value })}
              />
            </Field>

            <Field
              label="Termina em"
              required
              hint="O último dia vale inteiro, até 23h59."
              error={erros.campos.validUntil ?? null}
            >
              <Input
                type="date"
                className="cupom__campo--data"
                value={draft.validUntil}
                onValueChange={(value) => mexer({ validUntil: value })}
              />
            </Field>
          </FieldRow>
        </section>

        {/* ---- Condições --------------------------------------------------- */}
        <section className="cupom__bloco">
          <h3 className="t-section cupom__titulo">Condições</h3>

          <FieldRow>
            <Field
              label="Valor mínimo do pedido"
              hint="Comparado com o subtotal dos produtos. A taxa de entrega não conta para alcançá-lo."
              error={erros.campos.minOrderValue ?? null}
            >
              <Input
                prefix="R$"
                className="cupom__campo--dinheiro"
                inputMode="decimal"
                value={draft.minOrderValue}
                onValueChange={(value) => mexer({ minOrderValue: value })}
                placeholder="0,00"
              />
            </Field>

            {/*
              O TETO SÓ EXISTE EM PERCENTUAL, e é assim que o 422 de
              "max_discount_amount é permitido somente para percentual" deixa de
              ser possível: em vez de validar o campo, a tela não o oferece.
              Numa campanha de R$ 5 não há o que limitar; numa de frete grátis o
              teto é a própria taxa.
            */}
            {aceitaTeto(tipo) ? (
              <Field
                label="Desconto máximo"
                hint="O teto do percentual. Vazio é sem teto."
                error={erros.campos.maxDiscountAmount ?? null}
              >
                <Input
                  prefix="R$"
                  className="cupom__campo--dinheiro"
                  inputMode="decimal"
                  value={draft.maxDiscountAmount}
                  onValueChange={(value) => mexer({ maxDiscountAmount: value })}
                  placeholder="sem teto"
                />
              </Field>
            ) : null}
          </FieldRow>

          <FieldRow>
            <Field
              label="Usos no total"
              hint="Vazio é sem limite."
              error={erros.campos.totalUsageLimit ?? null}
            >
              <Input
                className="cupom__campo--numero"
                inputMode="numeric"
                value={draft.totalUsageLimit}
                onValueChange={(value) => mexer({ totalUsageLimit: value })}
                placeholder="—"
              />
            </Field>

            <Field
              label="Usos por cliente"
              hint="Vazio é sem limite."
              error={erros.campos.usageLimitPerCustomer ?? null}
            >
              <Input
                className="cupom__campo--numero"
                inputMode="numeric"
                value={draft.usageLimitPerCustomer}
                onValueChange={(value) => mexer({ usageLimitPerCustomer: value })}
                placeholder="—"
              />
            </Field>

            <Field
              label="Intervalo entre usos"
              hint="Dias que o mesmo cliente espera para usar de novo."
              error={erros.campos.cooldownDays ?? null}
            >
              <Input
                className="cupom__campo--numero"
                inputMode="numeric"
                suffix="dias"
                value={draft.cooldownDays}
                onValueChange={(value) => mexer({ cooldownDays: value })}
                placeholder="—"
              />
            </Field>
          </FieldRow>

          <Checkbox
            checked={draft.firstOrderOnly}
            onChange={(checked) => mexer({ firstOrderOnly: checked })}
            label="Apenas para quem nunca pediu aqui"
            hint="Vale por LOJA, não pela plataforma: quem já comprou em outro restaurante do Rapidex continua contando como primeiro pedido seu."
          />

          {/*
            O INTERRUPTOR SÓ APARECE NA EDIÇÃO. Campanha nova nasce ligada — e
            quem quer deixá-la pronta para depois usa a data de início, que é
            para isso que ela existe. Um interruptor "ligada" na criação seria
            um segundo jeito de dizer a mesma coisa, e o jeito pior: o cupom
            desligado some da vitrine sem nada explicando quando ele volta.
          */}
          {isEdit ? (
            <Switch
              checked={draft.isActive}
              onChange={(checked) => mexer({ isActive: checked })}
              label="Campanha ligada"
              hint="Desligada, ela some da vitrine e para de ser aceita. Cupom não se apaga — os pedidos que já a usaram precisam continuar sabendo dela."
            />
          ) : null}
        </section>

        {/* ---- A FRASE-RESUMO ---------------------------------------------- */}
        <section className="cupom__resumo" aria-live="polite">
          <h3 className="t-label cupom__resumo-rotulo">O que este cupom faz</h3>
          {resumo ? (
            <>
              <p className="t-body cupom__frase">{resumo.frase}</p>
              {resumo.notas.map((nota) => (
                <p key={nota} className="t-aux cupom__nota">
                  {nota}
                </p>
              ))}
            </>
          ) : (
            <p className="t-aux cupom__frase-vazia">
              Escolha uma arte para ver o resumo — é ela que diz quanto o cupom desconta.
            </p>
          )}
        </section>
      </form>
    </Modal>
  );
}
