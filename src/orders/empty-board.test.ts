import { describe, expect, it } from 'vitest';

import { emptyBoardState } from './empty-board';

const ABERTA = { isOpen: true, period: 'today', search: '' } as const;

describe('emptyBoardState', () => {
  it('loja aberta e sem pedido hoje: diz que a tela se atualiza sozinha', () => {
    const estado = emptyBoardState(ABERTA);

    expect(estado.title).toContain('nenhum pedido em aberto');
    // O que evita o F5 no meio do turno.
    expect(estado.hint).toContain('sozinho');
    // Não há o que fazer além de esperar: oferecer um botão seria inventar ação.
    expect(estado.action).toBeUndefined();
  });

  /*
   * O caso que a tela errava por omissão: com a loja fechada, "ainda não
   * entrou pedido" é verdade e é inútil — faz o lojista esperar em vez de
   * abrir a loja.
   */
  it('loja fechada vence a falta de movimento e oferece abrir', () => {
    const estado = emptyBoardState({ ...ABERTA, isOpen: false });

    expect(estado.title).toBe('A loja está fechada.');
    expect(estado.action).toEqual({ label: 'Abrir a loja', to: '/loja/geral' });
  });

  it('a busca vence a loja fechada: é a causa mais fácil de desfazer', () => {
    const estado = emptyBoardState({ isOpen: false, period: 'today', search: 'joana' });

    expect(estado.title).toContain('joana');
    expect(estado.action).toBeUndefined();
  });

  it('período passado aponta o Histórico em vez de sugerir que sumiram', () => {
    const estado = emptyBoardState({ ...ABERTA, period: 'yesterday' });

    expect(estado.title).toBe('Nenhum pedido em andamento ontem.');
    expect(estado.hint).toContain('Histórico');
  });

  it('nomeia cada período por extenso', () => {
    expect(emptyBoardState({ ...ABERTA, period: 'last7' }).title).toContain('últimos 7 dias');
    expect(emptyBoardState({ ...ABERTA, period: 'custom' }).title).toContain(
      'no período escolhido',
    );
  });

  /*
   * Enquanto as configurações não chegaram, `is_open` é nulo: a tela não pode
   * afirmar que a loja está fechada nem que está aberta. Cai no caso neutro.
   */
  it('sem saber se a loja está aberta, não afirma que está fechada', () => {
    const estado = emptyBoardState({ ...ABERTA, isOpen: null });

    expect(estado.title).not.toContain('fechada');
    expect(estado.action).toBeUndefined();
  });

  it('a busca é aparada antes de entrar na frase', () => {
    expect(emptyBoardState({ ...ABERTA, search: '  1042  ' }).title).toContain('“1042”');
  });
});
