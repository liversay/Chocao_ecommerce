import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { __resetSecretForTests } from "../oauth/tokens";
import "../mcp/tools";
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

describe("chocao_search_vehicles (HU-47)", () => {
  test("un customer busca el catálogo público sin ver borradores", async () => {
    await createVehicle({ title: "Toyota público", status: "active" });
    await createVehicle({ title: "Borrador oculto", status: "draft" });

    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{ items: Array<{ title: string; status: string }>; total: number }>(
      await callTool(app, token, "chocao_search_vehicles", {})
    );
    expect(res.isError).toBeUndefined();
    expect(res.data!.items.some((v) => v.status === "draft")).toBe(false);
  });

  test("un admin (scope vehicle:write) puede filtrar borradores explícitamente", async () => {
    await createVehicle({ title: "Borrador admin", status: "draft" });
    const admin = await createUser({ role: "admin" });
    const token = await obtainAccessToken(app, admin, "catalog:read vehicle:write");

    const res = await toolResult<{ items: Array<{ status: string }> }>(
      await callTool(app, token, "chocao_search_vehicles", { status: "all" })
    );
    expect(res.isError).toBeUndefined();
    expect(Array.isArray(res.data!.items)).toBe(true);
  });

  test("filtra por texto y marca igual que el endpoint REST", async () => {
    await createVehicle({ title: "Hilux especial", brand: "Toyota" });
    await createVehicle({ title: "Frontier normal", brand: "Nissan" });

    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{ total: number }>(
      await callTool(app, token, "chocao_search_vehicles", { q: "hilux" })
    );
    expect(res.data!.total).toBe(1);
  });

  test("sin el scope catalog:read la tool falla con 403", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "payments:write");

    const res = await toolResult(await callTool(app, token, "chocao_search_vehicles", {}));
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("403");
  });
});

describe("chocao_get_vehicle (HU-48)", () => {
  test("devuelve el detalle con segundos restantes y acceptsBids", async () => {
    const vehicle = await createVehicle({
      status: "active",
      auctionEndDate: new Date(Date.now() + 60_000),
    });
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{ remainingSeconds: number; acceptsBids: boolean; status: string }>(
      await callTool(app, token, "chocao_get_vehicle", { vehicleId: vehicle._id.toString() })
    );
    expect(res.isError).toBeUndefined();
    expect(res.data!.status).toBe("active");
    expect(res.data!.acceptsBids).toBe(true);
    expect(res.data!.remainingSeconds).toBeGreaterThan(0);
  });

  test("una subasta cerrada no acepta pujas", async () => {
    const vehicle = await createVehicle({ status: "closed" });
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{ acceptsBids: boolean }>(
      await callTool(app, token, "chocao_get_vehicle", { vehicleId: vehicle._id.toString() })
    );
    expect(res.data!.acceptsBids).toBe(false);
  });

  test("un vehículo inexistente responde 404 estructurado", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");
    const fakeId = "64b5f0c8a2f4e1d9c3b7a611";

    const res = await toolResult(await callTool(app, token, "chocao_get_vehicle", { vehicleId: fakeId }));
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("404");
  });

  test("un borrador no es visible sin scope vehicle:write", async () => {
    const vehicle = await createVehicle({ status: "draft" });
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult(
      await callTool(app, token, "chocao_get_vehicle", { vehicleId: vehicle._id.toString() })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("404");
  });

  test("un id con formato inválido se rechaza por Zod, no revienta con CastError", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult(
      await callTool(app, token, "chocao_get_vehicle", { vehicleId: "no-es-un-id" })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("Argumentos inválidos");
  });
});
