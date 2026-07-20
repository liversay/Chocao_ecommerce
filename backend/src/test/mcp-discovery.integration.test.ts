import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { createApp } from "../app";
import { __resetSecretForTests } from "../oauth/tokens";
import { setupTestDB } from "./db";
import { authHeader, createUser } from "./factories";
import type { UserDoc } from "../models/User";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();
});

const REDIRECT = "http://localhost:41234/callback";

// Obtiene un access token MCP completo vía el flujo OAuth (helper compartible)
export async function obtainAccessToken(user: UserDoc, scope?: string): Promise<string> {
  const reg = await app.request("/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: [REDIRECT] }),
  });
  const { client_id } = (await reg.json()) as { client_id: string };

  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const approve = await app.request("/oauth/authorize/approve", {
    method: "POST",
    headers: authHeader(user),
    body: JSON.stringify({ client_id, redirect_uri: REDIRECT, scope, code_challenge: challenge }),
  });
  const { redirect } = (await approve.json()) as { redirect: string };
  const code = new URL(redirect).searchParams.get("code")!;

  const tokenRes = await app.request("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id,
      redirect_uri: REDIRECT,
    }),
  });
  return ((await tokenRes.json()) as { access_token: string }).access_token;
}

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
    const token = await obtainAccessToken(user, "catalog:read");

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
    const token = await obtainAccessToken(user, "catalog:read");

    const res = await rpc(token, "tools/list");
    expect(res.status).toBe(200);
    const body = (await rpcResult(res)) as { result: { tools: unknown[] } };
    expect(Array.isArray(body.result.tools)).toBe(true);
  });
});
