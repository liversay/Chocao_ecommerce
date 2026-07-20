import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { AuditLog } from "./AuditLog";

describe("AuditLog", () => {
  test("define los campos de una entrada de auditoría", () => {
    for (const path of ["actor", "action", "resource", "before", "after", "requestId", "source"]) {
      expect(AuditLog.schema.path(path)).toBeDefined();
    }
  });

  test("los updates y deletes están bloqueados a nivel de schema (solo-anexado)", async () => {
    expect(AuditLog.updateOne({}, { action: "x" }).exec()).rejects.toThrow(/inmutable/);
    expect(AuditLog.deleteMany({}).exec()).rejects.toThrow(/inmutable/);
    expect(AuditLog.findOneAndUpdate({}, { action: "x" }).exec()).rejects.toThrow(/inmutable/);
  });

  test("GET /api/audit exige autenticación", async () => {
    const res = await createApp().request("/api/audit");
    expect(res.status).toBe(401);
  });
});
