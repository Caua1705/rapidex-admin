import { useState } from 'react';

import { Checkbox, OneTimeSecret } from '../ds';
import { AlertIcon } from '../ds/icons';
import { QrCode } from '../ds/QrCode';
import { Modal } from '../ui/Modal';
import { mensagemDoAcesso, urlDoWhatsApp } from './courier-access';
import type { Courier, CourierAccess } from '../api/types';
import './CourierAccessDialog.css';

/**
 * ============================================================================
 * O ACESSO DO ENTREGADOR — o segundo diálogo do painel que não fecha sozinho
 * ============================================================================
 *
 * Ele é irmão do da senha temporária, e as quatro decisões de lá valem aqui
 * pelo mesmo motivo: `POST .../access` devolve o par em claro UMA VEZ, não há
 * rota que o mostre de novo, e a segunda via é gerar OUTRO par — o que mata o
 * primeiro. Se o motoboy já tiver recebido o primeiro, ele fica com um link
 * morto e uma conversa a repetir.
 *
 *   1. o aviso vem ANTES do par, não depois;
 *   2. `dismissible={false}` — Esc, fundo e "x" somem juntos;
 *   3. fechar exige a confirmação explícita de que entregou;
 *   4. o par aparece INTEIRO, porque um sem o outro não abre nada.
 *
 * ----------------------------------------------------------------------------
 * TRÊS CAMINHOS PARA A MESMA COISA, E NENHUM DELES É REDUNDANTE
 * ----------------------------------------------------------------------------
 *
 * **O QR** é para o motoboy que está NA LOJA, com o celular na mão: ele aponta
 * e entra, sem digitar um token de trinta caracteres.
 *
 * **O WhatsApp** é para o que não está — e é o caso comum, porque o cadastro
 * costuma ser feito antes de a pessoa chegar. É um link `wa.me`, sem API e sem
 * Business Manager: abre a conversa com a mensagem pronta, e quem aperta enviar
 * é o lojista.
 *
 * **Copiar** é a saída de quem usa outro canal — e é a que sobra quando o
 * WhatsApp do balcão está aberto na conta errada.
 */
export function CourierAccessDialog({
  courier,
  acesso,
  link,
  nomeDaLoja,
  onClose,
}: {
  courier: Courier;
  acesso: CourierAccess;
  /** Já montado com o domínio do app. Sem domínio, este diálogo não abre. */
  link: string;
  nomeDaLoja: string;
  onClose: () => void;
}) {
  const [confirmou, setConfirmou] = useState(false);

  const mensagem = mensagemDoAcesso({ nomeDaLoja, link, codigo: acesso.access_code });

  return (
    <Modal
      title={`Acesso de ${courier.name}`}
      onClose={onClose}
      dismissible={false}
      footer={
        <>
          <span className="acesso__confirma">
            <Checkbox
              checked={confirmou}
              onChange={setConfirmou}
              label="Entreguei o link e o código"
              data-testid="acesso-confirmou"
            />
          </span>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!confirmou}
            onClick={onClose}
            data-testid="acesso-fechar"
          >
            Fechar
          </button>
        </>
      }
    >
      <div className="acesso" data-testid="acesso-dialogo">
        {/*
          O AVISO VEM ANTES DO PAR. Depois dele, é lido por quem já decidiu o
          que fazer; antes, é a primeira coisa na tela — e é a única frase daqui
          que muda o comportamento de quem está lendo.
        */}
        <p className="acesso__aviso" data-testid="acesso-aviso">
          <AlertIcon />
          <span>
            <strong>Isto aparece uma vez só.</strong> Não dá para ver de novo — a segunda via é
            gerar outro acesso, e o de agora para de funcionar na hora.
          </span>
        </p>

        <div className="acesso__par">
          <div className="acesso__qr">
            <QrCode
              value={link}
              label={`QR do acesso de ${courier.name}`}
              data-testid="acesso-qr"
            />
            <p className="field__hint">Aponte a câmera do celular dele.</p>
          </div>

          <div className="acesso__campos">
            {/*
              O CÓDIGO VEM PRIMEIRO, E É O DESTAQUE DA TELA.

              É o que o motoboy vai DIGITAR — o link ele abre, escaneia ou
              recebe no WhatsApp. Antes o link dominava o diálogo em cinco
              linhas e o código de seis dígitos ficava pequeno ao lado, que é a
              hierarquia ao contrário: o esforço de quem lê estava no valor que
              não exige esforço nenhum.
            */}
            <OneTimeSecret
              value={acesso.access_code}
              label="Código de acesso"
              forma="codigo"
              data-testid="acesso-codigo"
            />
            <OneTimeSecret
              value={link}
              label="Link do entregador"
              forma="link"
              data-testid="acesso-link"
            />
          </div>
        </div>

        {/*
          O WHATSAPP LEVA O PAR INTEIRO numa mensagem só. Mandar link e código
          em duas mensagens é o que produz a ligação de volta ("chegou só o
          endereço") — e a essa altura o par já não existe para reenviar a
          metade que faltou.
        */}
        <a
          className="btn btn--primary acesso__whatsapp"
          href={urlDoWhatsApp(courier.phone, mensagem)}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="acesso-whatsapp"
        >
          Enviar no WhatsApp
        </a>

        <p className="field__hint">
          O código é pedido uma vez, no primeiro acesso. Depois o aplicativo guarda.
        </p>
      </div>
    </Modal>
  );
}
