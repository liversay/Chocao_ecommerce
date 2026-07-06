import PageHeader from "../components/PageHeader";

const sections = [
  {
    title: "1. Objeto de la plataforma",
    body:
      "Chocao es la plataforma digital oficial mediante la cual el Estado panameño subasta vehículos retenidos o aprehendidos, con el fin de garantizar un proceso público, transparente y auditable de disposición de bienes.",
  },
  {
    title: "2. Registro y elegibilidad",
    body:
      "Para participar en una subasta el usuario debe registrarse con datos verídicos y contar con mayoría de edad legal. La cuenta es personal e intransferible; el usuario es responsable de la confidencialidad de sus credenciales de acceso.",
  },
  {
    title: "3. Proceso de puja",
    body:
      "Las pujas se realizan sobre vehículos en estado activo y son vinculantes: al superar la oferta vigente, el participante se compromete a completar el pago si resulta adjudicado. Las subastas cierran automáticamente al vencer el plazo indicado en cada ficha del vehículo.",
  },
  {
    title: "4. Adjudicación y pago",
    body:
      "El vehículo se adjudica a la puja más alta al cierre de la subasta. El adjudicatario dispone de un plazo determinado para completar el pago en línea; de no hacerlo, la administración podrá ofrecer el bien a la siguiente mejor oferta o reabrir la subasta.",
  },
  {
    title: "5. Conducta del usuario",
    body:
      "Se prohíbe el uso de cuentas múltiples para manipular precios, la interferencia con el funcionamiento de la plataforma y cualquier intento de fraude. El incumplimiento puede resultar en la suspensión de la cuenta y la anulación de las pujas realizadas.",
  },
  {
    title: "6. Modificaciones",
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
