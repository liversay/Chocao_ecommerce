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
                  borderRadius: "6px",
                  fontFamily: "Inter, system-ui, sans-serif",
                },
                elements: {
                  rootBox: { width: "100%" },
                  cardBox: {
                    boxShadow: "none",
                    border: "none",
                    width: "100%",
                  },
                  card: {
                    background: "transparent",
                    border: "none",
                    boxShadow: "none",
                    width: "100%",
                    padding: 0,
                  },
                  logoBox: { display: "none" },
                  logoImage: { display: "none" },
                  header: { display: "none" },
                  headerTitle: { display: "none" },
                  headerSubtitle: { display: "none" },
                  formButtonPrimary: {
                    background: "#1e3a8a",
                    backgroundImage: "none",
                    border: "none",
                    boxShadow: "none",
                    fontWeight: 600,
                    textTransform: "none",
                    borderRadius: "6px",
                    "&:hover": { background: "#172e70" },
                    "&:focus": { boxShadow: "none" },
                  },
                  formFieldInput: {
                    background: "#ffffff",
                    border: "1px solid #c9d2dd",
                    boxShadow: "none",
                    borderRadius: "6px",
                    "&:focus": {
                      border: "1px solid #1e3a8a",
                      boxShadow: "0 0 0 3px rgba(30, 58, 138, 0.12)",
                    },
                  },
                  socialButtonsBlockButton: {
                    background: "#ffffff",
                    border: "1px solid #c9d2dd",
                    boxShadow: "none",
                    borderRadius: "6px",
                  },
                  footer: { background: "transparent" },
                  footerActionText: { color: "#5a6878" },
                  footerActionLink: { color: "#1e3a8a", fontWeight: 600 },
                  footerPagesLink: { color: "#1e3a8a" },
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
