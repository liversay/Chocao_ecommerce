import { SignIn, useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import EmailOtpForm from "../components/EmailOtpForm";
import AuthMethodTabs from "../components/AuthMethodTabs";
import Logo from "../components/Logo";

export default function LoginPage() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState<"otp" | "password">("otp");

  useEffect(() => {
    if (isSignedIn) navigate("/vehicles");
  }, [isSignedIn]);

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
          position: "relative",
        }}
      >
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "var(--sp-7)" }}>
          <Logo size={44} />
          <span style={{ fontWeight: 800, fontSize: "var(--t-md)", color: "var(--text)", letterSpacing: "-0.02em" }}>
            Chocao
          </span>
        </Link>

        <h1 style={{ fontSize: "var(--t-2xl)", color: "var(--text)", marginBottom: "var(--sp-4)", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
          Bienvenido de vuelta
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--t-md)", lineHeight: 1.6, maxWidth: 380, marginBottom: "var(--sp-6)" }}>
          Accede a tu cuenta para ver el catálogo de vehículos, gestionar tus pujas
          y completar pagos de subastas adjudicadas.
        </p>

        <div style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--nm-out-sm)",
          padding: "var(--sp-4)",
          display: "flex",
          gap: "var(--sp-3)",
          alignItems: "center",
          maxWidth: 400,
        }}>
          <div style={{
            width: 40, height: 40,
            borderRadius: "var(--radius-sm)",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem", fontWeight: 700,
          }}>🔒</div>
          <div>
            <p style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--text)" }}>
              Autenticación segura
            </p>
            <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>
              Inicia sesión sin contraseña con código por email.
            </p>
          </div>
        </div>
      </div>

      {/* Right: auth form */}
      <div style={{ padding: "var(--sp-7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <h2 style={{ fontSize: "var(--t-lg)", marginBottom: "var(--sp-2)", color: "var(--text)" }}>
            Iniciar sesión
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)" }}>
            Elige tu método preferido para continuar
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
              <EmailOtpForm mode="sign-in" redirectTo="/vehicles" />
            </div>
          ) : (
            <SignIn
              routing="path"
              path="/login"
              signUpUrl="/register"
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
            ¿No tienes cuenta?{" "}
            <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
