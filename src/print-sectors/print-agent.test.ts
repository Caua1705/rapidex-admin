import { describe, expect, it } from 'vitest';

import {
  agentHint,
  agentLabel,
  agentState,
  avisoDeAgenteParado,
  formatAgo,
  linhaDaComanda,
  type AgenteDaFilial,
} from './print-agent';
import type { PrintAgentStatus } from '../api/types';

function status(overrides: Partial<PrintAgentStatus> = {}): PrintAgentStatus {
  return {
    branch_id: '22222222-2222-2222-2222-222222222222',
    is_online: true,
    last_seen_at: '2026-08-20T20:00:00Z',
    seconds_since_last_seen: 12,
    agent_version: '1.4.2',
    ...overrides,
  };
}

describe('agentState', () => {
  it('no ar é o que o backend disse, não uma conta refeita aqui', () => {
    expect(agentState(status({ is_online: true }))).toBe('live');
    expect(agentState(status({ is_online: false }))).toBe('offline');
  });

  /*
   * O TERCEIRO ESTADO NÃO É UM CASO DO SEGUNDO, e o contrato do backend frisa
   * isso ao responder 200 (não 404) para filial sem agente: "nunca instalado"
   * se resolve indo instalar, "desligado" se resolve ligando o computador. A
   * tela que os confunde manda o lojista procurar um programa que não está lá.
   */
  it('sem último sinal é "nunca instalado", e não "desligado"', () => {
    expect(agentState(status({ is_online: false, last_seen_at: null }))).toBe('never');
    expect(agentState(null)).toBe('never');
  });

  /*
   * `is_online` VENCE o carimbo. O backend compara com o relógio DELE, e um
   * balcão com a hora errada — que é comum — veria o programa como fora do ar
   * para sempre se a tela refizesse a conta com `last_seen_at`.
   */
  it('não recalcula a janela de 90s a partir do carimbo', () => {
    const antigo = status({ is_online: true, seconds_since_last_seen: 9999 });
    expect(agentState(antigo)).toBe('live');
  });
});

describe('formatAgo', () => {
  it('abaixo de um minuto é "agora mesmo", nunca "há 0 minutos"', () => {
    expect(formatAgo(0)).toBe('agora mesmo');
    expect(formatAgo(12)).toBe('agora mesmo');
    expect(formatAgo(59)).toBe('agora mesmo');
  });

  it('concorda o singular e o plural em cada degrau', () => {
    expect(formatAgo(60)).toBe('há 1 minuto');
    expect(formatAgo(120)).toBe('há 2 minutos');
    expect(formatAgo(3600)).toBe('há 1 hora');
    expect(formatAgo(7200)).toBe('há 2 horas');
    expect(formatAgo(86_400)).toBe('há 1 dia');
    expect(formatAgo(172_800)).toBe('há 2 dias');
  });

  it('não desce abaixo de zero nem inventa número sem entrada', () => {
    expect(formatAgo(-30)).toBe('agora mesmo');
    expect(formatAgo(null)).toBe('—');
    expect(formatAgo(undefined)).toBe('—');
    expect(formatAgo(Number.NaN)).toBe('—');
  });
});

describe('agentLabel', () => {
  it('no ar, três palavras', () => {
    expect(agentLabel(status())).toBe('Rodando agora');
  });

  it('fora do ar, diz há quanto tempo — é a pergunta seguinte', () => {
    expect(agentLabel(status({ is_online: false, seconds_since_last_seen: 3600 }))).toBe(
      'Sem sinal há 1 hora',
    );
  });

  it('nunca instalado não vira "sem sinal há —"', () => {
    expect(agentLabel(null)).toBe('Nunca instalado nesta loja');
  });
});

describe('agentHint', () => {
  /*
   * A FRASE DIZ A CONSEQUÊNCIA, NÃO O MECANISMO. O texto que estava na tela
   * explicava que o navegador não fala com impressora térmica — certo, e longo
   * demais para uma tela de configuração usada em pé no balcão.
   */
  it('com o programa no ar, avisa o que acontece se o computador desligar', () => {
    expect(agentHint(status())).toContain('Com ele desligado, nada é impresso');
  });

  it('fora do ar, diz que nada está saindo e o que conferir', () => {
    const texto = agentHint(status({ is_online: false }));
    expect(texto).toContain('Nenhuma comanda está saindo');
    expect(texto).toContain('computador do balcão');
  });

  it('nunca instalado explica de onde sai a comanda, que é o que falta saber', () => {
    expect(agentHint(null)).toContain('não sai do navegador');
  });

  /*
   * SEM JARGÃO EM NENHUM DOS TRÊS. "Agente", "daemon" e "heartbeat" são
   * palavras de quem escreveu o programa, não de quem tem uma pizzaria — e uma
   * delas na tela faz o painel parecer documentação de outra pessoa.
   */
  it('nenhuma das três frases usa jargão', () => {
    const frases = [agentHint(status()), agentHint(status({ is_online: false })), agentHint(null)];
    frases.forEach((frase) => {
      expect(frase.toLowerCase()).not.toMatch(/agente|daemon|heartbeat|headless/);
    });
  });
});

/*
 * ============================================================================
 * O AVISO QUE SAI DE LOJA › IMPRESSÃO E VAI PARA ONDE O LOJISTA ESTÁ
 * ============================================================================
 *
 * O estado do agente vivia numa tela só, e ela é a tela que só abre quem JÁ
 * desconfia. O programa caía às dezenove horas e Pedidos continuava idêntico:
 * a comanda parava de sair e o painel não dizia nada até alguém reclamar.
 */
function agente(nome: string, overrides: Partial<PrintAgentStatus> = {}): AgenteDaFilial {
  return { branchId: `id-${nome}`, nome, status: status(overrides) };
}

const PARADO = { is_online: false, seconds_since_last_seen: 3600 } as const;

describe('avisoDeAgenteParado', () => {
  it('com tudo rodando não há aviso nenhum', () => {
    expect(avisoDeAgenteParado([agente('Aldeota'), agente('Zona Norte')])).toBeNull();
  });

  /*
   * COM UMA FILIAL EM VISTA, O AVISO NÃO A NOMEIA: o cabeçalho da tela já diz
   * de qual loja é a fila, e repetir o nome numa faixa de uma linha gasta a
   * largura que a frase precisa para dizer o que fazer.
   */
  it('uma filial em vista: diz o tempo e o que conferir, sem nomear a loja', () => {
    const aviso = avisoDeAgenteParado([agente('Aldeota', PARADO)]);
    expect(aviso).toContain('Nenhuma comanda está saindo');
    expect(aviso).toContain('há 1 hora');
    expect(aviso).toContain('computador do balcão');
    expect(aviso).not.toContain('Aldeota');
  });

  it('com várias em vista, nomeia a que parou — as outras estão bem', () => {
    const aviso = avisoDeAgenteParado([agente('Aldeota', PARADO), agente('Zona Norte')]);
    expect(aviso).toContain('na Aldeota');
    expect(aviso).toContain('há 1 hora');
  });

  it('duas paradas viram uma frase só, com o tempo de cada uma', () => {
    const aviso = avisoDeAgenteParado([
      agente('Aldeota', PARADO),
      agente('Zona Norte', { is_online: false, seconds_since_last_seen: 300 }),
    ]);
    expect(aviso).toContain('2 filiais');
    expect(aviso).toContain('Aldeota (sem sinal há 1 hora)');
    expect(aviso).toContain('Zona Norte (sem sinal há 5 minutos)');
  });

  /*
   * "NUNCA INSTALADO" NÃO É INCIDENTE, e é a diferença entre um aviso que se lê
   * e um que se aprende a ignorar. Uma loja que não comprou impressora veria
   * esta faixa todo dia, o turno inteiro, para sempre — e no dia em que o
   * programa da OUTRA loja caísse, a faixa já seria papel de parede.
   *
   * Quem nunca instalou descobre isso em Loja › Impressão, que é onde se
   * instala. O que esta faixa avisa é o que PAROU.
   */
  it('filial que nunca instalou o programa não gera faixa', () => {
    expect(avisoDeAgenteParado([agente('Aldeota', { is_online: false, last_seen_at: null })])).toBe(
      null,
    );
  });

  /*
   * LEITURA QUE NÃO VOLTOU NÃO VIRA AFIRMAÇÃO. Sem resposta, o painel não sabe
   * se a comanda está saindo — e "Nenhuma comanda está saindo" numa queda de
   * rede de três segundos manda o lojista até o balcão à toa. É o mesmo defeito
   * do `catch` que devolve o valor de "não há" para dizer "não consegui ler".
   */
  it('filial ainda não lida fica de fora do aviso', () => {
    expect(avisoDeAgenteParado([{ branchId: 'id-x', nome: 'Aldeota', status: undefined }])).toBe(
      null,
    );
  });
});

/*
 * A LINHA DA COMANDA, dentro do pedido. Ela dizia "se o papel não saiu, confira
 * o programa em Loja › Impressão" — um recado para ir procurar a resposta em
 * outra tela, escrito na tela onde a resposta cabia.
 */
describe('linhaDaComanda', () => {
  it('rodando: afirma que o que está na tela foi para o papel', () => {
    expect(linhaDaComanda(status())).toContain('rodando agora');
  });

  it('parado: diz desde quando, no lugar de mandar conferir noutra tela', () => {
    const linha = linhaDaComanda(status(PARADO));
    expect(linha).toContain('há 1 hora');
    expect(linha).not.toContain('Loja');
  });

  it('nunca instalado: diz que nada sai no papel nesta loja', () => {
    expect(linhaDaComanda(status({ is_online: false, last_seen_at: null }))).toContain(
      'não tem o programa',
    );
  });

  /*
   * ENQUANTO NÃO LEU, NÃO AFIRMA. `undefined` é "ainda não sei" e `null` seria
   * "não existe" — a distinção que esta rodada aprendeu a levar a sério.
   */
  it('antes da resposta, não afirma estado nenhum', () => {
    expect(linhaDaComanda(undefined)).not.toContain('rodando');
    expect(linhaDaComanda(undefined)).not.toContain('sem sinal');
  });
});
