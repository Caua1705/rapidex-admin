/**
 * Marca do Rapidex.
 *
 * O painel NÃO é white-label: quem opera precisa saber que está no Rapidex, e
 * o suporte é do Rapidex. O nome do restaurante aparece ao lado, como dado, e
 * nunca substitui a marca.
 */
export function RapidexLogo({ size = 22 }: { size?: number }) {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
      aria-label="Rapidex"
      role="img"
    >
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--rapidex-red)" />
        <path d="M18.5 5 9 18h5.5L13 27l10-13.5h-6L18.5 5Z" fill="#fff" />
      </svg>
      <strong style={{ fontSize: size * 0.66, letterSpacing: '-0.02em' }}>Rapidex</strong>
    </span>
  );
}
