import './StatusChip.css';

/**
 * Contador.
 *
 *   <Badge value={12} />
 *   <Badge value={3} alerta />   // só a coluna Pendente usa
 *
 * Ele CONTA, não classifica: por isso não tem cor de status. O único realce é
 * o de "pendente", e por um motivo operacional — é a única coluna do quadro
 * cujo número vazio é bom e cujo número alto é um problema agora.
 *
 * O número vem com contexto para quem escuta a tela: "12 pedidos" e não "12".
 */
export function Badge({
  value,
  alerta = false,
  unidade = 'pedidos',
}: {
  value: number;
  alerta?: boolean;
  unidade?: string;
}) {
  return (
    <span className={`ds-badge${alerta && value > 0 ? ' ds-badge--alerta' : ''}`}>
      <span aria-hidden="true">{value}</span>
      <span className="sr-only">
        {value} {unidade}
      </span>
    </span>
  );
}
