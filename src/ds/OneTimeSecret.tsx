import { useEffect, useRef, useState } from 'react';

import { CheckIcon, CopyIcon } from './icons';
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
export function OneTimeSecret({
  value,
  label,
  'data-testid': testId,
}: {
  value: string;
  /** O nome do segredo, para quem escuta a tela. */
  label: string;
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
   * COPIAR TEM DOIS CAMINHOS, e o segundo não é zelo excessivo.
   *
   * `navigator.clipboard` exige contexto seguro e permissão; num painel aberto
   * por IP na rede da loja (`http://192.168.0.x`) ele simplesmente não existe.
   * Sem o segundo caminho, o botão principal de um diálogo que não deixa fechar
   * sem copiar seria um botão que não faz nada — e a saída seria gerar outra
   * senha, matando a que a pessoa já recebeu.
   *
   * O caminho velho (`execCommand`) é obsoleto de propósito: ele é o que
   * funciona onde o novo não existe.
   */
  async function copiar() {
    let deuCerto = false;
    try {
      await navigator.clipboard.writeText(value);
      deuCerto = true;
    } catch {
      deuCerto = copiarPeloDocumento(value);
    }

    if (!deuCerto) return;
    setCopiado(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopiado(false), 2400);
  }

  return (
    <div className="ds-segredo" data-testid={testId}>
      <p className="ds-segredo__valor">
        {/*
          O valor inteiro, sem os espaços dos blocos, é o que o leitor de tela
          anuncia. Os blocos visuais ficam `aria-hidden` logo abaixo.
        */}
        <span className="sr-only">
          {label}: {value}
        </span>
        <span aria-hidden="true" className="ds-segredo__blocos">
          {blocosDe(value).map((bloco, indice) => (
            <span key={`${bloco}-${indice}`} className="ds-segredo__bloco">
              {bloco}
            </span>
          ))}
        </span>
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

/**
 * A cópia onde `navigator.clipboard` não existe.
 *
 * O `<textarea>` fora da tela é o truque de sempre, e ele precisa estar no
 * documento e selecionado para o `execCommand` alcançá-lo. `readOnly` evita o
 * teclado virtual aparecer no telefone durante o instante em que ele existe.
 */
function copiarPeloDocumento(value: string): boolean {
  const area = document.createElement('textarea');
  area.value = value;
  area.readOnly = true;
  area.setAttribute('aria-hidden', 'true');
  /* Fora do alcance do olho e do dedo, sem sair da tela: um deslocamento em px
     seria valor solto (a régua de aderência barra), e um elemento colocado
     acima do topo faz o `select()` rolar a página em alguns navegadores. */
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
