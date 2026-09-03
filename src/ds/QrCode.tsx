import qrcode from 'qrcode-generator';

/**
 * ============================================================================
 * O QR DE UM ENDEREÇO — desenhado aqui, e não buscado fora
 * ============================================================================
 *
 * A PRIMEIRA IDEIA ERA UM SERVIÇO DE IMAGEM, e ela está PROIBIDA neste
 * arquivo: `api.qrserver.com/...?data=<link>` mandaria o token de acesso do
 * motoboy para um terceiro, num par que sai uma vez só e abre a operação da
 * loja. É vazamento de segredo disfarçado de conveniência, e a CSP do painel
 * (`connect-src 'self' https://api.pederapidex.com`) já o barraria — mas a
 * razão de não fazer não é a CSP, é o que o link significa.
 *
 * ELE É SVG DE VERDADE, e não `dangerouslySetInnerHTML` nem `data:` URI. A
 * biblioteca sabe dizer quais módulos são escuros (`isDark`), então os
 * quadrados saem como elementos React — sem HTML solto atravessando a
 * aplicação, e sem depender do `img-src data:` da CSP.
 *
 * ----------------------------------------------------------------------------
 * A MARGEM É PARTE DO CÓDIGO, NÃO ESPAÇAMENTO
 * ----------------------------------------------------------------------------
 *
 * A norma pede uma faixa clara de 4 módulos em volta (a "zona quieta"): sem
 * ela, a câmera não acha onde o código começa e o QR simplesmente não lê,
 * encostado noutro elemento. Ela entra no `viewBox`, e não como `padding` —
 * `padding` some quando alguém põe o componente dentro de uma caixa apertada.
 *
 * O nível de correção é o M (~15%): é o padrão para código impresso ou lido de
 * uma tela, e o que sobra de tolerância cobre o dedo na tela do balcão.
 */

/** A faixa clara em volta, em módulos. Ver o cabeçalho — ela não é margem. */
const ZONA_QUIETA = 4;

export function QrCode({
  value,
  /** O que o leitor de tela lê. O QR é imagem de um endereço que já está escrito. */
  label,
  size = 180,
  'data-testid': testId,
}: {
  value: string;
  label: string;
  size?: number;
  'data-testid'?: string;
}) {
  /*
   * Tipo 0 = "escolha o menor que couber". Fixar um tipo faria um link mais
   * comprido (um token maior, um domínio maior) estourar em silêncio.
   */
  const codigo = qrcode(0, 'M');
  codigo.addData(value);
  codigo.make();

  const modulos = codigo.getModuleCount();
  const lado = modulos + ZONA_QUIETA * 2;

  const escuros: string[] = [];
  for (let linha = 0; linha < modulos; linha += 1) {
    for (let coluna = 0; coluna < modulos; coluna += 1) {
      if (codigo.isDark(linha, coluna)) {
        escuros.push(`M${coluna + ZONA_QUIETA} ${linha + ZONA_QUIETA}h1v1h-1z`);
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${lado} ${lado}`}
      role="img"
      aria-label={label}
      data-testid={testId}
      className="qr"
    >
      {/*
        O FUNDO CLARO É EXPLÍCITO, e não herdado. No tema escuro, um QR de
        traços escuros sobre a parede escura não tem contraste nenhum para a
        câmera — e o leitor de código não sabe de tema. As duas cores são fixas
        pela mesma razão que a comanda é monoespaçada: o que vale aqui é o que
        a máquina do outro lado consegue ler.
      */}
      <rect width={lado} height={lado} fill="var(--qr-fundo)" />
      <path d={escuros.join('')} fill="var(--qr-tinta)" />
    </svg>
  );
}
