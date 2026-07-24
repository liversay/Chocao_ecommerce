import { test, expect } from "bun:test";
import { checkPermission, permissionsForRole } from "./permissions";

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
