import { Link } from "react-router";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";

export default function NotFoundPage() {
  return (
    <div className="container" style={{ padding: "var(--sp-8) var(--sp-4)" }}>
      <EmptyState
        icon="🧭"
        title="Página no encontrada (404)"
        description="La dirección que buscas no existe o fue movida. Revisa el enlace o vuelve al catálogo de subastas."
        action={
          <Link to="/vehicles">
            <Button>Ir al catálogo</Button>
          </Link>
        }
      />
    </div>
  );
}
