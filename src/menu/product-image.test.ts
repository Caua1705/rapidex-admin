import { describe, expect, it } from 'vitest';

import {
  ASPECT,
  MAX_UPLOAD_BYTES,
  centeredOffset,
  clampOffset,
  clampZoom,
  coverScale,
  drawnSize,
  rejectionReasonFor,
  sourceRectFor,
} from './product-image';

/** Uma foto vertical de celular — o caso que motivou o recorte existir. */
const VERTICAL = { width: 1080, height: 1920 };
/** Uma foto horizontal de câmera. */
const HORIZONTAL = { width: 4000, height: 3000 };
const FRAME = 260;

function fakeFile(type: string, size: number): File {
  const file = new File(['x'], 'foto', { type });
  // `size` de um File é somente leitura; para o teste basta a forma.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('coverScale', () => {
  it('COBRE o quadro em vez de caber dentro dele', () => {
    // Cabendo dentro, a escala seria 260/1920. Cobrindo, é 260/1080 — o lado
    // MENOR é que encosta no quadro, e a sobra vertical é o que se arrasta.
    expect(coverScale(VERTICAL, FRAME)).toBeCloseTo(FRAME / 1080, 6);
    expect(coverScale(HORIZONTAL, FRAME)).toBeCloseTo(FRAME / 3000, 6);
  });

  it('não divide por zero numa imagem sem dimensão', () => {
    expect(coverScale({ width: 0, height: 0 }, FRAME)).toBe(1);
  });
});

describe('clampOffset', () => {
  it('nunca deixa entrar vazio no quadro', () => {
    // Arrastar muito para a direita e para baixo: o canto para em 0.
    const puxado = clampOffset({ x: 500, y: 500 }, VERTICAL, FRAME, 1);
    expect(puxado).toEqual({ x: 0, y: 0 });

    // Arrastar muito para a esquerda e para cima: para na borda oposta.
    const drawn = drawnSize(VERTICAL, FRAME, 1);
    const empurrado = clampOffset({ x: -9999, y: -9999 }, VERTICAL, FRAME, 1);
    expect(empurrado.x).toBeCloseTo(Math.min(0, FRAME - drawn.width), 6);
    expect(empurrado.y).toBeCloseTo(FRAME - drawn.height, 6);
  });

  it('no eixo em que a imagem já encosta, o deslocamento é zero', () => {
    // Na vertical de celular com zoom 1, a largura desenhada é exatamente o
    // quadro: não há o que arrastar na horizontal.
    const drawn = drawnSize(VERTICAL, FRAME, 1);
    expect(drawn.width).toBeCloseTo(FRAME, 6);
    expect(clampOffset({ x: -50, y: 0 }, VERTICAL, FRAME, 1).x).toBeCloseTo(0, 6);
  });
});

describe('centeredOffset', () => {
  it('começa no centro, que é onde o prato costuma estar', () => {
    const drawn = drawnSize(VERTICAL, FRAME, 1);
    const offset = centeredOffset(VERTICAL, FRAME, 1);
    expect(offset.y).toBeCloseTo((FRAME - drawn.height) / 2, 6);
  });
});

describe('sourceRectFor', () => {
  it('recorta o QUADRADO do meio de uma foto vertical', () => {
    const rect = sourceRectFor(VERTICAL, FRAME, {
      zoom: 1,
      offset: centeredOffset(VERTICAL, FRAME, 1),
    });

    // Lado do recorte = a largura inteira da foto (o lado menor).
    expect(rect.size).toBeCloseTo(1080, 4);
    expect(rect.sx).toBeCloseTo(0, 4);
    // E ele começa na altura que centraliza: (1920 - 1080) / 2.
    expect(rect.sy).toBeCloseTo((1920 - 1080) / 2, 4);
  });

  it('recorta o quadrado do meio de uma foto horizontal', () => {
    const rect = sourceRectFor(HORIZONTAL, FRAME, {
      zoom: 1,
      offset: centeredOffset(HORIZONTAL, FRAME, 1),
    });

    expect(rect.size).toBeCloseTo(3000, 4);
    expect(rect.sx).toBeCloseTo((4000 - 3000) / 2, 4);
    expect(rect.sy).toBeCloseTo(0, 4);
  });

  it('o zoom estreita o recorte, que é o que aproxima', () => {
    const semZoom = sourceRectFor(VERTICAL, FRAME, { zoom: 1, offset: { x: 0, y: 0 } });
    const comZoom = sourceRectFor(VERTICAL, FRAME, { zoom: 2, offset: { x: 0, y: 0 } });

    expect(comZoom.size).toBeCloseTo(semZoom.size / 2, 4);
  });

  it('o recorte nunca sai da imagem, nem com deslocamento absurdo', () => {
    const rect = sourceRectFor(HORIZONTAL, FRAME, {
      zoom: 1,
      offset: { x: 99999, y: -99999 },
    });

    expect(rect.sx).toBeGreaterThanOrEqual(0);
    expect(rect.sy).toBeGreaterThanOrEqual(0);
    expect(rect.sx + rect.size).toBeLessThanOrEqual(HORIZONTAL.width + 0.001);
    expect(rect.sy + rect.size).toBeLessThanOrEqual(HORIZONTAL.height + 0.001);
  });

  it('o recorte é quadrado — a proporção do sistema é 1:1', () => {
    expect(ASPECT).toBe(1);
    const rect = sourceRectFor(HORIZONTAL, FRAME, { zoom: 1.5, offset: { x: -10, y: -10 } });
    // `size` é um número só justamente porque largura e altura são iguais.
    expect(rect.size).toBeGreaterThan(0);
  });
});

describe('clampZoom', () => {
  it('não deixa afastar além de cobrir o quadro', () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(99)).toBe(4);
  });
});

describe('rejectionReasonFor', () => {
  it('aceita os três tipos que o backend aceita', () => {
    expect(rejectionReasonFor(fakeFile('image/jpeg', 1000))).toBeNull();
    expect(rejectionReasonFor(fakeFile('image/png', 1000))).toBeNull();
    expect(rejectionReasonFor(fakeFile('image/webp', 1000))).toBeNull();
  });

  it('recusa o que o bucket serviria como script', () => {
    // SVG fica de fora no backend de propósito: é XML e aceita <script>.
    expect(rejectionReasonFor(fakeFile('image/svg+xml', 1000))).toMatch(/Formato não aceito/);
    expect(rejectionReasonFor(fakeFile('text/html', 1000))).toMatch(/Formato não aceito/);
  });

  it('recusa acima do limite do backend, com o número em MB', () => {
    expect(rejectionReasonFor(fakeFile('image/jpeg', MAX_UPLOAD_BYTES + 1))).toMatch(/3 MB/);
    expect(rejectionReasonFor(fakeFile('image/jpeg', MAX_UPLOAD_BYTES))).toBeNull();
  });
});
