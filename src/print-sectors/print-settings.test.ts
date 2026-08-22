import { describe, expect, it } from 'vitest';

import type { BranchPrintSettings } from '../api/types';
import {
  bodyFromDraft,
  checkFooter,
  countFooterLines,
  describeCopies,
  draftFromSettings,
  EMPTY_PRINT_DRAFT,
  normalizeReceiptText,
  type PrintSettingsDraft,
} from './print-settings';

function gravado(overrides: Partial<BranchPrintSettings> = {}): BranchPrintSettings {
  return {
    branch_id: 'filial-1',
    receipt_footer_message: null,
    effective_receipt_footer_message: 'Obrigado! @nossaloja',
    print_customer_copies_delivery: 1,
    print_production_copies_delivery: 1,
    print_customer_copies_pickup: 1,
    print_production_copies_pickup: 1,
    ...overrides,
  };
}

function rascunho(overrides: Partial<PrintSettingsDraft> = {}): PrintSettingsDraft {
  return { ...EMPTY_PRINT_DRAFT, ...overrides };
}

/* ==========================================================================
 * OS TRÊS ESTADOS DO RODAPÉ — o motivo de o modo ser explícito
 * ======================================================================= */

describe('o modo do rodapé sai do que está gravado', () => {
  it('nulo é herdar', () => {
    expect(draftFromSettings(gravado({ receipt_footer_message: null })).footerMode).toBe('herda');
  });

  /*
   * A DISTINÇÃO QUE PAGA ESTE ARQUIVO. Vazio não é "não gravou": é a filial
   * dizendo "não imprima o rodapé da marca aqui", e é o único jeito de ela
   * recusar a campanha da rede.
   */
  it('vazio é não imprimir, e não herdar', () => {
    expect(draftFromSettings(gravado({ receipt_footer_message: '' })).footerMode).toBe(
      'nao-imprime',
    );
  });

  it('texto é a mensagem própria, e ela alimenta a caixa', () => {
    const draft = draftFromSettings(gravado({ receipt_footer_message: 'Volte sempre' }));
    expect(draft.footerMode).toBe('propria');
    expect(draft.footerText).toBe('Volte sempre');
  });
});

describe('o corpo do PATCH', () => {
  it('não manda o que não mudou', () => {
    const resultado = bodyFromDraft(draftFromSettings(gravado()), gravado());
    expect(resultado).toMatchObject({ ok: true, vazio: true });
    if (resultado.ok) expect(resultado.body).toEqual({});
  });

  /*
   * O DEFEITO QUE ESTE MÓDULO EXISTE PARA IMPEDIR: mandar `""` onde se queria
   * `null` desliga a campanha da rede naquela loja, e não há tela onde isso
   * apareça — só a bobina que parou de sair com a mensagem.
   */
  it('herdar manda null, e não string vazia', () => {
    const resultado = bodyFromDraft(
      rascunho({ footerMode: 'herda', footerText: 'Volte sempre' }),
      gravado({ receipt_footer_message: 'Volte sempre' }),
    );
    expect(resultado.ok && resultado.body.receipt_footer_message).toBeNull();
  });

  it('não imprimir manda string vazia, e não null', () => {
    const resultado = bodyFromDraft(
      rascunho({ footerMode: 'nao-imprime' }),
      gravado({ receipt_footer_message: null }),
    );
    expect(resultado.ok && resultado.body.receipt_footer_message).toBe('');
  });

  it('quem já não imprimia e continua sem imprimir não manda nada', () => {
    const resultado = bodyFromDraft(
      rascunho({ footerMode: 'nao-imprime' }),
      gravado({ receipt_footer_message: '' }),
    );
    expect(resultado).toMatchObject({ ok: true, vazio: true });
  });

  it('a mensagem própria vai como texto', () => {
    const resultado = bodyFromDraft(
      rascunho({ footerMode: 'propria', footerText: 'Peça direto' }),
      gravado(),
    );
    expect(resultado.ok && resultado.body.receipt_footer_message).toBe('Peça direto');
  });

  /*
   * A CAIXA VAZIA EM "ESCREVER" É ERRO. Sem isto ela viraria `""` — o estado
   * "não imprimir" — em quem estava no meio de uma frase.
   */
  it('escrever sem escrever é erro, e não um vazio silencioso', () => {
    const resultado = bodyFromDraft(rascunho({ footerMode: 'propria', footerText: '   ' }), gravado());
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.message).toMatch(/Não imprimir/);
  });

  it('as contagens vão só quando mudam, e nunca nulas', () => {
    const resultado = bodyFromDraft(rascunho({ customerPickup: 0 }), gravado());
    expect(resultado.ok && resultado.body).toEqual({ print_customer_copies_pickup: 0 });
  });

  it('zero é um valor, não a ausência de um', () => {
    const resultado = bodyFromDraft(
      rascunho({ customerPickup: 0, productionPickup: 0 }),
      gravado({ print_customer_copies_pickup: 0, print_production_copies_pickup: 2 }),
    );
    // O que já era zero não volta no corpo; o que virou zero, sim.
    expect(resultado.ok && resultado.body).toEqual({ print_production_copies_pickup: 0 });
  });

  it('recusa contagem fora da faixa do backend', () => {
    const resultado = bodyFromDraft(rascunho({ customerDelivery: 9 }), gravado());
    expect(resultado.ok).toBe(false);
  });
});

/* ==========================================================================
 * OS TETOS — da bobina, não do banco
 * ======================================================================= */

describe('a limpeza do texto', () => {
  it('tira caractere de controle, que na térmica é comando', () => {
    // ESC no meio da mensagem deixa de ser texto e vira `ESC ...`, que
    // reprograma a impressora no meio da comanda. Escrito como ESCAPE: um
    // 0x1B cru no fonte é um byte que qualquer ferramenta come sem avisar.
    expect(normalizeReceiptText('Peça\u001Bdireto')).toBe('Peçadireto');
  });

  it('troca tabulação por espaço e junta as quebras', () => {
    expect(normalizeReceiptText('a\tb\r\nc')).toBe('a b\nc');
  });

  it('colapsa linha em branco repetida, como o backend', () => {
    expect(normalizeReceiptText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  /*
   * O TETO DE CARACTERES SOZINHO NÃO SEGURA: "a\nb\nc…" cabe em 240 e sairia
   * com 120 linhas de bobina.
   */
  it('conta as linhas depois de limpar', () => {
    expect(countFooterLines('a\n\n\n\nb')).toBe(3);
    expect(countFooterLines('   ')).toBe(0);
  });

  it('recusa mais de seis linhas', () => {
    const sete = rascunho({ footerMode: 'propria', footerText: '1\n2\n3\n4\n5\n6\n7' });
    expect(checkFooter(sete).valid).toBe(false);
  });

  it('não confere nada nos outros dois modos — não há texto para conferir', () => {
    expect(checkFooter(rascunho({ footerMode: 'herda', footerText: '' })).valid).toBe(true);
    expect(checkFooter(rascunho({ footerMode: 'nao-imprime', footerText: '' })).valid).toBe(true);
  });
});

/* ==========================================================================
 * A LEITURA, para quem opera e não edita
 * ======================================================================= */

describe('describeCopies', () => {
  it('diz que a via da produção é por setor — é o que muda a conta', () => {
    expect(describeCopies(1, 2)).toBe('1 do cliente · 2 da produção por setor');
  });

  it('escreve o zero por extenso, em vez de mostrar "0 do cliente"', () => {
    expect(describeCopies(0, 1)).toBe('sem via do cliente · 1 da produção por setor');
  });
});
