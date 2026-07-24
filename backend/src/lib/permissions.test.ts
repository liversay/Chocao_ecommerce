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

  test("auditor solo tiene permisos de lectura", () => {
    const auditor = { role: "auditor" as const };
    expect(checkPermission(auditor, "audit:read")).toBe(true);
    expect(checkPermission(auditor, "catalog:read")).toBe(true);
    expect(checkPermission(auditor, "entrega:read")).toBe(true);
    expect(checkPermission(auditor, "vehicle:write")).toBe(false);
    expect(checkPermission(auditor, "bids:write")).toBe(false);
    expect(checkPermission(auditor, "payment:refund")).toBe(false);
    expect(checkPermission(auditor, "entrega:execute")).toBe(false);
  });

  test("custodio solo puede leer catálogo y ejecutar entregas", () => {
    const custodio = { role: "custodio" as const };
    expect(checkPermission(custodio, "catalog:read")).toBe(true);
    expect(checkPermission(custodio, "entrega:read")).toBe(true);
    expect(checkPermission(custodio, "entrega:execute")).toBe(true);
    expect(checkPermission(custodio, "vehicle:write")).toBe(false);
    expect(checkPermission(custodio, "users:manage")).toBe(false);
  });

  test("admin conserva todos los permisos, incluidos los nuevos", () => {
    expect(permissionsForRole("admin")).toContain("entrega:read");
    expect(permissionsForRole("admin")).toContain("entrega:execute");
    expect(permissionsForRole("admin")).toContain("acreditacion:review");
  });
});
