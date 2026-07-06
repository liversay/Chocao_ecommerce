import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@clerk/react";
import GlassButton from "./GlassButton";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

const navLinkStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 16px",
  borderRadius: "var(--radius-pill)",
  color: active ? "var(--primary)" : "var(--text-muted)",
  fontSize: "var(--t-sm)",
  fontWeight: active ? 700 : 500,
  background: active ? "var(--surface)" : "transparent",
  boxShadow: active ? "var(--nm-in-sm)" : "none",
  transition: "all 0.15s",
});

export default function Navbar() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn && isLoaded) {
      api.get("/api/users/me").then((r) => setRole(r.data.role)).catch(() => {});
    } else {
      setRole(null);
    }
  }, [isSignedIn, isLoaded]);

  return (
    <nav
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--hairline)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 72,
        }}
      >
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Logo size={40} />
          <div>
            <p
              style={{
                fontWeight: 800,
                fontSize: "var(--t-md)",
                color: "var(--text)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Chocao
            </p>
            <p
              style={{
                fontSize: "0.65rem",
                color: "var(--text-soft)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginTop: 2,
              }}
            >
              Subastas Gov · Panamá
            </p>
          </div>
        </Link>

        {/* Center nav */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: "var(--surface)",
            padding: "5px",
            borderRadius: "var(--radius-pill)",
            boxShadow: "var(--nm-in-sm)",
          }}
        >
          <NavLink to="/" end style={({ isActive }) => navLinkStyle(isActive)}>
            Inicio
          </NavLink>
          <NavLink to="/vehicles" style={({ isActive }) => navLinkStyle(isActive)}>
            Catálogo
          </NavLink>
          {isSignedIn && (
            <>
              <NavLink to="/my-bids" style={({ isActive }) => navLinkStyle(isActive)}>
                Mis subastas
              </NavLink>
              <NavLink to="/my-purchases" style={({ isActive }) => navLinkStyle(isActive)}>
                Mis compras
              </NavLink>
            </>
          )}
        </div>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          {isLoaded && isSignedIn ? (
            <>
              {role === "admin" && (
                <Link to="/admin">
                  <GlassButton variant="accent" size="sm">
                    Backoffice
                  </GlassButton>
                </Link>
              )}
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login">
                <GlassButton variant="ghost" size="sm">Ingresar</GlassButton>
              </Link>
              <Link to="/register">
                <GlassButton variant="primary" size="sm">Registrarse</GlassButton>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
