import { useCallback, useEffect, useRef, useState } from 'react';

const MUTE_STORAGE_KEY = 'rapidex-admin.som-mudo';

/**
 * Alerta sonoro de pedido novo.
 *
 * O som é sintetizado com a Web Audio API em vez de tocar um arquivo .mp3:
 * não há asset para baixar (o alerta funciona no primeiro pedido, mesmo com a
 * internet ruim), não há arquivo binário no repositório e o volume é o mesmo
 * em qualquer máquina.
 *
 * O navegador bloqueia áudio até a pessoa interagir com a página. Depois do
 * login isso já aconteceu, mas um painel restaurado do localStorage e deixado
 * numa TV pode nunca receber um clique — por isso `isBlocked` existe e a tela
 * mostra um botão "Ativar som".
 *
 * ----------------------------------------------------------------------------
 * O ESTADO DO ÁUDIO É OBSERVADO, E NÃO DEDUZIDO DE UMA TENTATIVA QUE FALHOU
 * ----------------------------------------------------------------------------
 *
 * `isBlocked` era descoberto DENTRO do `play()`: com o contexto suspenso, a
 * função marcava a bandeira, pedia `resume()` e voltava SEM TOCAR. O botão
 * "Ativar som" aparecia depois do primeiro pedido — e o primeiro pedido do
 * turno, que é o que ninguém está esperando, passava em silêncio. O aviso
 * chegava exatamente um pedido atrasado, que é o pedido que ele existia para
 * não perder.
 *
 * Hoje o hook LÊ `context.state` na montagem e ESCUTA `statechange`. A
 * diferença não é só de momento: alguns navegadores suspendem o áudio de uma
 * aba que ficou horas escondida, que é o dia a dia de um painel de balcão — e
 * sem ouvir a mudança, a tela só descobriria isso no pedido seguinte.
 *
 * MUDO VENCE BLOQUEADO. São duas chaves para a mesma saída: quem desligou o
 * sino não precisa ser convidado a "ativar o som", e o sino cortado já explica
 * o silêncio. Oferecer as duas coisas juntas faz o lojista apertar uma para
 * descobrir que faltava a outra.
 */
export function useNewOrderSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  /** O NAVEGADOR está segurando o áudio? Fato sobre o contexto, e só isso. */
  const [bloqueadoPeloNavegador, setBloqueadoPeloNavegador] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem(MUTE_STORAGE_KEY) === '1');

  const getContext = useCallback((): AudioContext | null => {
    if (audioContextRef.current) return audioContextRef.current;
    if (typeof AudioContext === 'undefined') return null;
    audioContextRef.current = new AudioContext();
    return audioContextRef.current;
  }, []);

  /*
   * O CONTEXTO NASCE COM A TELA, e não com o primeiro pedido. É o que permite
   * saber do bloqueio antes de perder um alerta — ver o cabeçalho. O custo é um
   * `AudioContext` por painel aberto, fechado na saída.
   */
  useEffect(() => {
    const context = getContext();
    if (!context) return;

    const sincronizar = () => setBloqueadoPeloNavegador(context.state === 'suspended');
    sincronizar();
    context.addEventListener('statechange', sincronizar);

    return () => {
      context.removeEventListener('statechange', sincronizar);
      void context.close();
      audioContextRef.current = null;
    };
  }, [getContext]);

  /** Duas notas curtas subindo — corta o barulho de cozinha sem assustar. */
  const play = useCallback(() => {
    if (isMuted) return;

    const context = getContext();
    if (!context) return;

    /*
     * A bandeira NÃO é escrita aqui: quem a mantém é o `statechange` acima, e
     * duas escritas para o mesmo fato divergiriam. O que sobra para o `play` é
     * pedir a liberação e desistir deste alerta — o som só sai depois do
     * `resume`, e a essa altura o pedido já entrou na lista.
     */
    if (context.state === 'suspended') {
      void context.resume();
      return;
    }

    const startAt = context.currentTime;
    [
      { frequency: 880, offset: 0 },
      { frequency: 1320, offset: 0.16 },
    ].forEach(({ frequency, offset }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      // Envelope: sem ele o som começa e termina com um "clique" audível.
      gain.gain.setValueAtTime(0, startAt + offset);
      gain.gain.linearRampToValueAtTime(0.25, startAt + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + offset + 0.15);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.16);
    });
  }, [getContext, isMuted]);

  /** Chamado pelo botão "Ativar som": um clique basta para liberar o áudio. */
  const unblock = useCallback(async () => {
    const context = getContext();
    if (!context) return;
    await context.resume();
    // O `statechange` normalmente já resolveu isto; a linha existe para o
    // navegador que resolve a promessa sem disparar o evento.
    setBloqueadoPeloNavegador(context.state === 'suspended');
  }, [getContext]);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  /*
   * O QUE A TELA RECEBE JÁ É A DECISÃO, e não os dois fatos para ela combinar:
   * uma segunda tela que esquecesse o `&& !isMuted` ofereceria "Ativar som" ao
   * lado de um sino cortado. Ver o cabeçalho.
   */
  return { play, isBlocked: bloqueadoPeloNavegador && !isMuted, unblock, isMuted, toggleMute };
}
