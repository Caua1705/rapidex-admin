import { describe, expect, it } from 'vitest';

import type { Branch } from '../api/types';
import { restaurantLabelFromBranches } from './restaurant-label';

function branch(overrides: Partial<Branch>): Branch {
  return {
    id: 'filial-1',
    name: 'Filial Centro',
    slug: 'centro',
    address: 'Rua A',
    neighborhood: 'Centro',
    city: 'Fortaleza',
    state: 'CE',
    // Obrigatórios no contrato (podem ser nulos, mas não podem faltar).
    is_main: null,
    is_active: true,
    ...overrides,
  };
}

describe('restaurantLabelFromBranches', () => {
  it('prefere a filial principal', () => {
    const branches = [
      branch({ id: '1', name: 'Aldeota', is_main: false }),
      branch({ id: '2', name: 'Matriz', is_main: true }),
    ];
    expect(restaurantLabelFromBranches(branches)).toBe('Matriz');
  });

  it('usa display_name quando existe', () => {
    const branches = [branch({ name: 'Centro', display_name: 'Pizzaria do Zé', is_main: true })];
    expect(restaurantLabelFromBranches(branches)).toBe('Pizzaria do Zé');
  });

  it('cai na primeira filial quando nenhuma é principal', () => {
    const branches = [branch({ id: '1', name: 'Aldeota' }), branch({ id: '2', name: 'Centro' })];
    expect(restaurantLabelFromBranches(branches)).toBe('Aldeota');
  });

  it('não quebra sem filial nenhuma', () => {
    expect(restaurantLabelFromBranches([])).toBe('—');
  });
});
