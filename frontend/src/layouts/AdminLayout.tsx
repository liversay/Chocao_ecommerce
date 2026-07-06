import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import { useState } from "react";
import GlassButton from "../components/GlassButton";
import Logo from "../components/Logo";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: "▤", end: true },
  { to: "/admin/vehicles", label: "Vehículos", icon: "▦", end: false },
  { to: "/admin/bids", label: "Ofertas", icon: "◈", end: false },
  { to: "/admin/reports", label: "Reportes", icon: "▣", end: false },
];

export default function AdminLayout() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 250,
          background: "var(--bg)",
          padding: "var(--sp-5) var(--sp-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-2)",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          borderRight: "1px solid var(--hairline)",
          zIndex: 50,
        }}
      >
        {/* Brand */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "var(--sp-2) var(--sp-3) var(--sp-5)",
          }}
        >
          <Logo size={42} />
          <div>
            <p style={{ fontWeight: 800, fontSize: "var(--t-md)", color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              Chocao
            </p>
            <p
              style={{
                fontSize: "0.65rem",
                color: "var(--accent)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginTop: 4,
              }}
            >
              Backoffice
            </p>
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 14px",
                borderRadius: "var(--radius-md)",
                color: isActive ? "var(--primary)" : "var(--text-muted)",
                fontSize: "var(--t-sm)",
                fontWeight: isActive ? 700 : 500,
                background: isActive ? "var(--surface)" : "transparent",
                boxShadow: isActive ? "var(--nm-in-sm)" : "none",
                transition: "all 0.15s",
              })}
            >
              <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User panel */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--nm-out-sm)",
            padding: "var(--sp-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--primary)",
                color: "white",
                fontWeight: 700,
                fontSize: "var(--t-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--nm-out-sm)",
              }}
            >
              {(user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress?.[0] || "?").toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: "var(--t-xs)", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.firstName || "Admin"}
              </p>
              <p style={{ fontSize: "0.7rem", color: "var(--text-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.emailAddresses[0]?.emailAddress}
              </p>
            </div>
          </div>
          <GlassButton size="sm" variant="ghost" fullWidth onClick={() => setShowConfirm(true)}>
            Cerrar sesión
          </GlassButton>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 250, padding: "var(--sp-6) var(--sp-7)", overflowY: "auto" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Outlet />
        </div>
      </main>

      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(31, 50, 80, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--sp-4)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--nm-out-lg)",
              padding: "var(--sp-6)",
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{
              width: 64, height: 64,
              margin: "0 auto var(--sp-4)",
              borderRadius: "50%",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.6rem",
              fontWeight: 700,
              boxShadow: "var(--nm-out-sm)",
            }}>
              ⏻
            </div>
            <h3 style={{ fontSize: "var(--t-lg)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              ¿Cerrar sesión?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)", lineHeight: 1.5 }}>
              Saldrás del backoffice. Tendrás que ingresar nuevamente para volver a administrar.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <GlassButton variant="ghost" onClick={() => setShowConfirm(false)}>
                Cancelar
              </GlassButton>
              <GlassButton variant="danger" onClick={() => signOut(() => navigate("/"))}>
                Sí, cerrar sesión
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
