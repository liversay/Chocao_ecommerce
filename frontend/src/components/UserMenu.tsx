import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useClerk, useUser } from "@clerk/react";
import { Gavel, ShoppingBag, Heart, Settings, LogOut } from "lucide-react";
import Button from "./Button";

export default function UserMenu() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initial = (user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress?.[0] || "?").toUpperCase();
  const name = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0];
  const email = user?.emailAddresses[0]?.emailAddress;

  function handleConfirmLogout() {
    setShowConfirm(false);
    setOpen(false);
    signOut(() => navigate("/"));
  }

  return (
    <>
      <div ref={ref} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "5px 5px 5px 14px",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
        >
          <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 600 }}>
            {name}
          </span>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--primary)",
              color: "white",
              fontSize: "var(--t-xs)",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {initial}
          </span>
        </button>

        {open && (
          <div
            className="card card-elevated dropdown-panel user-menu-panel"
            style={{ padding: "var(--sp-3)" }}
          >
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
              <p style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--text)" }}>{name}</p>
              <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {email}
              </p>
            </div>
            <button
              onClick={() => { setOpen(false); navigate("/my-bids"); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "var(--t-sm)",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-alt)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <Gavel size={18} style={{ flexShrink: 0 }} />
              <span>Mis subastas</span>
            </button>
            <button
              onClick={() => { setOpen(false); navigate("/my-purchases"); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "var(--t-sm)",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-alt)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <ShoppingBag size={18} style={{ flexShrink: 0 }} />
              <span>Mis compras</span>
            </button>
            <button
              onClick={() => { setOpen(false); navigate("/watchlist"); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "var(--t-sm)",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-alt)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <Heart size={18} style={{ flexShrink: 0 }} />
              <span>Mi watchlist</span>
            </button>
            <button
              onClick={() => { setOpen(false); navigate("/account"); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "var(--t-sm)",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-alt)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <Settings size={18} style={{ flexShrink: 0 }} />
              <span>Mi cuenta</span>
            </button>
            <button
              onClick={() => { setOpen(false); setShowConfirm(true); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                color: "var(--danger)",
                fontSize: "var(--t-sm)",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-soft)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <LogOut size={18} color="currentColor" style={{ flexShrink: 0 }} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}
      </div>

      {showConfirm && (
        <div
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
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="card card-elevated"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: "var(--radius-lg)",
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
            }}>
              <LogOut size={28} />
            </div>
            <h3 style={{ fontSize: "var(--t-lg)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              ¿Cerrar sesión?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)", lineHeight: 1.5 }}>
              Tendrás que ingresar nuevamente para continuar pujando o pagar subastas adjudicadas.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleConfirmLogout}>
                Sí, cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
