import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { Menu, X } from "lucide-react";
import Button from "./Button";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";
import WatchlistBell from "./WatchlistBell";
import { useEffect, useRef, useState } from "react";
import { useApi } from "../hooks/useApi";

const navLinkStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 0",
  color: active ? "var(--primary)" : "var(--text-muted)",
  fontSize: "var(--t-sm)",
  fontWeight: active ? 600 : 500,
  borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
  transition: "color var(--dur), border-color var(--dur)",
});

export default function Navbar() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();
  const [role, setRole] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSignedIn && isLoaded) {
      api.get("/api/users/me").then((r) => setRole(r.data.role)).catch(() => { });
    } else {
      setRole(null);
    }
  }, [isSignedIn, isLoaded]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) setMobileNavOpen(false);
    }
    if (mobileNavOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [mobileNavOpen]);

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <nav
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
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
          flexWrap: "wrap",
          gap: "var(--sp-2)",
          minHeight: 72,
          padding: "12px var(--sp-5)",
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
            <p className="eyebrow navbar-tagline" style={{ marginTop: 2 }}>
              República de Panamá
            </p>
          </div>
        </Link>

        {/* Center nav (desktop) */}
        <div
          className="navbar-center-desktop"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-5)",
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
          <div ref={mobileNavRef} style={{ position: "relative" }}>
            <button
              className="navbar-hamburger-btn"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Menú de navegación"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {mobileNavOpen && (
              <div
                className="navbar-mobile-drawer"
                style={{
                  position: "fixed",
                  top: 76,
                  left: 12,
                  right: 12,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-sm)",
                  zIndex: 200,
                  padding: "var(--sp-3)",
                  flexDirection: "column",
                  gap: "var(--sp-1)",
                }}
              >
                <NavLink
                  to="/"
                  end
                  onClick={closeMobileNav}
                  style={({ isActive }) => ({ ...navLinkStyle(isActive), padding: "10px 12px" })}
                >
                  Inicio
                </NavLink>
                <NavLink
                  to="/vehicles"
                  onClick={closeMobileNav}
                  style={({ isActive }) => ({ ...navLinkStyle(isActive), padding: "10px 12px" })}
                >
                  Catálogo
                </NavLink>
                {isSignedIn && (
                  <>
                    <NavLink
                      to="/my-bids"
                      onClick={closeMobileNav}
                      style={({ isActive }) => ({ ...navLinkStyle(isActive), padding: "10px 12px" })}
                    >
                      Mis subastas
                    </NavLink>
                    <NavLink
                      to="/my-purchases"
                      onClick={closeMobileNav}
                      style={({ isActive }) => ({ ...navLinkStyle(isActive), padding: "10px 12px" })}
                    >
                      Mis compras
                    </NavLink>
                  </>
                )}
              </div>
            )}
          </div>
          {isLoaded && isSignedIn ? (
            <>
              {role === "admin" && (
                <Link to="/admin">
                  <Button variant="secondary" size="sm">
                    Backoffice
                  </Button>
                </Link>
              )}
              <NotificationBell />
              <WatchlistBell />
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Ingresar</Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">Registrarse</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
