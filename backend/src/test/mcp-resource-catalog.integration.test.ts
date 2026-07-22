import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { __resetSecretForTests } from "../oauth/tokens";
import "../mcp/tools";
import { CATALOG_URI } from "../mcp/resources/catalog";
import { setupTestDB } from "./db";
import { createUser, createVehicle } from "./factories";
import { obtainAccessToken } from "./oauthFlow";
import { createApp } from "../app";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();
});

function rpc(token: string, method: string, params: Record<string, unknown> = {}) {
  return app.request("/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method, params }),
  });
}

async function rpcResult<T>(res: Response): Promise<T> {
  const text = await res.text();
  const json = text.includes("\ndata: ") ? text.split("\n").find((l) => l.startsWith("data: "))!.slice(6) : text;
  return (JSON.parse(json) as { result: T }).result;
}

describe("resource catalog://vehicles (HU-58)", () => {
  test("resources/list lo muestra con scope catalog:read", async () => {
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "catalog:read");

    const result = await rpcResult<{ resources: Array<{ uri: string }> }>(await rpc(token, "resources/list"));
    expect(result.resources.some((r) => r.uri === CATALOG_URI)).toBe(true);
  });

  test("resources/list no lo muestra sin el scope", async () => {
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "payments:write");

    const result = await rpcResult<{ resources: unknown[] }>(await rpc(token, "resources/list"));
    expect(result.resources.length).toBe(0);
  });

  test("resources/read devuelve el inventario como JSON, sin borradores para un customer", async () => {
    await createVehicle({ title: "Público visible", status: "active" });
    await createVehicle({ title: "Borrador escondido", status: "draft" });

    const user = await createUser();
    const token = await obtainAccessToken(app, user, "catalog:read");

    const result = await rpcResult<{ contents: Array<{ uri: string; text: string }> }>(
      await rpc(token, "resources/read", { uri: CATALOG_URI })
    );
    const body = JSON.parse(result.contents[0]!.text) as { vehicles: Array<{ title: string }> };
    expect(body.vehicles.some((v) => v.title === "Público visible")).toBe(true);
    expect(body.vehicles.some((v) => v.title === "Borrador escondido")).toBe(false);
  });

  test("un admin con scope vehicle:write sí ve los borradores en el resource", async () => {
    await createVehicle({ title: "Borrador para admin", status: "draft" });
    const admin = await createUser({ role: "admin" });
    const token = await obtainAccessToken(app, admin, "catalog:read vehicle:write");

    const result = await rpcResult<{ contents: Array<{ text: string }> }>(
      await rpc(token, "resources/read", { uri: CATALOG_URI })
    );
    const body = JSON.parse(result.contents[0]!.text) as { vehicles: Array<{ title: string }> };
    expect(body.vehicles.some((v) => v.title === "Borrador para admin")).toBe(true);
  });
});
