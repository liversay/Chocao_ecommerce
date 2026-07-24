import { useAuth } from "@clerk/react";
import { Navigate } from "react-router";
import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

interface Props {
  roles: string[];
  children: React.ReactNode;
}

// Guard genérico por rol — AdminRoute es un caso particular de este
// componente (roles={["admin"]}). Mismo flujo: espera a Clerk, resuelve el
// rol contra /api/users/me y solo entonces decide si redirige.
export default function RoleRoute({ roles, children }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setChecking(false);
      return;
    }
    api
      .get("/api/users/me")
      .then((r) => setRole(r.data.role))
      .catch(() => setRole(null))
      .finally(() => setChecking(false));
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || checking) {
    return (
      <div
        className="admin-theme"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          background: "var(--bg)",
        }}
      >
        <p style={{ color: "var(--text-muted)" }}>Verificando permisos...</p>
      </div>
    );
  }

  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
