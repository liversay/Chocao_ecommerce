import { useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <p style={{ color: "rgba(240,244,255,0.5)" }}>Cargando...</p>
      </div>
    );
  }

  if (!isSignedIn) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
