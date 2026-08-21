import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SegmentTag } from './SegmentTag';
import { SEGMENT_LABEL } from './customer-segment';
import type { CustomerSegment } from '../api/types';

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
    render(<SegmentTag segment="em_risco" />);

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
      const { unmount } = render(<SegmentTag segment={classe} />);
      expect(screen.getByText(SEGMENT_LABEL[classe])).toBeInTheDocument();
      unmount();
    }
  });

  /*
   * O `as` escreve aqui o que o backend escreveu na rede: a chave ausente. Sem
   * ele não há como reproduzir o caso, porque o tipo gerado promete que ela vem.
   */
  it('sem classe, travessão — e não uma célula vazia', () => {
    render(<SegmentTag segment={undefined as unknown as CustomerSegment} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  /*
   * O PONTO NÃO SOBREVIVE À AUSÊNCIA. Ele é a matiz da classe; ao lado de um
   * travessão ele seria uma etiqueta afirmando uma sexta coisa que não existe.
   */
  it('o travessão vem sem o ponto de matiz', () => {
    const { container } = render(<SegmentTag segment={undefined as unknown as CustomerSegment} />);

    expect(container.querySelector('.classe__ponto')).toBeNull();
  });

  /*
   * Uma classe que o backend passe a mandar antes de a tela conhecê-la cai no
   * mesmo travessão. A trava de compilação continua sendo o `Record` — isto é a
   * rede embaixo dela, para o intervalo entre o deploy do backend e o do painel.
   */
  it('classe desconhecida também sai como travessão', () => {
    render(<SegmentTag segment={'campeao' as CustomerSegment} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
