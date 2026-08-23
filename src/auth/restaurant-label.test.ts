import { describe, expect, it } from 'vitest';

import type { Branch, RestaurantProfile } from '../api/types';
import { establishmentOf, initialsOf, restaurantLabelOf } from './restaurant-label';

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

function restaurante(name: string): RestaurantProfile {
  return { id: 'r-1', name, slug: 'pizzaria-do-ze' };
}

describe('restaurantLabelOf', () => {
  it('é o nome que o backend guarda em restaurants.name', () => {
    expect(restaurantLabelOf(restaurante('Pizzaria do Zé'))).toBe('Pizzaria do Zé');
  });

  /*
   * SEM QUEDA PARA A FILIAL. O perfil que ainda não chegou é um travessão, e
   * não o nome da loja principal: derivar de novo reintroduziria, no pior
   * momento, a imprecisão que a troca de origem removeu.
   */
  it('não quebra sem perfil, e não inventa um nome no lugar', () => {
    expect(restaurantLabelOf(null)).toBe('—');
    expect(restaurantLabelOf(restaurante('   '))).toBe('—');
  });
});

/**
 * A identificação do estabelecimento no shell.
 *
 * O QUE ESTES TESTES PROTEGEM: o nome vem inteiro de `GET /admin/restaurant` e
 * nada o corta no caminho — o corte no travessão existia enquanto a origem era
 * o `display_name` da filial ("Marca — Bairro"). A segunda linha continua sendo
 * das filiais, e a afirmação mais cara dela é dizer quantas lojas o restaurante
 * tem para quem só enxerga uma.
 */
describe('establishmentOf', () => {
  it('identifica pelo nome da casa, e as filiais só entram no detalhe', () => {
    const estabelecimento = establishmentOf(restaurante('Pizzaria do Zé'), [
      branch({ id: '1', name: 'Zona Norte', display_name: 'Pizzaria do Zé — Zona Norte' }),
      branch({ id: '2', name: 'Matriz', display_name: 'Pizzaria do Zé — Aldeota', is_main: true }),
    ]);

    expect(estabelecimento?.label).toBe('Pizzaria do Zé');
    expect(estabelecimento?.initials).toBe('PZ');
    expect(estabelecimento?.city).toBe('Fortaleza');
  });

  /*
   * O NOME NÃO É MAIS CORTADO. Com a origem antiga, um travessão significava
   * "daqui para a frente é bairro" e o resto era jogado fora. `restaurants.name`
   * é a marca inteira: cortar aqui comeria metade de um nome legítimo.
   */
  it('não corta o nome no travessão', () => {
    const estabelecimento = establishmentOf(restaurante('Empório 25 — Grãos e Cafés'), [
      branch({ is_main: true }),
    ]);

    expect(estabelecimento?.label).toBe('Empório 25 — Grãos e Cafés');
  });

  /*
   * A CIDADE SÓ VALE SE VALER PARA TODAS. Escrever a da matriz numa rede
   * espalhada seria dizer que a rede é de Fortaleza porque a matriz é — e a
   * contagem de lojas, que continua verdadeira, basta para a linha.
   */
  it('cala a cidade quando as lojas estão em cidades diferentes', () => {
    const casa = restaurante('Pizzaria do Zé');

    const espalhada = establishmentOf(casa, [
      branch({ id: '1', city: 'Fortaleza', is_main: true }),
      branch({ id: '2', city: 'Sobral' }),
    ]);
    expect(espalhada?.city).toBe('');

    const mesmaCidade = establishmentOf(casa, [
      branch({ id: '1', city: 'Fortaleza', is_main: true }),
      branch({ id: '2', city: ' fortaleza ' }),
    ]);
    expect(mesmaCidade?.city).toBe('Fortaleza');
  });

  /*
   * `branchCount` é quantas filiais ESTE lojista enxerga — o mesmo número que o
   * seletor escreve em "Todas as filiais (N)".
   */
  it('conta as filiais que o lojista enxerga', () => {
    const casa = restaurante('Pizzaria do Zé');

    expect(establishmentOf(casa, [branch({ id: '1' }), branch({ id: '2' })])?.branchCount).toBe(2);
    expect(establishmentOf(casa, [branch({ id: '1' })])?.branchCount).toBe(1);
  });

  /*
   * Sem perfil, o shell não desenha o bloco: um travessão piscando embaixo da
   * marca lê como defeito, e a sessão termina de carregar meio segundo depois.
   */
  it('devolve nulo enquanto não há perfil', () => {
    expect(establishmentOf(null, [branch({ id: '1' })])).toBeNull();
  });

  /*
   * QUEM SEGURA O BLOCO É O NOME, NÃO A LISTA DE FILIAIS. As duas chamadas são
   * independentes (ver SessionProvider): o nome pode chegar primeiro, e mostrá-lo
   * sem o detalhe é mostrar o que se sabe.
   */
  it('mostra o nome mesmo antes de as filiais chegarem', () => {
    const estabelecimento = establishmentOf(restaurante('Sushimania'), []);

    expect(estabelecimento?.label).toBe('Sushimania');
    expect(estabelecimento?.city).toBe('');
    expect(estabelecimento?.branchCount).toBe(0);
  });

  it('sobrevive à filial sem cidade', () => {
    expect(establishmentOf(restaurante('Sushimania'), [branch({ city: '' })])?.city).toBe('');
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
