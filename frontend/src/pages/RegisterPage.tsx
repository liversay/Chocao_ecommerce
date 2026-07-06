import { SignUp, useAuth, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import EmailOtpForm from "../components/EmailOtpForm";
import AuthMethodTabs from "../components/AuthMethodTabs";
import Logo from "../components/Logo";
import Card from "../components/Card";

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
            Crear cuenta
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", textAlign: "center", marginBottom: "var(--sp-5)" }}>
            Es gratis y solo toma un minuto
          </p>

          <AuthMethodTabs active={method} onChange={setMethod} />

          {method === "otp" ? (
            <EmailOtpForm mode="sign-up" redirectTo="/vehicles" />
          ) : (
            <SignUp
              routing="path"
              path="/register"
              signInUrl="/login"
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
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Iniciar sesión
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
