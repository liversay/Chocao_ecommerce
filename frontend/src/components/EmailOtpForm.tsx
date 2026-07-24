import { useState, useRef, useEffect } from "react";
import { useClerk } from "@clerk/react";
import { useNavigate } from "react-router";
import Button from "./Button";
import Input from "./Input";

interface Props {
  mode: "sign-in" | "sign-up";
  redirectTo?: string;
}

type Step = "email" | "code";

/**
 * Headless email + OTP code flow using Clerk's underlying client.
 * Uses `useClerk().client.signIn` / `signUp` to access the traditional
 * resource API (create, prepare*, attempt*) which is more flexible than
 * the new signal-based useSignIn/useSignUp hooks in @clerk/react v6.
 */
export default function EmailOtpForm({ mode, redirectTo = "/vehicles" }: Props) {
  const navigate = useNavigate();
  const clerk = useClerk();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  function getErrorMessage(err: unknown): string {
    const e = err as { errors?: { code?: string; message?: string; longMessage?: string }[] };
    const code = e?.errors?.[0]?.code;
    const messages: Record<string, string> = {
      form_identifier_not_found: "No encontramos una cuenta con ese correo.",
      form_identifier_exists: "Ya existe una cuenta con ese correo.",
      form_code_incorrect: "El código ingresado es incorrecto.",
      form_param_format_invalid: "El formato del correo no es válido.",
      form_param_value_invalid: "Uno de los datos ingresados no es válido.",
      session_exists: "Ya tienes una sesión activa.",
      signup_rate_limit_exceeded: "Demasiados intentos. Espera un momento antes de volver a intentar.",
      user_locked: "Tu cuenta fue bloqueada temporalmente por demasiados intentos. Intenta más tarde.",
      captcha_invalid: "No pudimos verificar que eres una persona. Actualiza la página e intenta nuevamente.",
      not_allowed_to_sign_up: "Este correo no tiene permitido registrarse.",
    };
    return (code && messages[code]) || "Algo salió mal. Intenta nuevamente.";
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!clerk?.client) {
      setError("Clerk aún no está listo. Espera un momento.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      if (mode === "sign-in") {
        const signIn = clerk.client.signIn;
        const result = await signIn.create({ identifier: email });
        const emailFactor = result.supportedFirstFactors?.find(
          (f: { strategy: string }) => f.strategy === "email_code"
        );
        if (!emailFactor) throw new Error("Esta cuenta no soporta inicio con código por email.");
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: (emailFactor as { emailAddressId: string }).emailAddressId,
        });
      } else {
        const signUp = clerk.client.signUp;
        await signUp.create({
          emailAddress: email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      }
      setStep("code");
      setResendCooldown(30);
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!clerk?.client) return;
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Ingresa el código completo de 6 dígitos");
      return;
    }
    setError("");
    setLoading(true);

    try {
      if (mode === "sign-in") {
        const result = await clerk.client.signIn.attemptFirstFactor({
          strategy: "email_code",
          code: fullCode,
        });
        if (result.status === "complete") {
          await clerk.setActive({ session: result.createdSessionId });
          navigate(redirectTo);
          return;
        }
        setError("No pudimos iniciar sesión. Intenta nuevamente.");
      } else {
        const result = await clerk.client.signUp.attemptEmailAddressVerification({ code: fullCode });

        if (result.status === "complete") {
          await clerk.setActive({ session: result.createdSessionId });
          navigate(redirectTo);
          return;
        }

        if (result.status === "missing_requirements") {
          setError(
            "Tu cuenta requiere información adicional. Por favor usa el método con contraseña para completar tu registro."
          );
          return;
        }

        setError("No pudimos completar el registro. Intenta nuevamente.");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!clerk?.client || resendCooldown > 0) return;
    setError("");
    try {
      if (mode === "sign-in") {
        const signIn = clerk.client.signIn;
        const emailFactor = signIn.supportedFirstFactors?.find(
          (f: { strategy: string }) => f.strategy === "email_code"
        );
        if (!emailFactor) return;
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: (emailFactor as { emailAddressId: string }).emailAddressId,
        });
      } else {
        await clerk.client.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      }
      setResendCooldown(30);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function handleCodeChange(i: number, value: string) {
    // If user pasted/typed multiple digits at once, distribute them
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) {
      const next = [...code];
      next[i] = "";
      setCode(next);
      return;
    }
    if (digits.length === 1) {
      const next = [...code];
      next[i] = digits;
      setCode(next);
      if (i < 5) codeRefs.current[i + 1]?.focus();
      return;
    }
    // Multiple digits — fill from current position
    const next = [...code];
    for (let k = 0; k < digits.length && i + k < 6; k++) {
      next[i + k] = digits[k];
    }
    setCode(next);
    const lastIdx = Math.min(i + digits.length, 5);
    codeRefs.current[lastIdx]?.focus();
  }

  function handleCodeKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      codeRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
    setCode(next);
    const lastFilled = Math.min(pasted.length, 5);
    codeRefs.current[lastFilled]?.focus();
  }

  if (step === "email") {
    return (
      <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        {mode === "sign-up" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <Input
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Juan"
            />
            <Input
              label="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Pérez"
            />
          </div>
        )}

        <Input
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          required
          autoFocus
        />

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--t-xs)",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* Required for Clerk's bot protection (CAPTCHA) */}
        <div id="clerk-captcha" />

        <Button type="submit" variant="primary" fullWidth disabled={loading || !email}>
          {loading ? "Enviando código..." : "Enviar código por email"}
        </Button>

        <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", textAlign: "center", lineHeight: 1.5 }}>
          Te enviaremos un código de 6 dígitos para verificar tu identidad.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          Código enviado a
        </p>
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text)", fontWeight: 600, marginTop: 2 }}>
          {email}
        </p>
      </div>

      <div className="field">
        <label className="field-label" style={{ textAlign: "center" }}>
          Código de verificación
        </label>

        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }} onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { codeRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleCodeChange(i, e.target.value)}
              onKeyDown={(e) => handleCodeKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className="input mono"
              style={{
                width: 44,
                height: 52,
                textAlign: "center",
                fontSize: "var(--t-xl)",
                fontWeight: 700,
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--danger-soft)",
            color: "var(--danger)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--t-xs)",
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" fullWidth disabled={loading || code.join("").length !== 6}>
        {loading ? "Verificando..." : mode === "sign-in" ? "Iniciar sesión" : "Crear cuenta"}
      </Button>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "var(--sp-1)",
      }}>
        <button
          type="button"
          onClick={() => { setStep("email"); setCode(["", "", "", "", "", ""]); setError(""); }}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontSize: "var(--t-xs)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Cambiar email
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          style={{
            background: "none",
            border: "none",
            color: resendCooldown > 0 ? "var(--text-soft)" : "var(--primary)",
            fontSize: "var(--t-xs)",
            fontWeight: 600,
            cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
          }}
        >
          {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar código"}
        </button>
      </div>
    </form>
  );
}
