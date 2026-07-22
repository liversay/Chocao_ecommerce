import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { createApp } from "../app";
import { __resetSecretForTests } from "../oauth/tokens";
import { setupTestDB } from "./db";
import { createUser } from "./factories";
import { obtainAccessToken as obtainWithApp } from "./oauthFlow";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();
});

function rpc(token: string, method: string, params: Record<string, unknown> = {}, id = 1) {
  return app.request("/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

async function rpcResult(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  // Streamable HTTP puede responder JSON directo o SSE con una línea data:
  const json = text.startsWith("event:") || text.includes("\ndata: ")
    ? text.split("\n").find((l) => l.startsWith("data: "))!.slice(6)
    : text;
  return JSON.parse(json) as Record<string, unknown>;
}

describe("discovery MCP (HU-46)", () => {
  test("initialize declara capabilities de tools, resources y prompts", async () => {
    const user = await createUser();
    const token = await obtainWithApp(app, user, "catalog:read");

    const res = await rpc(token, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "inspector", version: "1.0.0" },
    });
    const body = (await rpcResult(res)) as {
      result: { capabilities: Record<string, unknown>; serverInfo: { name: string } };
    };

    expect(body.result.serverInfo.name).toBe("chocao");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.capabilities.resources).toBeDefined();
    expect(body.result.capabilities.prompts).toBeDefined();
  });

  test("tools/list responde (vacío hasta que se registren las tools de negocio)", async () => {
    const user = await createUser();
    const token = await obtainWithApp(app, user, "catalog:read");

    const res = await rpc(token, "tools/list");
    expect(res.status).toBe(200);
    const body = (await rpcResult(res)) as { result: { tools: unknown[] } };
    expect(Array.isArray(body.result.tools)).toBe(true);
  });
});
