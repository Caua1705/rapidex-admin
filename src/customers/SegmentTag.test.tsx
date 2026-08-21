import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SegmentTag } from './SegmentTag';
import { SEGMENT_LABEL } from './customer-segment';
import type { CustomerListItem, CustomerSegment } from '../api/types';

/**
 * A etiqueta lê o CLIENTE, e não só a classe: o ritmo (`cadence_days`) e a
 * distância (`days_since_last_order`) são o par que explica o rótulo, e os dois
 * vivem no item.
 */
function customer(overrides: Partial<CustomerListItem> = {}): CustomerListItem {
  return {
    customer_name: 'Ana Paula',
    customer_phone: '85999990000',
    orders_count: 12,
    billable_orders_count: 10,
    total_spent: 748.5,
    average_ticket: 74.85,
    first_order_at: '2026-03-12T20:00:00Z',
    last_order_at: '2026-08-15T20:00:00Z',
    days_since_last_order: 23,
    cadence_days: 7,
    segment: 'em_risco',
    ...overrides,
  };
}

/*
 * A CÉLULA DA CLASSIFICAÇÃO — e o que ela mostra quando não há classe.
 *
 * O caso vazio não é hipótese: enquanto o deploy do backend esteve atrás da
 * entrega do RFV, `segment` chegou ausente e a coluna saiu em branco. Célula em
 * branco lê como falha de carregamento, e a ausência de dado passou por bug de
 * tela — com o lojista abrindo chamado.
 *
 * O compilador nunca vai cobrar isto: `segment` é obrigatório no contrato e o
 * índice do `Record` é `string` para ele. Estes testes são o único lugar em que
 * a rede aparece.
 */
describe('SegmentTag', () => {
  it('escreve a palavra e marca a matiz da classe', () => {
    render(<SegmentTag customer={customer()} />);

    const etiqueta = screen.getByText('Em risco');
    expect(etiqueta).toHaveClass('is-seg-em_risco');
    // O ponto é a segunda pista (WCAG 1.4.1): a palavra nunca vem sozinha.
    expect(etiqueta.querySelector('.classe__ponto')).not.toBeNull();
  });

  it('as cinco classes do contrato saem todas com rótulo', () => {
    const classes: readonly CustomerSegment[] = [
      'novo',
      'ocasional',
      'fiel',
      'em_risco',
      'perdido',
    ];

    for (const classe of classes) {
      const { unmount } = render(<SegmentTag customer={customer({ segment: classe })} />);
      expect(screen.getByText(SEGMENT_LABEL[classe])).toBeInTheDocument();
      unmount();
    }
  });

  /*
   * O `as` escreve aqui o que o backend escreveu na rede: a chave ausente. Sem
   * ele não há como reproduzir o caso, porque o tipo gerado promete que ela vem.
   */
  it('sem classe, travessão — e não uma célula vazia', () => {
    render(
      <SegmentTag customer={customer({ segment: undefined as unknown as CustomerSegment })} />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  /*
   * O PONTO NÃO SOBREVIVE À AUSÊNCIA. Ele é a matiz da classe; ao lado de um
   * travessão ele seria uma etiqueta afirmando uma sexta coisa que não existe.
   */
  it('o travessão vem sem o ponto de matiz', () => {
    const { container } = render(
      <SegmentTag customer={customer({ segment: undefined as unknown as CustomerSegment })} />,
    );

    expect(container.querySelector('.classe__ponto')).toBeNull();
  });

  /*
   * Uma classe que o backend passe a mandar antes de a tela conhecê-la cai no
   * mesmo travessão. A trava de compilação continua sendo o `Record` — isto é a
   * rede embaixo dela, para o intervalo entre o deploy do backend e o do painel.
   */
  it('classe desconhecida também sai como travessão', () => {
    render(<SegmentTag customer={customer({ segment: 'campeao' as CustomerSegment })} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  /*
   * ============================================================================
   * O RITMO — a linha que fecha o caso de dois clientes com os mesmos 23 dias
   * ============================================================================
   */

  it('escreve o ritmo daquele cliente embaixo da classe', () => {
    render(<SegmentTag customer={customer({ cadence_days: 7 })} />);

    expect(screen.getByText('ritmo de 7 dias')).toBeInTheDocument();
  });

  /*
   * O PAR NO `title`, com os dois números: é a conta escrita, para quem não quer
   * montá-la de duas colunas da tabela.
   */
  it('o título da etiqueta diz a distância e o ritmo, com os números', () => {
    render(<SegmentTag customer={customer({ days_since_last_order: 23, cadence_days: 7 })} />);

    const etiqueta = screen.getByText('Em risco');
    expect(etiqueta).toHaveAttribute('title', expect.stringContaining('23 dias sem pedir'));
    expect(etiqueta).toHaveAttribute('title', expect.stringContaining('ritmo dele é de 7 dias'));
  });

  /*
   * DUAS LINHAS COM A MESMA DISTÂNCIA E RÓTULOS DIFERENTES — o caso que motivou
   * o campo. O que separa as duas é o ritmo, e ele tem de estar visível nas duas.
   */
  it('mesma distância, ritmos diferentes: cada linha diz o ritmo dela', () => {
    const { unmount } = render(
      <SegmentTag
        customer={customer({ segment: 'em_risco', days_since_last_order: 23, cadence_days: 7 })}
      />,
    );
    expect(screen.getByText('ritmo de 7 dias')).toBeInTheDocument();
    unmount();

    render(
      <SegmentTag
        customer={customer({ segment: 'fiel', days_since_last_order: 23, cadence_days: 30 })}
      />,
    );
    expect(screen.getByText('ritmo de 30 dias')).toBeInTheDocument();
  });

  /*
   * QUEM TEM UM PEDIDO SÓ NÃO TEM RITMO MEDIDO. O backend usa 30 como valor de
   * partida; escrever "ritmo de 30 dias" ao lado de "1 pedido" seria a tela
   * afirmando um hábito que ninguém observou.
   */
  it('não inventa ritmo para quem tem um pedido só', () => {
    render(
      <SegmentTag customer={customer({ segment: 'novo', orders_count: 1, cadence_days: 30 })} />,
    );

    expect(screen.queryByText(/ritmo/)).toBeNull();
  });
});
