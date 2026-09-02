import type { CouponTemplate } from '../api/types';
import { ImageIcon } from '../ds/icons';
import { contarArtes, descontoDaArte, textoDoQueDesconta, type GrupoDeArtes } from './coupon-model';

/**
 * A ESCOLHA DA ARTE — uma grade visual, nunca um `<select>`.
 *
 * A arte já traz o valor DESENHADO na imagem ("10% OFF", "R$ 5 OFF", "FRETE
 * GRÁTIS"), e é ela que o cliente vê na vitrine. Um seletor de texto pediria ao
 * lojista para escolher pelo nome do arquivo aquilo que ele vai reconhecer pelo
 * desenho — e é o desenho que decide a campanha.
 *
 * AGRUPADA POR TIPO, e isso é requisito e não organização: o catálogo vai
 * crescer para vinte ou trinta artes, e uma parede de imagem sem agrupamento
 * não se navega. Os grupos vêm prontos de `artesDisponiveis`, que também é quem
 * esconde as artes já usadas por este restaurante.
 *
 * O CONTROLE É `<input type="radio">` DE VERDADE, com `appearance` desligada e
 * o desenho por CSS — a mesma escolha de `ds/Choice`. Ele dá de graça o que uma
 * grade de `<button>` custaria escrever: grupo nomeado, setas do teclado,
 * `:checked` e o estado anunciado. O que se vê é inteiramente da folha de
 * estilo; o que se opera é nativo.
 */
export function ArtePicker({
  grupos,
  value,
  onChange,
  disabled = false,
  describedBy,
}: {
  grupos: readonly GrupoDeArtes[];
  value: string;
  onChange: (templateId: string) => void;
  disabled?: boolean;
  /** O id da mensagem de erro do campo, para o grupo inteiro apontar para ela. */
  describedBy?: string;
}) {
  /*
   * ESGOTOU O CATÁLOGO. Não é erro nem tela quebrada: o restaurante já tem uma
   * campanha em cada arte que a plataforma oferece, e o `UNIQUE (restaurant_id,
   * coupon_template_id)` impede a segunda. A saída é desligar uma campanha,
   * então é isso que a frase diz — e não "nenhuma arte encontrada", que soa
   * como defeito de carregamento.
   */
  if (contarArtes(grupos) === 0) {
    return (
      <p className="alert alert--info" role="status">
        Todas as artes da plataforma já estão em uso pelas suas campanhas. Cada arte vale por uma
        campanha, então desligue uma delas para liberar a arte.
      </p>
    );
  }

  return (
    <div className="artes" aria-describedby={describedBy}>
      {grupos.map((grupo) => (
        <fieldset key={grupo.tipo} className="artes__grupo" disabled={disabled}>
          <legend className="t-label artes__legenda">{grupo.label}</legend>

          <div className="artes__grade">
            {grupo.artes.map((arte) => (
              <ArteOpcao
                key={arte.id}
                arte={arte}
                marcada={arte.id === value}
                onChange={() => onChange(arte.id)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function ArteOpcao({
  arte,
  marcada,
  onChange,
}: {
  arte: CouponTemplate;
  marcada: boolean;
  onChange: () => void;
}) {
  const desconto = descontoDaArte(arte);

  return (
    <label className="arte">
      <input
        className="arte__input"
        type="radio"
        /*
         * O MESMO `name` PARA TODOS OS GRUPOS. Eles são `<fieldset>` separados
         * por causa do agrupamento visual, mas a escolha é UMA só — um `name`
         * por grupo faria o navegador tratá-los como três perguntas e deixaria
         * o lojista marcar uma arte percentual E uma de frete grátis.
         */
        name="coupon-template"
        value={arte.id}
        checked={marcada}
        onChange={onChange}
      />

      <span className="arte__cartao">
        {arte.image_url ? (
          <img
            className="arte__imagem"
            src={arte.image_url}
            /*
             * O `alt` NÃO REPETE O NOME que está escrito logo abaixo — seria o
             * mesmo texto duas vezes para quem escuta. Ele descreve o que a
             * imagem É: a arte que o cliente vai ver, com o valor impresso.
             */
            alt={`Arte da vitrine: ${desconto}`}
            loading="lazy"
          />
        ) : (
          /*
           * Arte sem imagem no bucket. `image_url` é anulável no contrato, e um
           * quadrado vazio faria a opção parecer não carregada — o nome e o
           * valor continuam sendo o que decide a escolha.
           */
          <span className="arte__sem-imagem" aria-hidden="true">
            <ImageIcon size={18} />
          </span>
        )}

        <span className="arte__nome t-body">{arte.name}</span>
        <span className="arte__valor t-aux">{textoDoQueDesconta(arte)}</span>
      </span>
    </label>
  );
}
