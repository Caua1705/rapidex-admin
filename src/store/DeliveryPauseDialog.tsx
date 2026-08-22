import { useState } from 'react';

import { Field } from '../ds/Field';
import { Input } from '../ds/Input';
import { Modal } from '../ui/Modal';

/**
 * O teto da pausa, em minutos — 24 horas, como o backend.
 *
 * Ele é o que impede esta rota de virar um segundo `accepts_delivery`: pausa de
 * três dias é a chave estrutural com passos a mais, e aí a distinção entre as
 * duas deixa de existir.
 */
export const PAUSA_MAX_MINUTOS = 24 * 60;

/** Os atalhos, na ordem em que o balcão os usa. */
const ATALHOS = [30, 60, 120] as const;

/**
 * ============================================================================
 * PAUSAR A ENTREGA — um prazo, e não uma chave
 * ============================================================================
 *
 * O DIÁLOGO EXISTE POR CAUSA DO PRAZO. Se pausar fosse um interruptor, ele não
 * precisaria de tela nenhuma — e seria o `accepts_delivery` que já existe. O que
 * esta ação tem de próprio é justamente o que se digita aqui: até quando, e por
 * quê.
 *
 * OS ATALHOS SÃO A INTERFACE, e o campo é a saída. Quem pausa está no balcão às
 * 19h com chuva caindo e o telefone tocando; ninguém digita "90" nesse momento.
 * Os três botões cobrem o caso real e o campo fica para o resto — a mesma
 * escolha dos +5/+10/−5 do preparo em Pedidos.
 *
 * O MOTIVO É MOSTRADO AO CLIENTE, e é por isso que ele não é opcional-e-pronto:
 * a frase que o app monta é "A entrega está pausada no momento. Motivo: chuva
 * forte. Voltamos a entregar às 20:30." Sem prazo o cliente fecha o app; com
 * prazo e motivo, ele volta. A tela DIZ que o texto vai para o cliente, senão o
 * lojista escreve "sem motoboy filho da..." achando que é anotação interna.
 */
export function DeliveryPauseDialog({
  branchName,
  isSending,
  errorMessage,
  onClose,
  onConfirm,
}: {
  branchName: string;
  isSending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (minutos: number, motivo: string) => void;
}) {
  const [minutos, setMinutos] = useState<number>(60);
  const [campo, setCampo] = useState('60');
  const [motivo, setMotivo] = useState('');

  const valido = Number.isInteger(minutos) && minutos > 0 && minutos <= PAUSA_MAX_MINUTOS;
  const passouDoTeto = minutos > PAUSA_MAX_MINUTOS;

  function escolher(valor: number) {
    setMinutos(valor);
    setCampo(String(valor));
  }

  return (
    <Modal
      title={`Pausar a entrega — ${branchName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={isSending}>
            Voltar
          </button>
          <button
            type="button"
            className={`btn btn--primary${valido ? '' : ' btn--travado'}`}
            disabled={!valido || isSending}
            onClick={() => onConfirm(minutos, motivo)}
            data-testid="confirm-pause"
          >
            {isSending ? 'Pausando…' : 'Pausar entrega'}
          </button>
        </>
      }
    >
      <div className="pausa">
        {/*
          A CONSEQUÊNCIA PRIMEIRO, porque é ela que separa esta ação da chave de
          entrega logo ao lado: a pausa VOLTA SOZINHA. Quem quer parar de
          entregar para sempre desliga a chave, e a frase o manda para lá.
        */}
        <p className="pausa__consequencia">
          A entrega volta sozinha quando o prazo acabar. Para parar de entregar por tempo
          indeterminado, desligue a chave de entrega desta filial.
        </p>

        {errorMessage ? (
          <p className="alert alert--error" role="alert" data-testid="pause-error">
            {errorMessage}
          </p>
        ) : null}

        <div className="field">
          <span className="field__label">Por quanto tempo</span>
          <div className="seg" role="group" aria-label="Duração da pausa">
            {ATALHOS.map((valor) => (
              <button
                key={valor}
                type="button"
                className="seg__opt"
                aria-pressed={minutos === valor}
                onClick={() => escolher(valor)}
                data-testid={`pause-preset-${valor}`}
              >
                {valor} min
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Ou outro tempo, em minutos"
          error={passouDoTeto ? `A pausa vai até ${PAUSA_MAX_MINUTOS} minutos (24 horas).` : null}
          hint={passouDoTeto ? undefined : 'No máximo 24 horas.'}
        >
          <Input
            className="ds-control--numero tnum"
            inputMode="numeric"
            value={campo}
            onValueChange={(valor) => {
              setCampo(valor);
              const numero = Number(valor.trim());
              setMinutos(valor.trim() === '' || !Number.isFinite(numero) ? 0 : numero);
            }}
            data-testid="pause-minutes"
          />
        </Field>

        <Field
          label="Motivo"
          hint="O cliente lê este texto junto do horário de volta. “Chuva forte”, “sem entregador”."
        >
          <Input
            value={motivo}
            maxLength={120}
            placeholder="Chuva forte"
            onValueChange={setMotivo}
            data-testid="pause-reason"
          />
        </Field>
      </div>
    </Modal>
  );
}
