import { describe, expect, test } from "bun:test";
import { PERMISSIONS, checkPermission, permissionsForRole } from "./permissions";

describe("RBAC", () => {
  test("customer solo tiene permisos de participación (mínimo privilegio)", () => {
    expect([...permissionsForRole("customer")].sort()).toEqual([
      "bids:read",
      "bids:write",
      "catalog:read",
      "payments:write",
    ]);
  });

  test("customer no puede administrar", () => {
    const customer = { role: "customer" as const };
    for (const p of ["vehicle:write", "payment:refund", "dashboard:read", "report:read", "users:manage", "audit:read"] as const) {
      expect(checkPermission(customer, p)).toBe(false);
    }
  });

  test("admin tiene todos los permisos del catálogo", () => {
    const admin = { role: "admin" as const };
    for (const p of PERMISSIONS) {
      expect(checkPermission(admin, p)).toBe(true);
    }
  });

  test("un rol desconocido no tiene permisos", () => {
    expect(checkPermission({ role: "hacker" as never }, "catalog:read")).toBe(false);
  });
});
