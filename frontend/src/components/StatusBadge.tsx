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
};

export default function StatusBadge({ status, label }: Props) {
  return <span className={`badge badge-${status}`}>{label || labels[status] || status}</span>;
}
