import { useState } from 'react';

import type { AdminUserCreated } from '../api/types';
import { Checkbox, OneTimeSecret } from '../ds';
import { AlertIcon } from '../ds/icons';
import { Modal } from '../ui/Modal';
import './TemporaryPasswordDialog.css';

/**
 * ============================================================================
 * A SENHA TEMPORÁRIA — o único diálogo do painel que não fecha sozinho
 * ============================================================================
 *
 * `POST /admin/users` e `POST /admin/users/{id}/reset-password` devolvem uma
 * senha de 20 caracteres em claro, e essa é a ÚNICA vez que ela existe fora do
 * bcrypt. Não há rota que a mostre de novo — e isso é propriedade, não
 * limitação: uma rota "me mostra de novo" seria uma rota que devolve a senha de
 * outra pessoa.
 *
 * A CONSEQUÊNCIA MANDA NO DESENHO INTEIRO. Fechar esta janela sem copiar não
 * perde um formulário que dá para reabrir: perde a credencial. A segunda via é
 * gerar OUTRA senha, o que mata a primeira — e se a pessoa já tiver recebido a
 * primeira por telefone, ela fica com uma senha morta e uma ligação a repetir.
 *
 * Daí as quatro decisões:
 *
 * **1. O aviso vem ANTES da senha, não depois.** Depois dela, ele é lido por
 * quem já decidiu o que fazer. Antes, ele é a primeira coisa na tela — e é a
 * única frase do diálogo que muda o comportamento de quem está lendo.
 *
 * **2. `dismissible={false}`.** Esc, clique no fundo e o "x" somem juntos. São
 * os três jeitos de fechar sem querer, e trancar dois deixaria o terceiro
 * fazendo exatamente o estrago que os outros dois pararam.
 *
 * **3. Fechar exige a confirmação explícita de que copiou.** Não é burocracia:
 * é o único ponto do fluxo em que dá para parar alguém antes do dano, e o custo
 * de errar aqui é uma pessoa sem acesso e uma senha morta circulando.
 *
 * **4. O E-MAIL APARECE JUNTO.** A senha sozinha não abre nada — quem vai
 * entrar precisa do par, e o e-mail é o que o dono acabou de digitar num campo
 * que já fechou. Sem ele aqui, a próxima pergunta do balcão é "e o login?".
 */
export function TemporaryPasswordDialog({
  resultado,
  motivo,
  onClose,
}: {
  resultado: AdminUserCreated;
  /**
   * De onde se chegou. Muda o título e UMA frase — não o resto.
   *
   * `reset` tem uma consequência que `criado` não tem: a senha anterior daquela
   * pessoa parou de valer no instante da chamada, e as sessões dela caíram
   * junto (`password_changed_at` revoga todo token emitido antes). Quem
   * redefiniu por engano precisa saber disso agora, não pela ligação de quem
   * foi desconectado no meio de um pedido.
   */
  motivo: 'criado' | 'reset';
  onClose: () => void;
}) {
  const [confirmou, setConfirmou] = useState(false);
  const { admin_user: usuario, temporary_password: senha } = resultado;

  return (
    <Modal
      title={motivo === 'criado' ? `${usuario.name} está cadastrado` : `Nova senha de ${usuario.name}`}
      onClose={onClose}
      dismissible={false}
      footer={
        <>
          {/*
            A CAIXA FICA NO RODAPÉ, ao lado do botão que ela destrava, e empurra
            o botão para a margem (`margin-inline-end: auto` na folha). No corpo
            do diálogo ela seria mais uma frase entre outras quatro; aqui ela é
            visivelmente a condição de sair.
          */}
          <span className="senha-temp__confirma">
            <Checkbox
              checked={confirmou}
              onChange={setConfirmou}
              label="Copiei ou anotei a senha"
              data-testid="senha-confirmou"
            />
          </span>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onClose}
            disabled={!confirmou}
            data-testid="senha-concluir"
          >
            Concluir
          </button>
        </>
      }
    >
      <div className="senha-temp">
        {/*
          O AVISO É `--warn` E NÃO `--error`: nada deu errado. O que está na
          tela é o resultado certo de uma ação que a pessoa pediu — o que ele
          diz é o que acontece a seguir, e "atenção" é exatamente isso.
        */}
        <p className="alert alert--warn senha-temp__aviso" role="alert" data-testid="senha-aviso">
          <AlertIcon size={14} aria-hidden="true" />
          <span>
            <strong>Esta senha não vai aparecer de novo.</strong> Copie ou anote agora. Se você
            fechar sem copiar, o único caminho é gerar outra em "Redefinir senha" — e a que você
            tiver passado antes deixa de funcionar.
          </span>
        </p>

        <OneTimeSecret value={senha} label="Senha temporária" data-testid="senha-valor" />

        {/*
          O PAR DE ENTRADA. O e-mail é `.tnum`? Não: `.tnum` é para dinheiro,
          hora, tempo e nº de pedido, e um e-mail não alinha em coluna com nada.
        */}
        <dl className="senha-temp__par">
          <dt className="t-label">Entra com</dt>
          <dd className="t-body senha-temp__email" data-testid="senha-email">
            {usuario.email}
          </dd>
        </dl>

        <div className="senha-temp__notas">
          <p className="t-aux">
            Ela dá para <strong>ditar por telefone</strong>: são só letras maiúsculas e números, sem
            as letras que se confundem ao falar — não há O nem zero, não há i, éle nem um.
          </p>
          <p className="t-aux">
            No primeiro acesso o painel <strong>obriga a trocar</strong>. Até lá, a única tela que
            abre para {usuario.name.split(' ')[0]} é a de escolher a senha nova — e depois disso
            nem você conhece a senha dela.
          </p>
          {motivo === 'reset' ? (
            <p className="t-aux" data-testid="senha-nota-reset">
              A senha anterior <strong>parou de valer agora</strong>, e as sessões abertas com ela
              caíram junto — inclusive em outro computador.
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
