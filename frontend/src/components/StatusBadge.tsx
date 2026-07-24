interface Props {
  status: string;
  label?: string;
}

const labels: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  active: "Activo",
  closed: "Cerrado",
  awarded: "Adjudicado",
  winner: "Ganador",
  outbid: "Superado",
  pending: "Pendiente",
  paid: "Pagado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  ADJUDICADA_PENDIENTE_PAGO: "Pendiente de pago",
  PAGADA: "Pagada",
  INCUMPLIDA: "Incumplida",
  OFERTA_A_SEGUNDO: "Oferta al segundo postor",
  DESIERTO_POR_INCUMPLIMIENTO: "Desierto por incumplimiento",
};

export default function StatusBadge({ status, label }: Props) {
  return <span className={`badge badge-${status}`}>{label || labels[status] || status}</span>;
}
