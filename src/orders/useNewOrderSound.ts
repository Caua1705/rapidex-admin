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
 */
export function useNewOrderSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem(MUTE_STORAGE_KEY) === '1');

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  const getContext = useCallback((): AudioContext | null => {
    if (audioContextRef.current) return audioContextRef.current;
    if (typeof AudioContext === 'undefined') return null;
    audioContextRef.current = new AudioContext();
    return audioContextRef.current;
  }, []);

  /** Duas notas curtas subindo — corta o barulho de cozinha sem assustar. */
  const play = useCallback(() => {
    if (isMuted) return;

    const context = getContext();
    if (!context) return;

    if (context.state === 'suspended') {
      setIsBlocked(true);
      void context.resume();
      return;
    }
    setIsBlocked(false);

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
    setIsBlocked(context.state === 'suspended');
  }, [getContext]);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return { play, isBlocked, unblock, isMuted, toggleMute };
}
