import PageHeader from "../components/PageHeader";

const sections = [
  {
    title: "1. Objeto de la plataforma",
    body:
      "Chocao es la plataforma digital oficial mediante la cual el Estado panameño subasta vehículos retenidos o aprehendidos, con el fin de garantizar un proceso público, transparente y auditable de disposición de bienes.",
  },
  {
    title: "2. Registro y acreditación de proponentes",
    body:
      "Para pujar, el usuario debe completar el proceso de acreditación: registrar un documento de identidad válido, aceptar el pliego de cargos y aprobar la verificación de identidad. Solo los usuarios con acreditación aprobada pueden emitir pujas; la cuenta es personal e intransferible, y el usuario es responsable de la confidencialidad de sus credenciales de acceso.",
  },
  {
    title: "3. Proceso de puja",
    body:
      "Las pujas se realizan sobre vehículos en estado activo y son vinculantes: al superar la oferta vigente, el participante se compromete a completar el pago si resulta adjudicado. Las subastas cierran automáticamente al vencer el plazo indicado en cada ficha del vehículo.",
  },
  {
    title: "4. Adjudicación y pago",
    body:
      "El vehículo se adjudica a la puja más alta al cierre de la subasta. El adjudicatario dispone de 5 días hábiles contados desde la fecha del acto para completar el pago en línea. Vencido ese plazo sin pago, el adjudicatario pierde el derecho sobre el bien y su cuenta queda suspendida por incumplimiento; el bien podrá ofrecerse al segundo mejor postor o declararse desierto, conforme a lo indicado en cada caso.",
  },
  {
    title: "5. Entrega del vehículo",
    body:
      "El vehículo se vende en el estado en que se encuentra, sin garantía de funcionamiento ni saneamiento por vicios ocultos. Confirmado el pago, se genera un contrato de compraventa y se agenda una cita de retiro en el depósito correspondiente. La entrega queda condicionada a una inspección con checklist fotográfico y a la validación del número de identificación vehicular (VIN); cualquier discrepancia bloquea la entrega hasta su revisión administrativa. Al retirar el vehículo se firma un acta de entrega que deja constancia de que dicha entrega es irreversible.",
  },
  {
    title: "6. Conducta del usuario",
    body:
      "Se prohíbe el uso de cuentas múltiples para manipular precios, la interferencia con el funcionamiento de la plataforma y cualquier intento de fraude. El incumplimiento puede resultar en la suspensión de la cuenta y la anulación de las pujas realizadas.",
  },
  {
    title: "7. Modificaciones",
    body:
      "Estos términos pueden actualizarse para reflejar cambios normativos o mejoras operativas. Se notificará cualquier cambio relevante a través de la plataforma con antelación razonable.",
  },
];

export default function TermsPage() {
  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 760, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Legal"
        title="Términos y condiciones"
        subtitle="Reglas de uso de la plataforma oficial de subastas de vehículos del Estado panameño."
      />

      {sections.map((s) => (
        <section key={s.title} style={{ marginBottom: "var(--sp-6)" }}>
          <h2 style={{ fontSize: "var(--t-lg)", marginBottom: "var(--sp-2)" }}>{s.title}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", lineHeight: 1.7 }}>{s.body}</p>
        </section>
      ))}
    </div>
  );
}
