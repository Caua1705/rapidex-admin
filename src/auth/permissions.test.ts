import { describe, expect, it } from 'vitest';

import {
  papeisDaAcao,
  papelDe,
  pode,
  podeDefinirCashback,
  podeDefinirPreco,
  podeEntrarNoPainel,
  podeLerDinheiro,
  type Acao,
} from './permissions';

/**
 * TODAS as ações do painel. Escrita por extenso, e não derivada do mapa: é ela
 * que faz o teste seguinte cobrir a ponte inteira em vez de cobrir o que
 * alguém lembrou de acrescentar.
 */
const ACOES: readonly Acao[] = [
  'pedidos.ver',
  'pedidos.avancarStatus',
  'pedidos.cancelar',
  'pedidos.ajustarPreparo',
  'pedidos.tempoReal',
  'cardapio.ver',
  'cardapio.criarProduto',
  'cardapio.editarProduto',
  'cardapio.trocarDisponibilidade',
  'cardapio.enviarFoto',
  'cardapio.editarComplemento',
  'cardapio.criarCategoria',
  'cardapio.editarCategoria',
  'cardapio.reordenarCategorias',
  'cardapio.apontarSetorDoProduto',
  'cardapio.apontarSetorDaCategoria',
  'clientes.ver',
  'desempenho.ver',
  'desempenho.verComissao',
  'loja.abrirFechar',
  'loja.editarTiposDePedido',
  'loja.editarPadroes',
  'loja.editarMarca',
  'loja.editarValoresDaFilial',
  'loja.editarFilial',
  'loja.editarHorarios',
  'loja.editarPagamento',
  'impressao.verPrograma',
  'impressao.verImpressoras',
  'impressao.mandarTeste',
  'impressao.editarSetores',
] as const;

describe('a ponte entre ação e rota', () => {
  /*
   * O TESTE QUE PROTEGE A GERAÇÃO.
   *
   * `papeisDaAcao` lança quando a ação aponta para um par (método, caminho) que
   * o mapa gerado não tem. O compilador já cobre isso — mas ele cobre contra o
   * mapa que está no disco AGORA, e `npm run papeis:generate` reescreve esse
   * arquivo. Este teste é o que fica vermelho quando uma regeração muda o mapa
   * e alguém commita sem rodar o typecheck.
   */
  it('toda ação resolve para um conjunto de papéis não vazio', () => {
    ACOES.forEach((acao) => {
      const papeis = papeisDaAcao(acao);
      expect(papeis.length, `a ação "${acao}" ficou sem papel nenhum`).toBeGreaterThan(0);
    });
  });

  it('nenhuma ação é alcançável pela conta de máquina', () => {
    /*
     * `print_agent` não tem tela. As quatro rotas que ele alcança (heartbeat,
     * impressoras, ticket do stream e as vias de um pedido) não são botão de
     * ninguém — e `pedidos.tempoReal` é a única da ponte cujo conjunto o
     * inclui, porque o agente escuta o mesmo stream. Ainda assim ele não entra
     * no painel, então na prática nenhuma ação é dele.
     */
    const alcancadas = ACOES.filter((acao) => pode('print_agent', acao));
    expect(alcancadas).toEqual(['pedidos.tempoReal']);
    expect(podeEntrarNoPainel('print_agent')).toBe(false);
  });
});

/*
 * AS DECISÕES DO BACKEND, uma a uma. Elas não são reescritas aqui: o mapa vem
 * gerado, e estas asserções são a leitura dele em português — o lugar onde uma
 * mudança de contrato aparece como uma frase, e não como um diff de tabela.
 */
describe('o que cada papel alcança', () => {
  it('a conta de máquina não lê a lista de pedidos', () => {
    // É a rota que devolve telefone e endereço de todo cliente, e a senha do
    // agente está em texto puro no config.ini do balcão.
    expect(pode('print_agent', 'pedidos.ver')).toBe(false);
    expect(pode('attendant', 'pedidos.ver')).toBe(true);
  });

  it('criar produto é só do dono; editar é da gerência', () => {
    expect(pode('owner', 'cardapio.criarProduto')).toBe(true);
    expect(pode('manager', 'cardapio.criarProduto')).toBe(false);

    // `price` é obrigatório na criação: criar produto é definir preço.
    expect(pode('manager', 'cardapio.editarProduto')).toBe(true);
    expect(pode('attendant', 'cardapio.editarProduto')).toBe(false);
  });

  it('trocar disponibilidade é do balcão — é a ação mais frequente do turno', () => {
    expect(pode('attendant', 'cardapio.trocarDisponibilidade')).toBe(true);
  });

  it('cancelar pedido é da gerência, avançar não é', () => {
    expect(pode('attendant', 'pedidos.avancarStatus')).toBe(true);
    expect(pode('attendant', 'pedidos.cancelar')).toBe(false);
    expect(pode('manager', 'pedidos.cancelar')).toBe(true);
  });

  it('a lista de clientes é da gerência: ela devolve a base inteira', () => {
    expect(pode('attendant', 'clientes.ver')).toBe(false);
    expect(pode('manager', 'clientes.ver')).toBe(true);
  });

  it('relatório é da gerência; comissão é só do dono', () => {
    expect(pode('manager', 'desempenho.ver')).toBe(true);
    expect(pode('manager', 'desempenho.verComissao')).toBe(false);
    expect(pode('owner', 'desempenho.verComissao')).toBe(true);
    expect(pode('attendant', 'desempenho.ver')).toBe(false);
  });

  it('preparo e via de teste ficam com quem opera', () => {
    expect(pode('attendant', 'pedidos.ajustarPreparo')).toBe(true);
    expect(pode('attendant', 'impressao.mandarTeste')).toBe(true);
    expect(pode('attendant', 'impressao.verPrograma')).toBe(true);
    // A lista de impressoras da máquina, essa é da gerência.
    expect(pode('attendant', 'impressao.verImpressoras')).toBe(false);
  });

  it('abrir e fechar a loja é do balcão; mudar como ela vende não é', () => {
    expect(pode('attendant', 'loja.abrirFechar')).toBe(true);
    expect(pode('attendant', 'loja.editarTiposDePedido')).toBe(false);
  });

  it('a equipe é inteiramente do dono — as quatro rotas, sem meio-termo', () => {
    /*
     * É a única tela do painel sem assimetria de papel: em Cupons e Cashback a
     * gerência lê e o dono escreve. Aqui não há o que dar ao gerente — a
     * listagem devolve o e-mail de todo mundo da casa, que é metade da
     * credencial de cada pessoa.
     */
    for (const acao of [
      'usuarios.ver',
      'usuarios.criar',
      'usuarios.editar',
      'usuarios.redefinirSenha',
    ] as const) {
      expect(pode('owner', acao)).toBe(true);
      expect(pode('manager', acao)).toBe(false);
      expect(pode('attendant', acao)).toBe(false);
    }
  });

  it('os padrões da rede e os valores da filial são do dono', () => {
    expect(pode('manager', 'loja.editarPadroes')).toBe(false);
    expect(pode('manager', 'loja.editarValoresDaFilial')).toBe(false);
    expect(pode('manager', 'loja.editarHorarios')).toBe(true);
  });

  it('sem papel, nada — inclusive enquanto a sessão carrega', () => {
    expect(pode(null, 'pedidos.ver')).toBe(false);
    expect(pode(undefined, 'cardapio.trocarDisponibilidade')).toBe(false);
  });
});

/* ==========================================================================
 * AS DUAS REGRAS QUE NÃO SÃO DE ROTA
 *
 * São as escritas à mão, e é por isso que elas têm o teste mais explícito do
 * arquivo: não há geração que as corrija, então este bloco é o único lugar
 * onde uma divergência com o backend pode aparecer.
 * ======================================================================= */

describe('podeDefinirPreco', () => {
  it('é do dono, e não acompanha o resto da edição de produto', () => {
    expect(podeDefinirPreco('owner')).toBe(true);
    expect(podeDefinirPreco('manager')).toBe(false);
    expect(podeDefinirPreco('attendant')).toBe(false);
  });

  /*
   * A assimetria é o ponto: o gerente EDITA produto (nome, descrição,
   * categoria) e não define preço. Sem isto, "editar item" e "dar 99% em tudo"
   * seriam a mesma permissão.
   */
  it('convive com a permissão de editar o produto', () => {
    expect(pode('manager', 'cardapio.editarProduto')).toBe(true);
    expect(podeDefinirPreco('manager')).toBe(false);
  });
});

describe('podeDefinirCashback', () => {
  it('é do dono, e a rota de forma de pagamento é da gerência', () => {
    expect(podeDefinirCashback('owner')).toBe(true);
    expect(podeDefinirCashback('manager')).toBe(false);
    expect(podeDefinirCashback('attendant')).toBe(false);
  });

  /*
   * A MESMA ASSIMETRIA DO PREÇO, e é o que impede meia decisão de cada lado da
   * mesma campanha: o gerente CADASTRA forma de pagamento (bandeira, rótulo,
   * ícone, ordem) e não escolhe se ela gasta o dinheiro do lojista.
   */
  it('convive com a permissão de cadastrar forma de pagamento', () => {
    expect(pode('manager', 'loja.editarPagamento')).toBe(true);
    expect(podeDefinirCashback('manager')).toBe(false);
  });
});

describe('as cinco rotas de cashback', () => {
  it('a gerência LÊ a regra e não escreve nenhuma das três', () => {
    expect(pode('manager', 'cashback.ver')).toBe(true);
    expect(pode('manager', 'cashback.editarRede')).toBe(false);
    expect(pode('manager', 'cashback.editarFilial')).toBe(false);
    expect(pode('manager', 'cashback.apagarSobrescrita')).toBe(false);
  });

  it('o dono escreve as três', () => {
    expect(pode('owner', 'cashback.editarRede')).toBe(true);
    expect(pode('owner', 'cashback.editarFilial')).toBe(true);
    expect(pode('owner', 'cashback.apagarSobrescrita')).toBe(true);
  });

  /* O percentual é termo comercial, não alavanca de balcão — e a senha do
     balcão é a que mais circula. */
  it('o balcão não alcança nem a leitura', () => {
    expect(pode('attendant', 'cashback.ver')).toBe(false);
  });
});

describe('podeLerDinheiro', () => {
  it('o dono lê com ou sem recorte de filial', () => {
    expect(podeLerDinheiro('owner', '')).toBe(true);
    expect(podeLerDinheiro('owner', 'fil-1')).toBe(true);
  });

  /*
   * A REGRA INTEIRA ESTÁ AQUI: sem `branch_id` a consulta soma as lojas todas,
   * e o resultado da Aldeota não é do gerente do Centro. Com recorte, ele está
   * lendo o resultado do próprio trabalho.
   */
  it('a gerência precisa escolher UMA filial', () => {
    expect(podeLerDinheiro('manager', '')).toBe(false);
    expect(podeLerDinheiro('manager', 'fil-1')).toBe(true);
  });

  it('o balcão não lê faturamento de jeito nenhum', () => {
    expect(podeLerDinheiro('attendant', 'fil-1')).toBe(false);
    expect(podeLerDinheiro('print_agent', 'fil-1')).toBe(false);
  });
});

describe('papelDe', () => {
  it('estreita as quatro strings conhecidas', () => {
    expect(papelDe('owner')).toBe('owner');
    expect(papelDe('print_agent')).toBe('print_agent');
  });

  /*
   * FALHA FECHADO. `AdminUserResponse.role` é `str` no contrato, então um papel
   * novo no backend chega aqui como texto qualquer. Devolver `null` esconde os
   * botões; devolver a string mostraria todos e cada clique seria um 403.
   */
  it('papel desconhecido vira nada, e nada não pode fazer nada', () => {
    expect(papelDe('supervisor')).toBeNull();
    expect(papelDe('')).toBeNull();
    expect(papelDe(null)).toBeNull();
    expect(pode(papelDe('supervisor'), 'pedidos.ver')).toBe(false);
  });
});

describe('podeEntrarNoPainel', () => {
  it('as três contas de pessoa entram', () => {
    expect(podeEntrarNoPainel('owner')).toBe(true);
    expect(podeEntrarNoPainel('manager')).toBe(true);
    expect(podeEntrarNoPainel('attendant')).toBe(true);
  });

  /*
   * A conta de máquina não. O backend NÃO pode recusá-la no login — é por ele
   * que o próprio agente se autentica, e barrar lá pararia a impressão de todas
   * as lojas. A recusa é da tela, e é este o teste dela.
   */
  it('a conta do programa de impressão, não', () => {
    expect(podeEntrarNoPainel('print_agent')).toBe(false);
  });

  it('sem papel também não', () => {
    expect(podeEntrarNoPainel(null)).toBe(false);
    expect(podeEntrarNoPainel(papelDe('supervisor'))).toBe(false);
  });
});
