import { useEffect, useState } from 'react';

/**
 * O relógio que faz os cronômetros da cozinha andarem sozinhos.
 *
 * A tela da cozinha fica ligada o dia inteiro e ninguém a opera: sem um tique,
 * "12 min" continuaria escrito 12 min até alguém mexer em alguma coisa, e o
 * número que a tela existe para mostrar seria justamente o mais velho dela.
 *
 * Um relógio SÓ para a tela inteira, e não um por cartão: com um `setInterval`
 * por cartão, trinta pedidos virariam trinta temporizadores desalinhados, e dois
 * pedidos do mesmo minuto passariam a exibir minutos diferentes conforme a hora
 * em que cada card montou.
 *
 * 15s para um número em minutos: o erro máximo na virada do minuto é de 15s, e
 * a conta é uma subtração — não há motivo para acordar a tela mais que isso.
 */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
