import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { __resetSecretForTests } from "../oauth/tokens";
import "../mcp/tools";
import { AuditLog } from "../models/AuditLog";
import { Vehicle } from "../models/Vehicle";
import { setupTestDB } from "./db";
import { createUser, createVehicle } from "./factories";
import { obtainAccessToken } from "./oauthFlow";
import { callTool, toolResult } from "./mcpRpc";
import { createApp } from "../app";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();
});

describe("chocao_upsert_vehicle (HU-54)", () => {
  test("crea un vehículo nuevo siempre en draft, con auditoría", async () => {
    const admin = await createUser({ role: "admin" });
    const token = await obtainAccessToken(app, admin, "vehicle:write");

    const res = await toolResult<{ id: string; status: string }>(
      await callTool(app, token, "chocao_upsert_vehicle", {
        title: "Toyota Hilux 2022",
        brand: "Toyota",
        model: "Hilux",
        year: 2022,
        basePrice: 20_000,
      })
    );

    expect(res.isError).toBeUndefined();
    expect(res.data!.status).toBe("draft");
    const audit = await AuditLog.findOne({ action: "vehicle.upsert", resourceId: res.data!.id });
    expect(audit).not.toBeNull();
    expect(audit!.actor!.toString()).toBe(admin._id.toString());
  });

  test("faltan campos obligatorios al crear → error de validación", async () => {
    const admin = await createUser({ role: "admin" });
    const token = await obtainAccessToken(app, admin, "vehicle:write");

    const res = await toolResult(
      await callTool(app, token, "chocao_upsert_vehicle", { title: "Sin marca ni modelo" })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("obligatorios");
  });

  test("edita un vehículo existente con id", async () => {
    const vehicle = await createVehicle({ title: "Original", basePrice: 5_000 });
    const admin = await createUser({ role: "admin" });
    const token = await obtainAccessToken(app, admin, "vehicle:write");

    const res = await toolResult<{ title: string }>(
      await callTool(app, token, "chocao_upsert_vehicle", {
        id: vehicle._id.toString(),
        title: "Título editado",
      })
    );
    expect(res.isError).toBeUndefined();
    expect(res.data!.title).toBe("Título editado");
    expect((await Vehicle.findById(vehicle._id))!.title).toBe("Título editado");
  });

  test("sin scope vehicle:write la tool falla con 403", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult(
      await callTool(app, token, "chocao_upsert_vehicle", {
        title: "Intento no autorizado",
        brand: "X",
        model: "Y",
        year: 2020,
        basePrice: 1000,
      })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("403");
  });
});
