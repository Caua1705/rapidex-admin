import { StarIcon } from '../ds/icons';
import { RATING_SCALE } from './review-model';

/**
 * A NOTA, EM ESTRELAS — a leitura de relance da lista.
 *
 * Cinco estrelas, as primeiras cheias. Por que não só o numeral: numa lista de
 * quarenta linhas o olho não compara algarismos, compara COMPRIMENTO — e a
 * pergunta desta tela ("o que deu errado") se responde varrendo a coluna, não
 * lendo cada item.
 *
 * ELA NÃO TEM COR. Uma escala de vermelho a verde seria a leitura mais rápida
 * de todas, e é justamente o que o sistema não faz: a marca tem um emprego só
 * (a ação primária) e `--danger` quer dizer perigo, não "nota 2". O que separa
 * a estrela cheia da vazia é o PREENCHIMENTO e a tinta (`--ink` contra
 * `--ink-3`), que sobrevive ao daltonismo e ao tema escuro.
 *
 * ACESSIBILIDADE: o conjunto é uma imagem só, com o nome escrito ("2 de 5
 * estrelas"). Cinco ícones anunciados um a um seriam cinco ruídos por linha, e
 * `StarIcon` já nasce `aria-hidden`.
 */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="estrelas" role="img" aria-label={`${value} de 5 estrelas`}>
      {/*
        A escala é lida da pior para a melhor aqui, porque a ordem de desenho é
        da esquerda para a direita — `RATING_SCALE` é a ordem de LEITURA do
        histograma (a melhor em cima), e reusá-la sem inverter deixaria as
        estrelas cheias à direita.
      */}
      {[...RATING_SCALE].reverse().map((nota) => (
        /*
          A TINTA VEM DO INVÓLUCRO, e não de um seletor sobre o `<svg>`: todo
          ícone do sistema nasce com `fill="none"` no elemento raiz (é o `path`
          que ganha o preenchimento), então `svg[fill='none']` casaria com as
          cinco estrelas. Uma classe no `<span>` diz o que o desenho não diz.
        */
        <span
          key={nota}
          className={`estrelas__item${nota <= value ? ' estrelas__item--cheia' : ''}`}
        >
          <StarIcon size={size} filled={nota <= value} />
        </span>
      ))}
    </span>
  );
}

/**
 * A nota como RÓTULO de uma linha do histograma: o algarismo e uma estrela.
 *
 * Cinco fileiras de cinco estrelas seriam vinte e cinco ícones para dizer o
 * que "5 ★" diz em dois caracteres — e ali o comprimento que importa é o da
 * BARRA ao lado, que é o dado. O algarismo leva `.tnum` porque as cinco
 * linhas formam uma coluna, e coluna de número se alinha.
 */
export function RatingLabel({ rating }: { rating: number }) {
  return (
    <span className="nota-rotulo" role="img" aria-label={`${rating} de 5 estrelas`}>
      <span className="tnum">{rating}</span>
      <StarIcon size={13} filled />
    </span>
  );
}
