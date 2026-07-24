import RoleRoute from "./RoleRoute";

interface Props {
  children: React.ReactNode;
}

// Caso particular de RoleRoute (roles=["admin"]) — se mantiene como
// componente propio porque todas las rutas /admin/* ya lo importan por
// nombre y así no hace falta tocarlas.
export default function AdminRoute({ children }: Props) {
  return <RoleRoute roles={["admin"]}>{children}</RoleRoute>;
}
