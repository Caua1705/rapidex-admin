import { faixaDe, razaoDeMaturacao } from './maturation';
import './MaturationBar.css';

/**
 * A BARRA DE MATURAÇÃO — o elemento de assinatura do sistema.
 *
 *   <MaturationBar elapsedMinutes={62} windowMinutes={100} />
 *
 * O QUE ELA É: um fio de 3px sob o tempo decorrido da linha de pedido, que
 * preenche proporcionalmente ao tempo contra a janela de preparo configurada
 * da loja (`tempo_estimado_max`) e vai de ardósia a ocre a carmim (ver
 * `--grad-maturacao` em tokens.css).
 *
 * POR QUE ELA EXISTE, E POR QUE É O ÚNICO ORNAMENTO PERMITIDO: numa fila de
 * trinta pedidos, ler trinta números de minutos é trabalho. Trinta fios de
 * comprimentos diferentes se lê de uma vez, de longe, sem ler nenhum número —
 * e a churrascaria do piloto prepara em 90 a 100 minutos, então a diferença
 * entre "acabou de entrar" e "vai estourar" é a informação mais cara da tela.
 *
 * Ela carrega DADO, não decoração. É por isso que ela é a única coisa neste
 * sistema que existe só para ser vista: gradiente, glassmorphism, ilustração e
 * animação ambiente continuam proibidos em todo lugar, inclusive aqui.
 *
 * ACESSIBILIDADE: a barra é `aria-hidden`. Ela não é a fonte da informação — é
 * o atalho visual dela. O número de minutos fica escrito logo acima, na coluna
 * do tempo, no maior corpo da linha; cor sozinha nunca diz nada aqui (1.4.1).
 * Sem janela configurada na loja, ela simplesmente não aparece: uma barra sem
 * régua mediria o nada.
 */
export function MaturationBar({
  elapsedMinutes,
  windowMinutes,
}: {
  /** Minutos desde a entrada. `null` = o pedido não tem hora — a barra some. */
  elapsedMinutes: number | null;
  /** `tempo_estimado_max` da loja. Sem ele (0 ou nulo) a barra não existe. */
  windowMinutes: number | null;
}) {
  const razao = razaoDeMaturacao(elapsedMinutes, windowMinutes);
  if (razao === null) return null;

  return (
    <span
      className={`ds-maturacao ds-maturacao--${faixaDe(razao)}`}
      aria-hidden="true"
      style={{ ['--preenchido' as string]: `${(razao * 100).toFixed(1)}%` }}
    >
      <span className="ds-maturacao__fio" />
    </span>
  );
}
