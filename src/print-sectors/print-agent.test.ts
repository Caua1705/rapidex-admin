import { describe, expect, it } from 'vitest';

import { agentHint, agentLabel, agentState, formatAgo } from './print-agent';
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
