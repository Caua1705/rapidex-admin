/**
 * AS INVARIANTES DA LATERAL.
 *
 * Este arquivo não testa aparência: testa três regras de ESTRUTURA que a
 * navegação precisa cumprir para não se desmanchar sozinha na próxima tela que
 * alguém acrescentar. As três nasceram de defeitos que a lateral teve.
 */
import { describe, expect, it } from 'vitest';

import { pode, type Papel } from '../auth/permissions';
import { NAV_GROUPS } from './nav';

/** Os três papéis que ENTRAM no painel. `print_agent` é conta de máquina. */
const PAPEIS: readonly Papel[] = ['owner', 'manager', 'attendant'];

/**
 * O que este papel enxerga — a mesma conta de `use-nav.ts`, sem React.
 *
 * Ela é reescrita aqui de propósito: montar o hook exigiria provedor de sessão,
 * e o que interessa medir é a LISTA, não a montagem. A conta é uma linha, e o
 * dia em que as duas divergirem é o dia em que este teste passa a mentir — por
 * isso ele afirma abaixo o total que o dono vê, que é o número que quebra se
 * `use-nav.ts` mudar de critério.
 */
function lateralDe(papel: Papel) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    entries: group.entries.filter((entry) => !entry.acao || pode(papel, entry.acao)),
  })).filter((group) => group.entries.length > 0);
}

describe('a estrutura da lateral', () => {
  /**
   * A REGRA MAIS IMPORTANTE, e a que o "Cardápio" de um item só violava.
   *
   * Um grupo é ou HOMOGÊNEO de papel (todos os itens exigem a mesma ação, ou
   * nenhum exige) ou ele encolhe para um item conforme quem entra — e um rótulo
   * de grupo em cima de um item só custa uma linha inteira da lateral para
   * dizer o que o próprio item já diz.
   *
   * `use-nav.ts` já apaga grupo VAZIO. O que ele não tem como impedir é grupo
   * de UM, porque a decisão é de composição, e é aqui que ela se cobra.
   */
  it.each(PAPEIS)('nenhum grupo fica com um item só para o papel %s', (papel) => {
    for (const group of lateralDe(papel)) {
      expect(
        group.entries.length,
        `"${group.title}" ficou com um item só: ${group.entries[0]?.label}`,
      ).toBeGreaterThan(1);
    }
  });

  /**
   * O QUE AINDA NÃO EXISTE FICA NO FIM DO GRUPO.
   *
   * `nav.ts` faz isso com um `sort` sobre `soon` justamente para não depender
   * de alguém lembrar. Este teste é o que garante que o `sort` continue lá: um
   * item morto entre dois vivos ensina o olho a pular a região inteira.
   */
  it('o que não existe fica depois do que existe, em todo grupo', () => {
    for (const group of NAV_GROUPS) {
      const existentes = group.entries.map((entry) => entry.soon === undefined);
      const primeiroPendente = existentes.indexOf(false);
      if (primeiroPendente === -1) continue;

      expect(
        existentes.slice(primeiroPendente).every((existe) => !existe),
        `"${group.title}" tem um item construído depois de um "em breve"`,
      ).toBe(true);
    }
  });

  /**
   * O PÉ É O ÚLTIMO, E É UM SÓ.
   *
   * Ele é definido pela POSIÇÃO tanto quanto pelo fio: um bloco "pregado no pé"
   * no meio da lista não é um pé, é um grupo com um fio em cima. E dois pés
   * seriam duas divisões concorrentes numa lateral que só tem uma.
   */
  it('o pé é o último grupo, e é único', () => {
    const pes = NAV_GROUPS.filter((group) => group.rodape);
    expect(pes).toHaveLength(1);
    expect(NAV_GROUPS.at(-1)?.rodape).toBe(true);
  });

  /**
   * O TAMANHO DA VARREDURA — Hick em número.
   *
   * Oito itens acima do fio é o que o olho percorre todo dia; os quatro de
   * configuração ficam abaixo dele, fora do caminho. Se um dia este número
   * subir, que suba com alguém tendo lido esta linha.
   */
  it('a lista varrida todo dia tem oito itens, e o pé tem quatro', () => {
    const acimaDoFio = NAV_GROUPS.filter((group) => !group.rodape);
    const pe = NAV_GROUPS.find((group) => group.rodape);

    expect(acimaDoFio).toHaveLength(3);
    expect(acimaDoFio.flatMap((group) => group.entries)).toHaveLength(8);
    expect(pe?.entries).toHaveLength(4);
  });

  /**
   * O QUE CADA PAPEL VÊ.
   *
   * O atendente é o caso que a estrutura precisa aguentar: dois dos três grupos
   * somem inteiros para ele, e o que sobra é "as três telas do turno + a loja".
   * Nenhum grupo vazio, nenhum grupo de um.
   */
  it('o atendente enxerga Hoje inteiro e o pé sem Usuários', () => {
    const lateral = lateralDe('attendant');

    expect(lateral.map((group) => group.title)).toEqual(['Hoje', 'Configuração e conta']);
    expect(lateral.flatMap((group) => group.entries).map((entry) => entry.to)).toEqual([
      '/pedidos',
      '/cozinha',
      '/cardapio',
      '/loja',
      '/whatsapp',
      '/integracoes',
    ]);
  });

  it('o gerente perde só Usuários, e o dono vê os doze', () => {
    expect(lateralDe('manager').flatMap((group) => group.entries)).toHaveLength(11);
    expect(lateralDe('owner').flatMap((group) => group.entries)).toHaveLength(12);
    expect(
      lateralDe('manager')
        .flatMap((group) => group.entries)
        .map((entry) => entry.to),
    ).not.toContain('/usuarios');
  });
});
