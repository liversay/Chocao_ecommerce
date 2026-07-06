import PageHeader from "../components/PageHeader";
import Card from "../components/Card";

const contactCards = [
  {
    title: "Dirección institucional",
    lines: ["Edificio Dirección General de Aduanas", "Vía España, Ciudad de Panamá", "Panamá, República de Panamá"],
  },
  {
    title: "Correo electrónico",
    lines: ["subastas@chocao.gob.pa", "soporte@chocao.gob.pa"],
  },
  {
    title: "Teléfono",
    lines: ["+507 500-3000", "+507 500-3001 (soporte técnico)"],
  },
  {
    title: "Horario de atención",
    lines: ["Lunes a viernes: 8:00 a.m. – 4:00 p.m.", "Cerrado sábados, domingos y feriados nacionales"],
  },
];

export default function ContactPage() {
  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 760, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Soporte"
        title="Contacto"
        subtitle="Canales oficiales para consultas sobre el proceso de subastas, pagos o soporte de la plataforma."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--sp-4)",
        }}
      >
        {contactCards.map((c) => (
          <Card key={c.title} padding="md">
            <h2 style={{ fontSize: "var(--t-sm)", fontWeight: 700, marginBottom: "var(--sp-2)" }}>{c.title}</h2>
            {c.lines.map((line) => (
              <p key={line} style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
                {line}
              </p>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
