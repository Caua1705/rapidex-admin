import { useEffect, useRef, useState } from 'react';

import { CheckIcon, CopyIcon } from './icons';
import { copiarTexto } from './copiar';
import { blocosDe } from './secret';
import './OneTimeSecret.css';

/**
 * Um segredo que existe UMA vez: mostrado para ser copiado e para ser DITADO.
 *
 *   <OneTimeSecret value={senha} label="Senha temporária" />
 *
 * Hoje o painel tem um só — a senha temporária que `POST /admin/users` e
 * `POST /admin/users/{id}/reset-password` devolvem. Ele mora no `ds/` mesmo
 * assim porque o que ele resolve não é da tela de Usuários: é como se mostra na
 * tela um valor que ninguém memoriza, que não volta a aparecer e que atravessa
 * um canal de voz.
 *
 * ----------------------------------------------------------------------------
 * TRÊS DECISÕES, E AS TRÊS SÃO SOBRE A VOZ
 * ----------------------------------------------------------------------------
 *
 * **1. Em blocos de cinco.** Vinte caracteres corridos não se ditam: quem lê
 * perde o lugar na terceira sílaba e quem anota não sabe onde parou. Os blocos
 * dão o compasso da fala ("XKMP7, depois..."), e são a mesma razão de o cartão
 * de crédito ser escrito em quatro grupos.
 *
 * **2. Um `<span>` por bloco, e o valor inteiro num campo escondido para o
 * leitor de tela.** Quatro pedaços visuais seriam quatro palavras faladas pelo
 * leitor de tela, com pausa entre elas — e a pausa é indistinguível de um
 * espaço que a senha não tem. O nome acessível carrega a senha inteira, e o
 * `aria-hidden` fica nos blocos.
 *
 * **3. Sem monoespaçada, e não por gosto.** `check-design-tokens.mjs` a barra
 * em todo o painel. O que a substitui: `tabular-nums` (largura igual por
 * caractere) mais `--senha-track`, o único espacejamento positivo do sistema.
 * O alfabeto do backend já fez a parte mais difícil — não há O/0 nem I/l/1 para
 * confundir, e não há minúscula.
 *
 * ----------------------------------------------------------------------------
 * O QUE ELE NÃO FAZ
 * ----------------------------------------------------------------------------
 *
 * Não esconde o valor atrás de um "mostrar", e não tem contagem regressiva. Os
 * dois são teatro aqui: o segredo está na tela porque alguém pediu para
 * cadastrar uma pessoa, e escondê-lo do próprio dono, na própria sala dele, só
 * acrescentaria um clique antes de ele fazer o que veio fazer. O que protege
 * esta senha é ela ser temporária e trocada no primeiro acesso.
 */
/**
 * As três formas do mesmo segredo, e o que decide entre elas é o CANAL.
 *
 * | forma     | canal                       | desenho                          |
 * | --------- | --------------------------- | -------------------------------- |
 * | `senha`   | a voz, 20 caracteres        | blocos de 5, espacejado, 26px    |
 * | `codigo`  | a voz, 6 dígitos            | dois grupos de 3, 28px, sem track |
 * | `link`    | a área de transferência     | uma linha, truncada, discreta    |
 *
 * Elas são variantes DESTE componente e não três componentes porque o que não
 * muda é o que custa caro: o valor inteiro no nome acessível, o botão de
 * copiar com os dois caminhos de `ds/copiar.ts`, e o `role="status"` que anuncia
 * a cópia para quem não vê o ícone trocar.
 *
 * **`link` NÃO É UM SEGREDO QUE SE DITA**, e é por isso que ele abandona tudo o
 * que este componente fazia por padrão. Uma URL em blocos de cinco vira
 * "https ://pe derap idex. com/e ntreg ador/" — o espacejamento que ajuda a
 * ditar uma senha destrói a única coisa que uma URL precisa ser na tela:
 * reconhecível de relance. Ninguém dita um link de sessenta caracteres; copia,
 * escaneia o QR, ou manda no WhatsApp.
 */
export type FormaDoSegredo = 'senha' | 'codigo' | 'link';

/** Quantos caracteres por bloco, por forma. `link` não agrupa. */
const BLOCO_DA_FORMA: Record<FormaDoSegredo, number> = {
  senha: 5,
  codigo: 3,
  link: 0,
};

export function OneTimeSecret({
  value,
  label,
  forma = 'senha',
  'data-testid': testId,
}: {
  value: string;
  /** O nome do segredo, para quem escuta a tela. */
  label: string;
  /** O canal por onde ele vai passar. Ver `FormaDoSegredo`. */
  forma?: FormaDoSegredo;
  'data-testid'?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  /* O "Copiado" volta a ser "Copiar" sozinho — mas não depois de o componente
     sair da tela, que é o vazamento clássico deste padrão. */
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * OS DOIS CAMINHOS DA CÓPIA MORAM EM `ds/copiar.ts`, e o porquê do segundo
   * está lá. O que ele custa AQUI: sem ele, o botão principal de um diálogo que
   * não deixa fechar sem copiar seria um botão que não faz nada, e a saída
   * seria gerar outra senha — matando a que a pessoa já recebeu.
   */
  async function copiar() {
    const deuCerto = await copiarTexto(value);
    if (!deuCerto) return;
    setCopiado(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopiado(false), 2400);
  }

  const tamanhoDoBloco = BLOCO_DA_FORMA[forma];

  return (
    <div className={`ds-segredo ds-segredo--${forma}`} data-testid={testId}>
      <p className="ds-segredo__valor" data-testid={testId ? `${testId}-valor` : undefined}>
        {/*
          O valor inteiro, sem os espaços dos blocos, é o que o leitor de tela
          anuncia. Os blocos visuais ficam `aria-hidden` logo abaixo.
        */}
        <span className="sr-only">
          {label}: {value}
        </span>
        {/*
          O LINK NÃO SE PARTE. Fora o estrago visual, cada bloco é um <span>, e
          o CSS que trunca em uma linha só precisa de UMA caixa de texto para
          medir — seis pedaços em linha não truncam, eles quebram.
        */}
        {tamanhoDoBloco === 0 ? (
          <span aria-hidden="true" className="ds-segredo__linha">
            {value}
          </span>
        ) : (
          <span aria-hidden="true" className="ds-segredo__blocos">
            {blocosDe(value, tamanhoDoBloco).map((bloco, indice) => (
              <span
                key={`${bloco}-${indice}`}
                className="ds-segredo__bloco"
                data-testid={testId ? `${testId}-bloco` : undefined}
              >
                {bloco}
              </span>
            ))}
          </span>
        )}
      </p>

      <button
        type="button"
        className="btn ds-segredo__copiar"
        onClick={() => void copiar()}
        data-testid={testId ? `${testId}-copiar` : undefined}
      >
        {copiado ? (
          <CheckIcon size={14} aria-hidden="true" />
        ) : (
          <CopyIcon size={14} aria-hidden="true" />
        )}
        {copiado ? 'Copiado' : 'Copiar'}
      </button>

      {/*
        O aviso de que copiou é anunciado, e não só pintado: quem opera por
        leitor de tela não vê o ícone trocar. `polite` porque isto confirma o
        que a pessoa acabou de fazer — não interrompe nada.
      */}
      <span className="sr-only" role="status">
        {copiado ? `${label} copiada.` : ''}
      </span>
    </div>
  );
}
