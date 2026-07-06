import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import { useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import Logo from "../components/Logo";

const navGroups = [
  {
    label: "Gestión",
    items: [
      { to: "/admin", label: "Dashboard", icon: "▤", end: true },
      { to: "/admin/vehicles", label: "Vehículos", icon: "▦", end: false },
      { to: "/admin/bids", label: "Pujas", icon: "◈", end: false },
    ],
  },
  {
    label: "Análisis",
    items: [{ to: "/admin/reports", label: "Reportes", icon: "▣", end: false }],
  },
];

export default function AdminLayout() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const initials = (user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress?.[0] || "?").toUpperCase();

  return (
    <div className="admin-theme admin-shell">
      <aside className="admin-sidebar">
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "var(--sp-2) var(--sp-3) var(--sp-5)",
          }}
        >
          <Logo size={32} />
          <div>
            <p style={{ fontWeight: 800, fontSize: "var(--t-md)", color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              Chocao
            </p>
            <span className="admin-chip" style={{ marginTop: 4, display: "inline-block" }}>
              Backoffice
            </span>
          </div>
        </Link>

        <nav className="admin-nav">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="admin-nav-label">{group.label.toUpperCase()}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => "admin-nav-item" + (isActive ? " active" : "")}
                >
                  <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 var(--sp-3)" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "var(--primary-soft)",
                color: "var(--primary)",
                fontWeight: 700,
                fontSize: "var(--t-xs)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {initials}
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

          <Button variant="ghost" size="sm" fullWidth onClick={() => setShowConfirm(true)}>
            Cerrar sesión
          </Button>

          <Link to="/" className="admin-nav-item">
            ← Ver sitio público
          </Link>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </main>

      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(31, 41, 55, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--sp-4)",
          }}
        >
          <Card
            variant="elevated"
            padding="lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
          >
            <h3 style={{ fontSize: "var(--t-lg)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              ¿Cerrar sesión?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)", lineHeight: 1.5 }}>
              Saldrás del backoffice. Tendrás que ingresar nuevamente para volver a administrar.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => signOut(() => navigate("/"))}>
                Sí, cerrar sesión
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
