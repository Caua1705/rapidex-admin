import './RapidexLogo.css';

/**
 * Marca do Rapidex.
 *
 * O painel NÃO é white-label: quem opera precisa saber que está no Rapidex, e
 * o suporte é do Rapidex. O nome do restaurante aparece ao lado, como dado, e
 * nunca substitui a marca.
 *
 * O selo é o único asset de marca que existe (`public/logo-mark.png`), e ele
 * vem com fundo preto embutido. Não há wordmark nem versão monocromática — por
 * isso o nome é texto ao lado, e o selo aparece como ladrilho arredondado nos
 * dois temas em vez de ser recolorido.
 */
export function RapidexLogo({
  size = 24,
  showWordmark = true,
}: {
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <span className="logo" aria-label="Rapidex" role="img">
      <img
        className="logo__mark"
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
      {showWordmark ? <strong className="logo__wordmark">Rapidex</strong> : null}
    </span>
  );
}
