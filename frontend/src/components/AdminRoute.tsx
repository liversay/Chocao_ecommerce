import { useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

interface Props {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: Props) {
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
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <p style={{ color: "rgba(240,244,255,0.5)" }}>Verificando permisos...</p>
      </div>
    );
  }

  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;

  return <>{children}</>;
}
