import { describe, expect, it } from 'vitest';

import type { Branch } from '../api/types';
import {
  establishmentFromBranches,
  initialsOf,
  restaurantLabelFromBranches,
} from './restaurant-label';

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

/**
 * A identificação do estabelecimento no shell.
 *
 * O QUE ESTES TESTES PROTEGEM: o painel não tem o nome do restaurante — nenhuma
 * das rotas /admin o devolve —, então este bloco DERIVA a identificação da
 * filial principal. Derivação é onde nasce afirmação errada, e a mais cara aqui
 * é dizer quantas lojas o restaurante tem para quem só enxerga uma.
 */
describe('establishmentFromBranches', () => {
  /*
   * A MARCA, SEM O BAIRRO. É o corte que tira o nome de FILIAL de dentro do
   * bloco que identifica o restaurante — a metade que contradizia o seletor
   * quando o rótulo morava no cabeçalho.
   */
  it('identifica pela marca da loja principal, e guarda o nome inteiro', () => {
    const estabelecimento = establishmentFromBranches([
      branch({ id: '1', name: 'Zona Norte', display_name: 'Pizzaria do Zé — Zona Norte' }),
      branch({
        id: '2',
        name: 'Matriz',
        display_name: 'Pizzaria do Zé — Aldeota',
        is_main: true,
        city: 'Fortaleza',
      }),
    ]);

    expect(estabelecimento?.label).toBe('Pizzaria do Zé');
    expect(estabelecimento?.fullLabel).toBe('Pizzaria do Zé — Aldeota');
    expect(estabelecimento?.initials).toBe('PZ');
    expect(estabelecimento?.city).toBe('Fortaleza');
  });

  it('deixa passar inteiro o nome que não tem travessão', () => {
    const estabelecimento = establishmentFromBranches([
      branch({ display_name: 'Sushimania Delivery', is_main: true }),
    ]);
    expect(estabelecimento?.label).toBe('Sushimania Delivery');
  });

  /*
   * A CIDADE SÓ VALE SE VALER PARA TODAS. Escrever a da matriz numa rede
   * espalhada seria dizer que a rede é de Fortaleza porque a matriz é — e a
   * contagem de lojas, que continua verdadeira, basta para a linha.
   */
  it('cala a cidade quando as lojas estão em cidades diferentes', () => {
    const espalhada = establishmentFromBranches([
      branch({ id: '1', city: 'Fortaleza', is_main: true }),
      branch({ id: '2', city: 'Sobral' }),
    ]);
    expect(espalhada?.city).toBe('');

    const mesmaCidade = establishmentFromBranches([
      branch({ id: '1', city: 'Fortaleza', is_main: true }),
      branch({ id: '2', city: ' fortaleza ' }),
    ]);
    expect(mesmaCidade?.city).toBe('Fortaleza');
  });

  /*
   * `branchCount` é quantas filiais ESTE lojista enxerga — o mesmo número que o
   * seletor escreve em "Todas as filiais (N)". É o que o shell usa para dizer
   * "2 lojas", e é o que faz o bloco ler como o conjunto em vez de como uma das
   * lojas.
   */
  it('conta as filiais que o lojista enxerga', () => {
    expect(establishmentFromBranches([branch({ id: '1' }), branch({ id: '2' })])?.branchCount).toBe(
      2,
    );
    expect(establishmentFromBranches([branch({ id: '1' })])?.branchCount).toBe(1);
  });

  /*
   * Sem filial, o shell não desenha o bloco: um travessão piscando embaixo da
   * marca lê como defeito, e a sessão termina de carregar meio segundo depois.
   */
  it('devolve nulo enquanto não há filial', () => {
    expect(establishmentFromBranches([])).toBeNull();
  });

  it('sobrevive à filial sem cidade', () => {
    expect(establishmentFromBranches([branch({ city: '' })])?.city).toBe('');
  });
});

describe('initialsOf', () => {
  /*
   * "PD" não é sigla de nada: o que distingue um cliente do outro na lateral é
   * "PZ". Os conectores saem por isso, não por elegância.
   */
  it('pula os conectores', () => {
    expect(initialsOf('Pizzaria do Zé')).toBe('PZ');
    expect(initialsOf('Casa de Carnes Silva')).toBe('CC');
  });

  /*
   * PARA NO TRAVESSÃO. `display_name` de rede é "Marca — Bairro", e as iniciais
   * precisam ser da MARCA: sem isso, duas lojas do mesmo cliente teriam
   * ladrilhos diferentes — e o ladrilho existe justamente para ser a coisa
   * estável na lateral.
   */
  it('usa a marca, não o bairro que vem depois do travessão', () => {
    expect(initialsOf('Pizzaria do Zé — Aldeota')).toBe('PZ');
    expect(initialsOf('Pizzaria do Zé — Zona Norte')).toBe('PZ');
    expect(initialsOf('Burger King - Centro')).toBe('BK');
  });

  it('aceita nome de uma palavra só', () => {
    expect(initialsOf('Sushimania')).toBe('S');
  });

  /* Sem letra nenhuma não há sigla a inventar — melhor vazio que lixo. */
  it('não quebra com nome estranho', () => {
    expect(initialsOf('')).toBe('');
    expect(initialsOf('   ')).toBe('');
    expect(initialsOf('★ ★')).toBe('★');
  });
});
