import type { IUser } from "../models/User";

// Catálogo de permisos de grano fino. Este mismo vocabulario se reutiliza
// como scopes OAuth del servidor MCP (HU-45/59): un scope concedido solo es
// efectivo si el rol del usuario también otorga el permiso.
export const PERMISSIONS = [
  "catalog:read", // catálogo público
  "bids:read", // ver las pujas propias
  "bids:write", // pujar
  "payments:write", // iniciar checkout de pujas propias
  "payment:refund", // reembolsar pagos (finanzas)
  "vehicle:write", // CRUD y ciclo de vida de vehículos (catálogo)
  "dashboard:read", // KPIs del dashboard
  "report:read", // reportes y actividad global (todas las pujas)
  "users:manage", // cambiar roles de usuarios
  "audit:read", // consultar el registro de auditoría
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = IUser["role"];

// Mapa rol → permisos (mínimo privilegio). Extensible a roles como
// finance/support agregando una entrada sin tocar los endpoints.
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: ["catalog:read", "bids:read", "bids:write", "payments:write"],
  admin: [...PERMISSIONS],
};

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function checkPermission(user: Pick<IUser, "role">, permission: Permission): boolean {
  return permissionsForRole(user.role).includes(permission);
}
