import PageHeader from "../components/PageHeader";

const sections = [
  {
    title: "1. Datos que recopilamos",
    body:
      "Recopilamos datos de identificación (nombre, correo electrónico, número de documento de identidad), información de contacto y el historial de pujas y pagos asociado a cada cuenta. Durante el proceso de acreditación se recopila además el documento de identidad presentado y el resultado de su verificación. Durante el proceso de entrega, el custodio registra fotografías del vehículo (incluyendo VIN, odómetro y estado de carrocería), su geolocalización y el inventario entregado.",
  },
  {
    title: "2. Finalidad del tratamiento",
    body:
      "Los datos se utilizan para gestionar el registro y la acreditación de usuarios, validar la elegibilidad para pujar, procesar pagos, generar el contrato de compraventa y el acta de entrega, y notificar el estado de las subastas, pagos y entregas en las que el usuario participa.",
  },
  {
    title: "3. Base legal",
    body:
      "El tratamiento se fundamenta en el consentimiento otorgado al momento del registro y en el cumplimiento de las obligaciones legales que rigen la disposición de bienes retenidos por el Estado.",
  },
  {
    title: "4. Compartición de datos",
    body:
      "No compartimos datos personales con terceros salvo cuando sea estrictamente necesario para procesar pagos a través de proveedores certificados, o cuando lo exija una autoridad competente.",
  },
  {
    title: "5. Seguridad de la información",
    body:
      "Aplicamos medidas técnicas y organizativas razonables para proteger los datos contra accesos no autorizados, pérdida o alteración, incluyendo cifrado en tránsito y control de acceso por roles. Los documentos de identidad y las fotografías de inspección solo son accesibles para los roles autorizados (administración y custodios), y cada acceso queda registrado en el rastro de auditoría.",
  },
  {
    title: "6. Retención de registros",
    body:
      "El rastro de auditoría, los contratos de compraventa y las actas de entrega se conservan de forma inmutable durante todo el proceso judicial asociado al bien, que puede extenderse más allá de la fecha de la entrega.",
  },
  {
    title: "7. Derechos del usuario",
    body:
      "El usuario puede solicitar en cualquier momento el acceso, la rectificación o la eliminación de sus datos personales, escribiendo a los canales de contacto indicados en la plataforma.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 760, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Legal"
        title="Política de privacidad"
        subtitle="Cómo recopilamos, usamos y protegemos los datos personales de los usuarios de la plataforma."
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
