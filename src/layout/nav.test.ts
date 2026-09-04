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
   *
   * ----------------------------------------------------------------------------
   * O PÉ FICA DE FORA, e o motivo é o CUSTO que esta regra mede
   * ----------------------------------------------------------------------------
   *
   * O que um grupo de um custa é o RÓTULO PINTADO — uma linha de texto acima do
   * item, dizendo o que o item já diz. O pé não tem rótulo pintado
   * (`AppShell.tsx`: `group.rodape ? null : <p className="shell__group-title">`);
   * ali quem separa é o fio e a posição, e o título só existe como nome
   * acessível da lista. Um item sozinho no pé é um link solto abaixo de um fio,
   * e não uma seção de um item — não custa a linha que esta regra cobra.
   *
   * ELA PASSOU A PRECISAR DA RESSALVA em 05/09/2026, com duas mudanças que se
   * somaram: o WhatsApp ganhou tela e com ela a `acao` de leitura (GERENCIA), e
   * Integrações saiu do menu. O atendente ficou com "Loja" sozinha no pé.
   * Inventar um item para lhe fazer companhia seria pôr na lateral uma tela que
   * não existe — que é o defeito que esta regra existe para não ter.
   *
   * O QUE ELA CONTINUA COBRANDO É O QUE IMPORTA: nenhum dos três grupos com
   * rótulo pintado pode encolher para um.
   */
  it.each(PAPEIS)('nenhum grupo COM RÓTULO fica com um item só para o papel %s', (papel) => {
    for (const group of lateralDe(papel)) {
      if (group.rodape) continue;
      expect(
        group.entries.length,
        `"${group.title}" ficou com um item só: ${group.entries[0]?.label}`,
      ).toBeGreaterThan(1);
    }
  });

  /**
   * E O PÉ CONTINUA MEDIDO — o que muda é o piso, não a ausência de régua.
   *
   * Ele nunca pode SUMIR para um papel que entra no painel: sem ele, quem está
   * no balcão perde a única porta para Loja, que é onde se abre e se fecha a
   * loja no meio do turno.
   */
  it.each(PAPEIS)('o pé nunca some para o papel %s', (papel) => {
    const pe = lateralDe(papel).find((group) => group.rodape);
    expect(pe?.entries.length ?? 0).toBeGreaterThan(0);
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
   * Nove itens acima do fio é o que o olho percorre todo dia; os três de
   * configuração ficam abaixo dele, fora do caminho. Se um dia este número
   * subir, que suba com alguém tendo lido esta linha.
   *
   * O PÉ CAIU DE QUATRO PARA TRÊS com a saída de Integrações (05/09/2026, o
   * porquê está em `nav.ts`). O número aqui é de itens que EXISTEM: enquanto
   * Integrações estava na lista, um dos quatro era uma promessa.
   *
   * ELE SUBIU DE OITO PARA NOVE COM ENTREGADORES, e o motivo está escrito em
   * `nav.ts`: quem atribui um pedido a um motoboy é o ATENDENTE, no meio do
   * turno, com o pedido na mão. Uma tela de turno no pé das configurações é
   * uma tela que essa pessoa não encontra — e o custo de Hick de um nono item
   * é menor que o de procurar no lugar errado todo dia.
   */
  it('a lista varrida todo dia tem nove itens, e o pé tem três', () => {
    const acimaDoFio = NAV_GROUPS.filter((group) => !group.rodape);
    const pe = NAV_GROUPS.find((group) => group.rodape);

    expect(acimaDoFio).toHaveLength(3);
    expect(acimaDoFio.flatMap((group) => group.entries)).toHaveLength(9);
    expect(pe?.entries).toHaveLength(3);
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
      /*
       * O ATENDENTE VÊ ENTREGADORES, e é o teste que prova a escolha de
       * `nav.ts`: `POST .../assignments` é PESSOAS porque quem entrega o pedido
       * ao motoboy é quem está no balcão. Cadastrar e excluir continuam sendo
       * da gerência, e isso é decidido DENTRO da tela.
       */
      '/entregadores',
      /*
       * O PÉ DELE É UM ITEM SÓ, e isso é consequência de duas remoções, não
       * descuido. WhatsApp saiu da lista dele quando a tela nasceu: ler os
       * canais é `GERENCIA` (`GET /admin/whatsapp/channels`), como Cupons e
       * Cashback — e enquanto a tela era "em breve" ele chegava lá, porque item
       * sem `acao` é item de todo mundo. Integrações saiu do menu inteiro em
       * 05/09/2026 (o porquê está em `nav.ts`), e era ela quem fazia o par.
       *
       * Um grupo de UM contraria o que este bloco dizia — e o caso é o do
       * RODAPÉ, que não pinta rótulo: o atendente vê "Loja" solta no fim da
       * lateral, e não uma seção de um item. Se um dia isso incomodar na tela,
       * o conserto é de layout e não de navegação: não se inventa item para
       * fazer companhia.
       */
      '/loja',
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
