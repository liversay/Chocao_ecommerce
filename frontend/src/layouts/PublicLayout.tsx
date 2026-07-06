import { Outlet, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Logo from "../components/Logo";

export default function PublicLayout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <footer
        style={{
          background: "var(--bg-alt)",
          borderTop: "1px solid var(--border)",
          padding: "var(--sp-6) 0 var(--sp-5)",
          marginTop: "var(--sp-7)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--sp-4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Logo size={36} />
            <div>
              <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "var(--t-sm)" }}>Chocao</p>
              <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>
                Plataforma oficial de subastas gubernamentales
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-5)", flexWrap: "wrap" }}>
            <Link to="/vehicles" style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 500 }}>Catálogo</Link>
            <a href="#" style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 500 }}>Términos</a>
            <a href="#" style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 500 }}>Privacidad</a>
            <a href="#" style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 500 }}>Contacto</a>
          </div>
          <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>
            © {new Date().getFullYear()} República de Panamá
          </p>
        </div>
      </footer>
    </div>
  );
}
