import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/react";
import Button from "../components/Button";
import Card from "../components/Card";
import Countdown from "../components/Countdown";
import VehicleCard from "../components/VehicleCard";
import type { Vehicle } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80";

const steps = [
  { num: "01", title: "Regístrate", desc: "Crea tu cuenta verificada en menos de 2 minutos." },
  { num: "02", title: "Explora el catálogo", desc: "Revisa vehículos disponibles con su ficha técnica completa." },
  { num: "03", title: "Realiza tu puja", desc: "Oferta sobre vehículos en estado activo, supera la puja vigente." },
  { num: "04", title: "Adjudica y paga", desc: "Si ganas, completa el pago en línea y coordina la entrega." },
];

export default function Landing() {
  const { isSignedIn } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    axios.get(`${BASE_URL}/api/vehicles`)
      .then((r) => setVehicles(r.data))
      .catch(() => {});
  }, []);

  const heroVehicle = vehicles.find((v) => v.status === "active") || vehicles[0];

  const activeVehicles = vehicles.filter((v) => v.status === "active");
  const featuredVehicles = (activeVehicles.length > 0 ? activeVehicles : vehicles).slice(0, 4);

  const activos = vehicles.filter((v) => v.status === "active").length;
  const publicados = vehicles.filter((v) => v.status === "published").length;
  const cerrados = vehicles.filter((v) => v.status === "closed" || v.status === "awarded").length;
  const stats = [
    { value: activos, label: "Subastas activas" },
    { value: publicados, label: "Próximas subastas" },
    { value: cerrados, label: "Subastas concluidas" },
  ].filter((s) => s.value > 0);

  return (
    <div className="fade-in">
      {/* HERO */}
      <section className="section">
        <div className="container hero-grid">
          <div>
            <h1
              style={{
                fontSize: "var(--t-3xl)",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: "var(--sp-4)",
              }}
            >
              Subastas oficiales de vehículos{" "}
              <span style={{ color: "var(--primary)" }}>aprehendidos</span>
            </h1>

            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "var(--t-base)",
                maxWidth: 480,
                marginBottom: "var(--sp-5)",
                lineHeight: 1.6,
              }}
            >
              Plataforma digital del Estado para subastar vehículos retenidos, con proceso transparente,
              trazabilidad completa y participación abierta a la ciudadanía.
            </p>

            <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginBottom: "var(--sp-5)" }}>
              <Link to="/vehicles">
                <Button variant="primary" size="lg">Ver catálogo</Button>
              </Link>
              {!isSignedIn && (
                <Link to="/register">
                  <Button variant="secondary" size="lg">Crear cuenta</Button>
                </Link>
              )}
            </div>

            <div className="trust-line">
              <span>✓ Proceso transparente</span>
              <span>✓ Trazabilidad completa</span>
              <span>✓ Pago seguro</span>
            </div>
          </div>

          <div>
            {heroVehicle ? (
              <Link to={`/vehicles/${heroVehicle._id}`}>
                <Card variant="elevated" padding="lg" interactive>
                  <div
                    style={{
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                      height: 220,
                      marginBottom: "var(--sp-4)",
                    }}
                  >
                    <img
                      src={heroVehicle.images?.[0] || CAR_PLACEHOLDER}
                      alt={heroVehicle.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", marginBottom: 4 }}>
                    Vehículo destacado
                  </p>
                  <h3 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>
                    {heroVehicle.title} · {heroVehicle.year}
                  </h3>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Countdown endDate={heroVehicle.auctionEndDate} variant="compact" />
                    <p className="price-accent" style={{ fontSize: "var(--t-lg)" }}>
                      ${heroVehicle.currentPrice.toLocaleString()}
                    </p>
                  </div>
                </Card>
              </Link>
            ) : (
              <Card variant="elevated" padding="lg">
                <div
                  style={{
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    height: 220,
                    marginBottom: "var(--sp-4)",
                  }}
                >
                  <img
                    src={CAR_PLACEHOLDER}
                    alt="Vehículo destacado"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>
                  Sin subastas activas en este momento.
                </p>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* STATS */}
      {stats.length > 0 && (
        <section className="section-alt" style={{ padding: "var(--sp-6) 0" }}>
          <div className="container">
            <div className="stat-strip">
              {stats.map((s) => (
                <div className="stat-strip-item" key={s.label}>
                  <p className="stat-strip-value">{s.value}</p>
                  <p className="stat-strip-label">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CÓMO FUNCIONA */}
      <section className="section section-alt">
        <div className="container">
          <p className="eyebrow" style={{ marginBottom: "var(--sp-2)" }}>Proceso</p>
          <h2 className="section-title">Cómo funciona</h2>

          <div className="steps-row" style={{ marginTop: "var(--sp-6)" }}>
            {steps.map((s) => (
              <div key={s.num}>
                <div className="step-num">{s.num}</div>
                <h3 style={{ fontSize: "var(--t-md)", fontWeight: 600, marginBottom: "var(--sp-2)" }}>
                  {s.title}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", lineHeight: 1.5 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VEHÍCULOS DESTACADOS */}
      <section className="section">
        <div className="container">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "var(--sp-5)",
              flexWrap: "wrap",
              gap: "var(--sp-3)",
            }}
          >
            <div>
              <p className="eyebrow" style={{ marginBottom: "var(--sp-2)" }}>Catálogo</p>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Vehículos destacados</h2>
            </div>
            <Link to="/vehicles">
              <Button variant="ghost" size="sm">Ver todos →</Button>
            </Link>
          </div>

          {featuredVehicles.length === 0 ? (
            <p style={{ color: "var(--text-soft)", fontSize: "var(--t-sm)" }}>
              No hay vehículos disponibles por el momento.
            </p>
          ) : (
            <div className="grid-cards">
              {featuredVehicles.map((v) => <VehicleCard key={v._id} vehicle={v} />)}
            </div>
          )}
        </div>
      </section>

      {/* CTA FINAL */}
      {!isSignedIn && (
        <section className="section section-dark" style={{ textAlign: "center" }}>
          <div className="container">
            <h2 style={{ fontSize: "var(--t-2xl)", marginBottom: "var(--sp-3)" }}>¿Listo para participar?</h2>
            <p style={{ marginBottom: "var(--sp-5)", opacity: 0.85, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
              Regístrate gratuitamente y accede al catálogo completo de vehículos disponibles.
            </p>
            <Link to="/register">
              <Button variant="inverse" size="lg">Crear cuenta gratuita</Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
