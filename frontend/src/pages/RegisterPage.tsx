import { SignUp, useAuth, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import EmailOtpForm from "../components/EmailOtpForm";
import AuthMethodTabs from "../components/AuthMethodTabs";
import Logo from "../components/Logo";

export default function RegisterPage() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const api = useApi();
  const [method, setMethod] = useState<"otp" | "password">("otp");

  useEffect(() => {
    if (isSignedIn && user) {
      const name =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.emailAddresses[0]?.emailAddress ||
        "Usuario";
      const email = user.emailAddresses[0]?.emailAddress || "";

      api.post("/api/users/sync", { clerkId: user.id, name, email })
        .catch(() => {})
        .finally(() => navigate("/vehicles"));
    }
  }, [isSignedIn, user]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "calc(100vh - 72px)",
        background: "var(--bg)",
      }}
    >
      {/* Left: branded panel */}
      <div
        style={{
          background: "var(--bg-deep)",
          padding: "var(--sp-7)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "var(--sp-7)" }}>
          <Logo size={44} />
          <span style={{ fontWeight: 800, fontSize: "var(--t-md)", color: "var(--text)", letterSpacing: "-0.02em" }}>
            Chocao
          </span>
        </Link>

        <h1 style={{ fontSize: "var(--t-2xl)", color: "var(--text)", marginBottom: "var(--sp-4)", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
          Únete a Chocao
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--t-md)", lineHeight: 1.6, maxWidth: 380, marginBottom: "var(--sp-6)" }}>
          Crea tu cuenta gratuita y obtén acceso al catálogo completo de subastas oficiales
          del Estado panameño.
        </p>

        <ul style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", listStyle: "none", padding: 0 }}>
          {[
            "Acceso a todo el catálogo de vehículos",
            "Participación en subastas activas",
            "Notificaciones de pujas y adjudicaciones",
            "Pagos seguros con respaldo institucional",
          ].map((item) => (
            <li key={item} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "var(--t-sm)", color: "var(--text)" }}>
              <span style={{
                width: 22, height: 22,
                borderRadius: "50%",
                background: "var(--success-soft)",
                color: "var(--success)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", fontWeight: 700,
                flexShrink: 0,
              }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Right: auth form */}
      <div style={{ padding: "var(--sp-7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <h2 style={{ fontSize: "var(--t-lg)", marginBottom: "var(--sp-2)", color: "var(--text)" }}>
            Crear cuenta
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)" }}>
            Es gratis y solo toma un minuto
          </p>

          <AuthMethodTabs active={method} onChange={setMethod} />

          {method === "otp" ? (
            <div
              style={{
                background: "var(--surface)",
                boxShadow: "var(--nm-out-md)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--sp-5)",
              }}
            >
              <EmailOtpForm mode="sign-up" redirectTo="/vehicles" />
            </div>
          ) : (
            <SignUp
              routing="path"
              path="/register"
              signInUrl="/login"
              fallbackRedirectUrl="/vehicles"
              appearance={{
                variables: {
                  colorPrimary: "#1e3a8a",
                  colorBackground: "#edf1f6",
                  colorText: "#2a3340",
                  colorTextSecondary: "#5a6878",
                  colorInputBackground: "#edf1f6",
                  colorInputText: "#2a3340",
                  borderRadius: "14px",
                  fontFamily: "Inter, sans-serif",
                },
                elements: {
                  rootBox: { width: "100%" },
                  card: {
                    background: "var(--surface)",
                    boxShadow: "var(--nm-out-md)",
                    border: "none",
                    borderRadius: "var(--radius-lg)",
                  },
                  headerTitle: { display: "none" },
                  headerSubtitle: { display: "none" },
                  formButtonPrimary: {
                    background: "var(--primary)",
                    boxShadow: "var(--nm-out-sm)",
                    border: "none",
                    fontWeight: 600,
                    textTransform: "none",
                  },
                  formFieldInput: {
                    background: "var(--surface)",
                    boxShadow: "var(--nm-in-sm)",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                  },
                  socialButtonsBlockButton: {
                    background: "var(--surface)",
                    boxShadow: "var(--nm-out-sm)",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                  },
                  footer: { background: "transparent" },
                },
              }}
            />
          )}

          <p style={{
            textAlign: "center",
            marginTop: "var(--sp-4)",
            fontSize: "var(--t-sm)",
            color: "var(--text-muted)",
          }}>
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
