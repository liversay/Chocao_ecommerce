import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { __resetSecretForTests } from "../oauth/tokens";
import "../mcp/tools";
import { setupTestDB } from "./db";
import { authHeader, createUser, createVehicle } from "./factories";
import { obtainAccessToken } from "./oauthFlow";
import { callTool, toolResult } from "./mcpRpc";
import { createApp } from "../app";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();
});

describe("chocao_dashboard_summary (HU-56)", () => {
  test("devuelve los mismos agregados que /api/dashboard/summary", async () => {
    await createVehicle({ status: "active" });
    await createVehicle({ status: "awarded" });

    const admin = await createUser({ role: "admin" });
    const token = await obtainAccessToken(app, admin, "dashboard:read");

    const res = await toolResult<{ totalVehicles: number; activeAuctions: number; awardedVehicles: number }>(
      await callTool(app, token, "chocao_dashboard_summary", {})
    );
    expect(res.isError).toBeUndefined();
    expect(res.data!.totalVehicles).toBeGreaterThanOrEqual(2);
    expect(res.data!.activeAuctions).toBeGreaterThanOrEqual(1);
    expect(res.data!.awardedVehicles).toBeGreaterThanOrEqual(1);

    const rest = await app.request("/api/dashboard/summary", { headers: authHeader(admin) });
    const restBody = (await rest.json()) as { totalVehicles: number };
    expect(res.data!.totalVehicles).toBe(restBody.totalVehicles);
  });

  test("sin scope dashboard:read la tool falla con 403", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");
    const res = await toolResult(await callTool(app, token, "chocao_dashboard_summary", {}));
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("403");
  });
});
