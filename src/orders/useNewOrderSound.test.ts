import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNewOrderSound } from './useNewOrderSound';

/*
 * ============================================================================
 * O PRIMEIRO PEDIDO DO TURNO NÃO APITAVA
 * ============================================================================
 *
 * O navegador bloqueia áudio até a pessoa interagir com a página. Depois do
 * login isso já aconteceu — mas um painel restaurado do `localStorage` e
 * deixado numa TV do balcão pode nunca receber um clique, e o cabeçalho do
 * próprio arquivo já previa esse caso.
 *
 * O QUE FALTAVA: `isBlocked` só era descoberto DENTRO do `play()`, quando o
 * pedido já tinha chegado e passado em silêncio. O botão "Ativar som" aparecia
 * depois da perda, e a perda é justamente o que ele existe para evitar.
 *
 * O estado do áudio é um fato OBSERVÁVEL (`context.state`), não uma conclusão
 * a tirar de uma tentativa que falhou. É essa a diferença que estes testes
 * protegem.
 */

class FakeAudioContext {
  static proximoEstado: AudioContextState = 'running';

  state: AudioContextState = FakeAudioContext.proximoEstado;
  currentTime = 0;
  readonly destination = {};
  readonly ouvintes = new Set<() => void>();
  resumes = 0;

  addEventListener(_tipo: string, ouvinte: () => void) {
    this.ouvintes.add(ouvinte);
  }

  removeEventListener(_tipo: string, ouvinte: () => void) {
    this.ouvintes.delete(ouvinte);
  }

  /** O navegador mudou o estado do áudio por conta própria. */
  virar(estado: AudioContextState) {
    this.state = estado;
    this.ouvintes.forEach((ouvinte) => ouvinte());
  }

  resume() {
    this.resumes += 1;
    this.virar('running');
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }

  createOscillator() {
    return {
      type: '',
      frequency: { value: 0 },
      connect: () => ({ connect: () => undefined }),
      start: () => undefined,
      stop: () => undefined,
    };
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => ({ connect: () => undefined }),
    };
  }
}

/** A última instância criada — a que o hook está usando. */
let criados: FakeAudioContext[] = [];

beforeEach(() => {
  criados = [];
  localStorage.clear();
  FakeAudioContext.proximoEstado = 'running';
  vi.stubGlobal(
    'AudioContext',
    class extends FakeAudioContext {
      constructor() {
        super();
        criados.push(this);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useNewOrderSound', () => {
  /*
   * O CASO DA TV DO BALCÃO, e o motivo de tudo isto: a tela abre sozinha, sem
   * ninguém tocar nela, e o áudio nasce bloqueado. O aviso precisa estar na
   * tela ANTES do primeiro pedido — depois dele, já custou um pedido.
   */
  it('áudio bloqueado é sabido na montagem, sem nenhum pedido ter chegado', () => {
    FakeAudioContext.proximoEstado = 'suspended';

    const { result } = renderHook(() => useNewOrderSound());

    expect(result.current.isBlocked).toBe(true);
  });

  it('com áudio liberado, nada é oferecido — botão para ligar o que já está ligado é ruído', () => {
    const { result } = renderHook(() => useNewOrderSound());

    expect(result.current.isBlocked).toBe(false);
  });

  /*
   * O ESTADO É OBSERVADO, e não deduzido de uma tentativa. Alguns navegadores
   * suspendem o áudio de uma aba que ficou horas escondida — que é o dia a dia
   * de um painel de balcão. Sem ouvir a mudança, a tela só descobriria isso no
   * pedido seguinte, em silêncio.
   */
  it('se o navegador suspender o áudio depois, a tela fica sabendo na hora', () => {
    const { result } = renderHook(() => useNewOrderSound());
    expect(result.current.isBlocked).toBe(false);

    act(() => criados[0]!.virar('suspended'));

    expect(result.current.isBlocked).toBe(true);
  });

  it('"Ativar som" libera o áudio e o aviso sai da tela', async () => {
    FakeAudioContext.proximoEstado = 'suspended';
    const { result } = renderHook(() => useNewOrderSound());

    await act(async () => {
      await result.current.unblock();
    });

    expect(criados[0]!.resumes).toBe(1);
    expect(result.current.isBlocked).toBe(false);
  });

  /*
   * MUDO VENCE BLOQUEADO. São duas chaves diferentes para a mesma saída, e quem
   * desligou o sino não precisa ser convidado a "ativar o som": o sino cortado
   * já diz por que está quieto, e as duas mensagens juntas fariam o lojista
   * apertar uma para descobrir que faltava a outra.
   */
  it('com o alerta desligado pelo lojista, o bloqueio do navegador não vira convite', () => {
    FakeAudioContext.proximoEstado = 'suspended';
    const { result } = renderHook(() => useNewOrderSound());
    expect(result.current.isBlocked).toBe(true);

    act(() => result.current.toggleMute());

    expect(result.current.isMuted).toBe(true);
    expect(result.current.isBlocked).toBe(false);
  });
});
