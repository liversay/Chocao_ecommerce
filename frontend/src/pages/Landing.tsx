import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import GlassButton from "../components/GlassButton";
import GlassCard from "../components/GlassCard";
import VehicleCard from "../components/VehicleCard";
import type { Vehicle } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const benefits = [
  {
    icon: "⚖",
    title: "Transparencia institucional",
    desc: "Cada subasta queda registrada en una bitácora pública con trazabilidad completa de las pujas.",
  },
  {
    icon: "🛡",
    title: "Seguridad y control",
    desc: "Autenticación verificada y validaciones automáticas que garantizan integridad en el proceso.",
  },
  {
    icon: "👥",
    title: "Participación ciudadana",
    desc: "Igualdad de oportunidades — cualquier ciudadano puede registrarse y participar desde su navegador.",
  },
  {
    icon: "⚡",
    title: "Eficiencia administrativa",
    desc: "Automatiza el ciclo desde la publicación hasta la adjudicación, reduciendo costos operativos.",
  },
];

const steps = [
  { num: "01", title: "Regístrate", desc: "Crea tu cuenta verificada en menos de 2 minutos." },
  { num: "02", title: "Explora el catálogo", desc: "Revisa vehículos disponibles con su ficha técnica completa." },
  { num: "03", title: "Realiza tu puja", desc: "Oferta sobre vehículos en estado activo, supera la puja vigente." },
  { num: "04", title: "Adjudica y paga", desc: "Si ganas, completa el pago en línea y coordina la entrega." },
];

export default function Landing() {
  const [featured, setFeatured] = useState<Vehicle[]>([]);

  useEffect(() => {
    axios.get(`${BASE_URL}/api/vehicles?status=active`)
      .then((r) => setFeatured(r.data.slice(0, 4)))
      .catch(() => {});
  }, []);

  return (
    <div className="fade-in">
      {/* HERO */}
      <section style={{ padding: "var(--sp-7) 0 var(--sp-6)" }}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "var(--sp-7)", alignItems: "center" }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--surface)",
                boxShadow: "var(--nm-out-sm)",
                borderRadius: "var(--radius-pill)",
                padding: "6px 16px",
                fontSize: "var(--t-xs)",
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "var(--sp-5)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
              República de Panamá · Subasta pública
            </div>

            <h1
              style={{
                fontSize: "clamp(2.2rem, 4.8vw, 3.6rem)",
                fontWeight: 800,
                color: "var(--text)",
                letterSpacing: "-0.035em",
                lineHeight: 1.05,
                marginBottom: "var(--sp-4)",
              }}
            >
              Subastas oficiales<br />
              de vehículos<br />
              <span style={{ color: "var(--primary)" }}>aprehendidos</span>
            </h1>

            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-md)", maxWidth: 480, marginBottom: "var(--sp-6)", lineHeight: 1.6 }}>
              Plataforma digital del Estado para subastar vehículos retenidos, con proceso transparente,
              trazabilidad completa y participación abierta a la ciudadanía.
            </p>

            <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
              <Link to="/vehicles">
                <GlassButton size="lg" variant="primary">Ver catálogo →</GlassButton>
              </Link>
              <Link to="/register">
                <GlassButton size="lg" variant="ghost">Crear cuenta</GlassButton>
              </Link>
            </div>

            {/* Stats */}
            <div
              style={{
                marginTop: "var(--sp-7)",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "var(--sp-4)",
              }}
            >
              {[
                { v: "50+", l: "Vehículos activos" },
                { v: "200+", l: "Subastas cerradas" },
                { v: "1,200+", l: "Usuarios registrados" },
              ].map((s) => (
                <div key={s.l}>
                  <p style={{ fontSize: "var(--t-2xl)", fontWeight: 800, color: "var(--primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                    {s.v}
                  </p>
                  <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 6, fontWeight: 500 }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Visual panel */}
          <div style={{ position: "relative", padding: "var(--sp-5)" }}>
            {featured[0] ? (
              <Link to={`/vehicles/${featured[0]._id}`}>
                <GlassCard padding="lg" interactive style={{ position: "relative" }}>
                  <div
                    style={{
                      background: "var(--bg-deep)",
                      borderRadius: "var(--radius-md)",
                      boxShadow: "var(--nm-in-sm)",
                      height: 240,
                      overflow: "hidden",
                      marginBottom: "var(--sp-4)",
                    }}
                  >
                    <img
                      src={featured[0].images?.[0] || "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80"}
                      alt={featured[0].title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                        Vehículo destacado
                      </p>
                      <p style={{ fontSize: "var(--t-md)", fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                        {featured[0].title} · {featured[0].year}
                      </p>
                    </div>
                    <span className="badge badge-active">Subasta activa</span>
                  </div>
                </GlassCard>
              </Link>
            ) : (
              <GlassCard padding="lg">
                <div
                  style={{
                    background: "var(--bg-deep)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--nm-in-sm)",
                    height: 240,
                    overflow: "hidden",
                    marginBottom: "var(--sp-4)",
                  }}
                >
                  <img
                    src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80"
                    alt="Vehículo destacado"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                  Sin subastas activas en este momento.
                </p>
              </GlassCard>
            )}

            {featured[0] && (
              <div
                style={{
                  position: "absolute",
                  bottom: -10,
                  left: -20,
                  background: "var(--surface)",
                  boxShadow: "var(--nm-out-md)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--sp-3) var(--sp-4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--success-soft)", color: "var(--success)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "var(--t-sm)",
                  }}
                >
                  ✓
                </div>
                <div>
                  <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>Oferta actual</p>
                  <p style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--text)" }}>
                    ${featured[0].currentPrice.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section style={{ padding: "var(--sp-7) 0", background: "var(--bg-deep)" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "var(--sp-6)" }}>
            <p style={{ fontSize: "var(--t-xs)", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--sp-2)" }}>
              Modernización del Estado
            </p>
            <h2 style={{ fontSize: "var(--t-2xl)", marginBottom: "var(--sp-3)", color: "var(--text)" }}>
              Una plataforma diseñada para servir
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-base)", maxWidth: 580, margin: "0 auto" }}>
              Chocao redefine cómo el Estado gestiona la disposición de bienes aprehendidos,
              priorizando la transparencia y la accesibilidad ciudadana.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "var(--sp-4)",
            }}
          >
            {benefits.map((b) => (
              <div
                key={b.title}
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--nm-out-sm)",
                  padding: "var(--sp-5)",
                }}
              >
                <div
                  style={{
                    width: 48, height: 48,
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                    boxShadow: "var(--nm-in-sm)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem",
                    color: "var(--primary)",
                    marginBottom: "var(--sp-3)",
                  }}
                >
                  {b.icon}
                </div>
                <h3 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-2)", color: "var(--text)" }}>
                  {b.title}
                </h3>
                <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED VEHICLES */}
      <section style={{ padding: "var(--sp-7) 0" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--sp-6)", flexWrap: "wrap", gap: "var(--sp-3)" }}>
            <div>
              <p style={{ fontSize: "var(--t-xs)", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--sp-2)" }}>
                Catálogo
              </p>
              <h2 style={{ fontSize: "var(--t-2xl)", color: "var(--text)" }}>Vehículos destacados</h2>
            </div>
            <Link to="/vehicles">
              <GlassButton variant="ghost" size="sm">Ver todos →</GlassButton>
            </Link>
          </div>

          {featured.length === 0 ? (
            <div style={{
              padding: "var(--sp-7)",
              textAlign: "center",
              background: "var(--surface)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--nm-in-sm)",
              color: "var(--text-soft)",
            }}>
              No hay vehículos en subasta activa por el momento.
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--sp-4)",
            }}>
              {featured.map((v) => <VehicleCard key={v._id} vehicle={v} />)}
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "var(--sp-7) 0", background: "var(--bg-deep)" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "var(--sp-6)" }}>
            <p style={{ fontSize: "var(--t-xs)", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--sp-2)" }}>
              Proceso
            </p>
            <h2 style={{ fontSize: "var(--t-2xl)", color: "var(--text)" }}>Cómo funciona</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-4)" }}>
            {steps.map((s, i) => (
              <div key={s.num} style={{ position: "relative" }}>
                <div
                  style={{
                    background: "var(--surface)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--nm-out-sm)",
                    padding: "var(--sp-5)",
                  }}
                >
                  <p style={{
                    fontSize: "var(--t-3xl)",
                    fontWeight: 800,
                    color: "var(--bg-deep)",
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                    marginBottom: "var(--sp-3)",
                    WebkitTextStroke: "1px var(--primary-soft)",
                  }}>
                    {s.num}
                  </p>
                  <h3 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-2)", color: "var(--text)" }}>{s.title}</h3>
                  <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", lineHeight: 1.5 }}>{s.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    right: -16,
                    color: "var(--text-soft)",
                    fontSize: "1.5rem",
                    display: "none",
                  }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "var(--sp-7) 0" }}>
        <div className="container">
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--nm-out-lg)",
              padding: "var(--sp-7)",
              textAlign: "center",
              maxWidth: 700,
              margin: "0 auto",
            }}
          >
            <h2 style={{ fontSize: "var(--t-xl)", marginBottom: "var(--sp-3)", color: "var(--text)" }}>
              ¿Listo para participar?
            </h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "var(--sp-5)", fontSize: "var(--t-base)" }}>
              Regístrate gratuitamente y accede al catálogo completo de vehículos disponibles.
            </p>
            <Link to="/register">
              <GlassButton size="lg" variant="accent">Crear cuenta gratuita</GlassButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
