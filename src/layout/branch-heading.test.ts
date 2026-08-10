import { describe, expect, it } from 'vitest';

import type { Branch } from '../api/types';
import { branchHeading } from './branch-heading';

function branch(overrides: Partial<Branch> & { id: string; name: string }): Branch {
  return {
    slug: overrides.id,
    address: 'Rua A, 100',
    neighborhood: 'Centro',
    city: 'Fortaleza',
    state: 'CE',
    is_main: false,
    ...overrides,
  } as Branch;
}

const MATRIZ = branch({ id: 'b-1', name: 'Matriz', is_main: true });
const ALDEOTA = branch({
  id: 'b-2',
  name: 'Aldeota',
  address: 'Av. B, 200',
  neighborhood: 'Aldeota',
});

describe('branchHeading', () => {
  it('com uma filial escolhida, mostra o nome e o endereço DELA', () => {
    expect(branchHeading([MATRIZ, ALDEOTA], 'b-2')).toEqual({
      name: 'Aldeota',
      detail: 'Av. B, 200 · Aldeota · Fortaleza',
    });
  });

  /*
   * O defeito relatado: o topo dizia "Matriz" (nome da filial principal, que é
   * de onde sai o rótulo do restaurante) junto de "Todas as filiais · 2". As
   * duas linhas se contradiziam e a de cima era a errada.
   */
  it('sem filial escolhida, NÃO mostra nome de filial nenhuma', () => {
    const heading = branchHeading([MATRIZ, ALDEOTA], '');

    expect(heading.name).toBe('Todas as filiais (2)');
    expect(heading.detail).toBe('');
    expect(heading.name).not.toContain('Matriz');
  });

  it('a contagem acompanha quantas filiais o lojista enxerga', () => {
    const terceira = branch({ id: 'b-3', name: 'Zona Norte' });
    expect(branchHeading([MATRIZ, ALDEOTA, terceira], '').name).toBe('Todas as filiais (3)');
  });

  // "Todas" e "a única" são o mesmo lugar: dizer "Todas as filiais (1)" seria
  // pedante, e o endereço continua sendo informação útil.
  it('com uma filial só, mostra ela mesma escolhida ou não', () => {
    const esperado = { name: 'Matriz', detail: 'Rua A, 100 · Centro · Fortaleza' };
    expect(branchHeading([MATRIZ], '')).toEqual(esperado);
    expect(branchHeading([MATRIZ], 'b-1')).toEqual(esperado);
  });

  it('id que não casa com filial nenhuma cai no estado de "todas"', () => {
    // Acontece ao trocar de conta sem limpar o id guardado. Mostrar o nome da
    // principal aqui seria afirmar uma filial que não está filtrada.
    expect(branchHeading([MATRIZ, ALDEOTA], 'b-de-outro-restaurante').name).toBe(
      'Todas as filiais (2)',
    );
  });

  it('sem filial nenhuma no escopo, não inventa contagem', () => {
    expect(branchHeading([], '')).toEqual({ name: '—', detail: '' });
  });

  it('prefere display_name ao nome interno, e pula pedaço de endereço vazio', () => {
    const comApelido = branch({
      id: 'b-9',
      name: 'filial-centro-01',
      display_name: 'Centro',
      neighborhood: '',
    });

    expect(branchHeading([comApelido], 'b-9')).toEqual({
      name: 'Centro',
      detail: 'Rua A, 100 · Fortaleza',
    });
  });
});
