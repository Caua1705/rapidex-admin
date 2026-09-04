import { describe, expect, it } from 'vitest';

import type { WhatsAppBranchLine, WhatsAppChannel } from '../api/types';
import {
  corpoDoRascunho,
  LIMITES,
  LINHA_DO_RESTAURANTE,
  linhaDoRestaurante,
  lojasQueDependem,
  lojasSemAviso,
  lugarDoCanal,
  podeDesconectar,
  podeReconectar,
  problemaDoRascunho,
  rascunhoDeReconexao,
  rascunhoNovo,
  situacaoDaLoja,
} from './whatsapp-model';

/*
 * As frases de estado (`status_label` / `status_action`) chegam do backend, e
 * os dublês abaixo trazem as MESMAS que `_ESTADO_DO_CANAL` escreve. Nenhuma
 * asserção daqui casa esse texto: o que se prende é que a tela o REPASSA, e não
 * que ele seja este.
 */
function canal(over: Partial<WhatsAppChannel> = {}): WhatsAppChannel {
  return {
    id: 'canal-restaurante',
    branch_id: null,
    branch_name: null,
    display_phone_number: '+55 85 3333-0000',
    phone_number_id: 'pn-1',
    waba_id_masked: '••••7890',
    status: 'connected',
    status_label: 'Conectado',
    status_action: null,
    connected_at: '2026-09-01T12:00:00Z',
    disconnected_at: null,
    disconnect_reason: null,
    ...over,
  };
}

function loja(over: Partial<WhatsAppBranchLine> = {}): WhatsAppBranchLine {
  return {
    branch_id: 'filial-1',
    branch_name: 'Centro',
    source: 'none',
    channel_id: null,
    display_phone_number: null,
    can_send: false,
    ...over,
  };
}

/* ==========================================================================
 * A DISTINÇÃO QUE A TELA EXISTE PARA FAZER
 *
 * "Nunca conectou" e "conectou e caiu" são a mesma ausência na tela e são
 * consertos opostos na vida real. Estes cinco casos são a régua deles.
 * ======================================================================= */

describe('situacaoDaLoja', () => {
  it('número próprio no ar é `propria`, e não tem o que explicar', () => {
    const situacao = situacaoDaLoja(
      loja({
        source: 'branch',
        channel_id: 'canal-filial',
        display_phone_number: '+55 85 4444-0000',
        can_send: true,
      }),
      [canal({ id: 'canal-filial', branch_id: 'filial-1', branch_name: 'Centro' })],
    );

    expect(situacao.tipo).toBe('propria');
    expect(situacao.numero).toBe('+55 85 4444-0000');
    expect(situacao.detalhe).toBeNull();
    expect(situacao.avisa).toBe(true);
  });

  /**
   * O CASO QUE MAIS ENGANA: a filial TEM linha própria e ela caiu. O backend
   * não a faz cair no número do restaurante — e é o contrário do que "herança"
   * quer dizer no resto do painel.
   */
  it('número próprio caído é `propria-caida`, e a loja NÃO cai no do restaurante', () => {
    const situacao = situacaoDaLoja(
      loja({
        source: 'branch',
        channel_id: 'canal-filial',
        display_phone_number: '+55 85 4444-0000',
        can_send: false,
      }),
      [
        canal(),
        canal({
          id: 'canal-filial',
          branch_id: 'filial-1',
          branch_name: 'Centro',
          status: 'disabled',
          status_label: 'Desligado no painel',
          status_action: 'Conecte o número de novo para voltar a avisar os clientes.',
        }),
      ],
    );

    expect(situacao.tipo).toBe('propria-caida');
    expect(situacao.avisa).toBe(false);
    /* O canal que a tela mostra é o DELA, e não a queda do restaurante — é dele
       que sai a frase do estado. */
    expect(situacao.canal?.id).toBe('canal-filial');
    expect(situacao.detalhe).toContain('NÃO passa a usar o número do restaurante');
  });

  it('sem número próprio e com o do restaurante no ar é `herdada`, e ela avisa', () => {
    const situacao = situacaoDaLoja(
      loja({
        source: 'restaurant',
        channel_id: 'canal-restaurante',
        display_phone_number: '+55 85 3333-0000',
        can_send: true,
      }),
      [canal()],
    );

    expect(situacao.tipo).toBe('herdada');
    expect(situacao.numero).toBe('+55 85 3333-0000');
    expect(situacao.avisa).toBe(true);
    expect(situacao.detalhe).toContain('não tem número próprio');
  });

  /**
   * `source: 'none'` COM A LINHA DO RESTAURANTE PRESENTE: esta loja tinha por
   * onde falar e o padrão dela caiu. Não é "nunca conectou", e o conserto é
   * religar aquele número — não cadastrar um para ela.
   */
  it('sem número próprio e com o do restaurante fora é `herdada-caida`', () => {
    const queda = canal({
      status: 'disconnected_by_meta',
      status_label: 'Desconectado pela Meta',
      status_action: 'O acesso da Cloud API foi removido no WhatsApp da loja.',
      disconnected_at: '2026-09-03T10:00:00Z',
      disconnect_reason: 'PARTNER_REMOVED',
    });

    const situacao = situacaoDaLoja(loja({ source: 'none' }), [queda]);

    expect(situacao.tipo).toBe('herdada-caida');
    expect(situacao.canal?.id).toBe('canal-restaurante');
    expect(situacao.numero).toBe('+55 85 3333-0000');
    expect(situacao.avisa).toBe(false);
  });

  /** `source: 'none'` SEM linha nenhuma: aqui, sim, nunca conectou. */
  it('sem número próprio e sem linha de restaurante é `nunca`', () => {
    const situacao = situacaoDaLoja(loja({ source: 'none' }), []);

    expect(situacao.tipo).toBe('nunca');
    expect(situacao.canal).toBeNull();
    expect(situacao.numero).toBeNull();
    expect(situacao.avisa).toBe(false);
  });

  /**
   * A LINHA DE OUTRA FILIAL NÃO CONTA COMO QUEDA. Só `branch_id: null` é a
   * queda do restaurante — confundir as duas faria uma loja sem número dizer
   * que herda o número da loja vizinha, que não é como a herança funciona.
   */
  it('a linha de OUTRA filial não vira herança de ninguém', () => {
    const situacao = situacaoDaLoja(loja({ source: 'none' }), [
      canal({ id: 'canal-aldeota', branch_id: 'filial-2', branch_name: 'Aldeota' }),
    ]);

    expect(situacao.tipo).toBe('nunca');
  });

  /**
   * `can_send` É COPIADO, NUNCA DEDUZIDO. Ele sai da mesma consulta que o envio
   * usa; uma segunda forma da pergunta aqui diria "tudo certo" no dia em que a
   * regra do envio mudasse — e nenhum cliente seria avisado.
   */
  it('`avisa` repete o `can_send` do backend, mesmo quando a origem sugere o contrário', () => {
    const situacao = situacaoDaLoja(
      loja({ source: 'restaurant', channel_id: 'canal-restaurante', can_send: false }),
      [canal()],
    );

    expect(situacao.tipo).toBe('herdada');
    expect(situacao.avisa).toBe(false);
  });
});

describe('as linhas de canal', () => {
  it('a queda do restaurante é a de `branch_id` nulo, e não a primeira da lista', () => {
    const daFilial = canal({ id: 'canal-filial', branch_id: 'filial-1' });
    expect(linhaDoRestaurante([daFilial, canal()])?.id).toBe('canal-restaurante');
    expect(linhaDoRestaurante([daFilial])).toBeNull();
  });

  it('a linha do restaurante se nomeia como padrão das filiais, não como "sem filial"', () => {
    expect(lugarDoCanal(canal())).toBe('Restaurante (padrão das filiais)');
    expect(lugarDoCanal(canal({ branch_id: 'filial-1', branch_name: 'Centro' }))).toBe('Centro');
  });

  /**
   * RECONECTAR EXISTE NOS DOIS ESTADOS FORA DO AR — inclusive no da Meta, cujo
   * conserto não é nosso. Esconder o botão ali deixaria quem JÁ religou lá sem
   * caminho de volta; o que impede o clique inútil é a frase do backend, que a
   * tela mostra ao lado.
   */
  it('reconectar vale para os dois estados fora do ar, desconectar só para o que está no ar', () => {
    expect(podeReconectar('connected')).toBe(false);
    expect(podeReconectar('disabled')).toBe(true);
    expect(podeReconectar('disconnected_by_meta')).toBe(true);

    expect(podeDesconectar('connected')).toBe(true);
    expect(podeDesconectar('disabled')).toBe(false);
    expect(podeDesconectar('disconnected_by_meta')).toBe(false);
  });
});

describe('quem depende de um canal', () => {
  /**
   * É A FRASE DO DIÁLOGO DE DESCONEXÃO, e o motivo de ele existir: desligar a
   * linha do restaurante não cala uma loja, cala todas as que herdam dela.
   */
  it('a queda do restaurante lista TODAS as lojas que herdam dela', () => {
    const lojas = [
      loja({
        branch_id: 'f1',
        branch_name: 'Centro',
        source: 'branch',
        channel_id: 'c1',
        can_send: true,
      }),
      loja({
        branch_id: 'f2',
        branch_name: 'Aldeota',
        source: 'restaurant',
        channel_id: 'canal-restaurante',
        can_send: true,
      }),
      loja({
        branch_id: 'f3',
        branch_name: 'Messejana',
        source: 'restaurant',
        channel_id: 'canal-restaurante',
        can_send: true,
      }),
    ];

    expect(lojasQueDependem(canal(), lojas)).toEqual(['Aldeota', 'Messejana']);
  });

  it('a loja que já não avisa não entra na lista de quem perde o aviso', () => {
    const lojas = [
      loja({
        branch_id: 'f2',
        branch_name: 'Aldeota',
        source: 'restaurant',
        channel_id: 'canal-restaurante',
        can_send: false,
      }),
    ];

    expect(lojasQueDependem(canal(), lojas)).toEqual([]);
  });

  it('as lojas mudas são as que o backend diz que não podem enviar', () => {
    const lojas = [
      loja({ branch_id: 'f1', branch_name: 'Centro', can_send: true }),
      loja({ branch_id: 'f2', branch_name: 'Aldeota', can_send: false }),
    ];

    expect(lojasSemAviso(lojas).map((item) => item.branch_name)).toEqual(['Aldeota']);
  });
});

describe('o rascunho de conexão', () => {
  const cheio = {
    branchId: LINHA_DO_RESTAURANTE,
    displayPhoneNumber: ' +55 85 3333-0000 ',
    phoneNumberId: ' pn-1 ',
    wabaId: ' waba-1 ',
    accessToken: ' token-secreto ',
  };

  it('a filial vazia vira `null` EXPLÍCITO — é a linha do restaurante, não campo em branco', () => {
    expect(corpoDoRascunho(cheio).branch_id).toBeNull();
    expect(corpoDoRascunho({ ...cheio, branchId: 'filial-1' }).branch_id).toBe('filial-1');
  });

  it('tudo sai aparado', () => {
    expect(corpoDoRascunho(cheio)).toEqual({
      branch_id: null,
      display_phone_number: '+55 85 3333-0000',
      phone_number_id: 'pn-1',
      waba_id: 'waba-1',
      access_token: 'token-secreto',
    });
  });

  it('recusa campo por campo, na ordem da tela', () => {
    const vazio = rascunhoNovo();
    expect(problemaDoRascunho(vazio)?.campo).toBe('displayPhoneNumber');
    expect(problemaDoRascunho({ ...vazio, displayPhoneNumber: '+55' })?.campo).toBe(
      'phoneNumberId',
    );
    expect(
      problemaDoRascunho({ ...vazio, displayPhoneNumber: '+55', phoneNumberId: 'pn' })?.campo,
    ).toBe('wabaId');
    expect(
      problemaDoRascunho({
        ...vazio,
        displayPhoneNumber: '+55',
        phoneNumberId: 'pn',
        wabaId: 'waba',
      })?.campo,
    ).toBe('accessToken');
    expect(problemaDoRascunho({ ...cheio, branchId: 'filial-1' })).toBeNull();
  });

  /**
   * OS TETOS SÃO OS DO PYDANTIC, e o `/openapi.json` não os publica: o painel
   * recebe `string` seco. Sem esta conferência o 422 chega depois de o lojista
   * ter colado quatro campos.
   */
  it('cobra os tetos que só existem em `AdminWhatsAppChannelCreate`', () => {
    const base = { ...cheio, branchId: 'filial-1' };
    expect(
      problemaDoRascunho({
        ...base,
        displayPhoneNumber: 'x'.repeat(LIMITES.displayPhoneNumber + 1),
      })?.campo,
    ).toBe('displayPhoneNumber');
    expect(
      problemaDoRascunho({ ...base, phoneNumberId: 'x'.repeat(LIMITES.phoneNumberId + 1) })?.campo,
    ).toBe('phoneNumberId');
    expect(problemaDoRascunho({ ...base, wabaId: 'x'.repeat(LIMITES.wabaId + 1) })?.campo).toBe(
      'wabaId',
    );
  });

  /**
   * O TOKEN E O WABA NASCEM VAZIOS NA RECONEXÃO. O primeiro não volta em rota
   * nenhuma; o segundo volta MASCARADO (`••••7890`), e mandar a máscara de
   * volta cadastraria uma conta que não existe.
   */
  it('a reconexão traz a identidade da linha e nada de credencial', () => {
    const draft = rascunhoDeReconexao(
      canal({
        branch_id: 'filial-1',
        branch_name: 'Centro',
        status: 'disabled',
        status_label: 'Desligado no painel',
      }),
    );

    expect(draft.branchId).toBe('filial-1');
    expect(draft.phoneNumberId).toBe('pn-1');
    expect(draft.displayPhoneNumber).toBe('+55 85 3333-0000');
    expect(draft.wabaId).toBe('');
    expect(draft.accessToken).toBe('');
  });

  it('a reconexão da linha do restaurante volta ao valor de "sem filial"', () => {
    expect(rascunhoDeReconexao(canal()).branchId).toBe(LINHA_DO_RESTAURANTE);
  });
});
