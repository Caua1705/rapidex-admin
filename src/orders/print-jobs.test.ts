import { describe, expect, it } from 'vitest';

import type { PrintJob } from '../api/types';
import { agruparVias, avisoDeVias, destinoDaVia, rotuloDeCopias } from './print-jobs';

function via(over: Partial<PrintJob> = {}): PrintJob {
  return {
    type: 'production',
    sector_name: 'Chapa',
    columns: 48,
    font_size: 'normal',
    content: 'PEDIDO #1042\n2x PICANHA',
    printer_name: null,
    sector_id: null,
    ...over,
  };
}

describe('agruparVias', () => {
  it('junta vias consecutivas idênticas e conta as cópias', () => {
    const grupos = agruparVias([via(), via(), via()]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.copias).toBe(3);
  });

  /*
   * A ARMADILHA CENTRAL DO RECURSO. A contagem é a informação — é a resposta ao
   * lojista que ligou perguntando por que gastou o dobro de bobina. Um
   * `new Set(...)` no caminho faria três vias virarem "1 via" e ninguém
   * perceberia, porque a tela continuaria mostrando um bloco de texto certo.
   */
  it('nunca perde a contagem: três vias iguais são três vias, não uma', () => {
    const grupos = agruparVias([via(), via(), via()]);
    expect(rotuloDeCopias(grupos[0]!.copias)).toBe('3 vias');
  });

  it('não junta vias iguais separadas por uma diferente — a ordem é da bobina', () => {
    const grupos = agruparVias([
      via({ sector_name: 'Chapa' }),
      via({ sector_name: 'Bar', content: 'BAR' }),
      via({ sector_name: 'Chapa' }),
    ]);

    expect(grupos.map((g) => g.sectorName)).toEqual(['Chapa', 'Bar', 'Chapa']);
    expect(grupos.every((g) => g.copias === 1)).toBe(true);
  });

  it('mesmo texto em impressoras diferentes são duas vias, não duas cópias', () => {
    const grupos = agruparVias([
      via({ printer_name: 'EPSON-1' }),
      via({ printer_name: 'EPSON-2' }),
    ]);

    expect(grupos).toHaveLength(2);
  });

  it('lista vazia devolve lista vazia, sem estourar', () => {
    expect(agruparVias([])).toEqual([]);
  });

  it('a chave é estável e distinta por grupo', () => {
    const grupos = agruparVias([via(), via({ sector_name: 'Bar', content: 'BAR' })]);
    expect(new Set(grupos.map((g) => g.key)).size).toBe(2);
  });
});

describe('rotuloDeCopias', () => {
  it('escreve o singular no singular', () => {
    expect(rotuloDeCopias(1)).toBe('1 via');
    expect(rotuloDeCopias(2)).toBe('2 vias');
  });
});

describe('destinoDaVia', () => {
  it('junta setor e impressora quando o setor aponta uma', () => {
    const [grupo] = agruparVias([via({ sector_name: 'Chapa', printer_name: 'EPSON-1' })]);
    expect(destinoDaVia(grupo!)).toBe('Chapa · EPSON-1');
  });

  /*
   * Sem impressora, a resolução é do AGENTE (ele usa a padrão da máquina).
   * Escrever "impressora padrão" aqui seria o painel afirmando uma escolha que
   * acontece do outro lado, e que ele não tem como conferir.
   */
  it('sem impressora, diz só o setor — não inventa "padrão"', () => {
    const [grupo] = agruparVias([via({ sector_name: 'Chapa', printer_name: null })]);
    expect(destinoDaVia(grupo!)).toBe('Chapa');
  });

  it('ignora impressora que veio como texto em branco', () => {
    const [grupo] = agruparVias([via({ printer_name: '   ' })]);
    expect(destinoDaVia(grupo!)).toBe('Chapa');
  });
});

describe('avisoDeVias', () => {
  it('lista vazia não é erro: é a filial com as contagens em zero', () => {
    const aviso = avisoDeVias([], 'paid');
    expect(aviso?.tom).toBe('warn');
    expect(aviso?.texto).toContain('não imprime nada');
    // E ele diz ONDE se resolve, senão é só uma constatação.
    expect(aviso?.texto).toContain('Loja › Impressão');
  });

  it('com via de produção não há nada a explicar', () => {
    expect(avisoDeVias([via({ type: 'production' })], 'paid')).toBeNull();
  });

  /*
   * AS DUAS CAUSAS TÊM A MESMA APARÊNCIA, e a tela só afirma a que consegue
   * conferir. Com o pagamento pendente, a explicação é a regra do backend; com
   * ele pago, essa causa está descartada e sobra a configuração da filial.
   */
  it('só a via do cliente, com pagamento pendente: a causa é a regra do preparo', () => {
    const aviso = avisoDeVias([via({ type: 'customer', sector_name: 'Cliente' })], 'pending');
    expect(aviso?.tom).toBe('info');
    expect(aviso?.texto).toContain('depois que o pagamento confirma');
  });

  it('só a via do cliente, com pagamento pago: a causa é a contagem zerada', () => {
    const aviso = avisoDeVias([via({ type: 'customer', sector_name: 'Cliente' })], 'paid');
    expect(aviso?.texto).toContain('contagem da via de produção em zero');
  });

  /*
   * `on_delivery` é pagar na entrega: não há pagamento online a esperar, então
   * ele não pode receber a frase da espera. É o mesmo conjunto que libera a
   * Cozinha (`isAwaitingOnlinePayment`), e é por isso que esta função recebe o
   * `payment_status` cru em vez de um booleano montado pelo chamador.
   */
  it('pagar na entrega não é espera de pagamento online', () => {
    const aviso = avisoDeVias([via({ type: 'customer' })], 'on_delivery');
    expect(aviso?.texto).toContain('contagem da via de produção em zero');
  });
});
