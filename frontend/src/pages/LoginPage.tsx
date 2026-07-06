import { SignIn, useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import EmailOtpForm from "../components/EmailOtpForm";
import AuthMethodTabs from "../components/AuthMethodTabs";
import Logo from "../components/Logo";
import Card from "../components/Card";

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
        minHeight: "calc(100vh - 72px)",
        background: "var(--bg-alt)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-6) var(--sp-5)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <Card variant="elevated" padding="lg">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--sp-4)" }}>
            <Logo size={40} />
          </div>

          <h1 style={{ fontSize: "var(--t-xl)", textAlign: "center", marginBottom: "var(--sp-1)" }}>
            Iniciar sesión
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", textAlign: "center", marginBottom: "var(--sp-5)" }}>
            Accede a tu cuenta para ver el catálogo, gestionar tus pujas y completar pagos.
          </p>

          <AuthMethodTabs active={method} onChange={setMethod} />

          {method === "otp" ? (
            <EmailOtpForm mode="sign-in" redirectTo="/vehicles" />
          ) : (
            <SignIn
              routing="path"
              path="/login"
              signUpUrl="/register"
              fallbackRedirectUrl="/vehicles"
              appearance={{
                variables: {
                  colorPrimary: "#1e3a8a",
                  colorBackground: "#ffffff",
                  colorText: "#1a2233",
                  colorTextSecondary: "#5a6878",
                  colorInputBackground: "#ffffff",
                  colorInputText: "#1a2233",
                  borderRadius: "10px",
                  fontFamily: "Inter, sans-serif",
                },
                elements: {
                  rootBox: { width: "100%" },
                  card: {
                    background: "transparent",
                    border: "none",
                    boxShadow: "none",
                    padding: 0,
                  },
                  headerTitle: { display: "none" },
                  headerSubtitle: { display: "none" },
                  formButtonPrimary: {
                    background: "var(--primary)",
                    border: "none",
                    boxShadow: "none",
                    fontWeight: 600,
                    textTransform: "none",
                    borderRadius: "var(--radius-sm)",
                  },
                  formFieldInput: {
                    background: "var(--surface)",
                    border: "1px solid var(--border-strong)",
                    boxShadow: "none",
                    borderRadius: "var(--radius-sm)",
                  },
                  socialButtonsBlockButton: {
                    background: "var(--surface)",
                    border: "1px solid var(--border-strong)",
                    boxShadow: "none",
                    borderRadius: "var(--radius-sm)",
                  },
                  footer: { background: "transparent" },
                },
              }}
            />
          )}

          <p style={{
            textAlign: "center",
            marginTop: "var(--sp-5)",
            fontSize: "var(--t-sm)",
            color: "var(--text-muted)",
          }}>
            ¿No tienes cuenta?{" "}
            <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Crear cuenta
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
