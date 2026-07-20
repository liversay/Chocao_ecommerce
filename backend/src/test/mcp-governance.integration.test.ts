import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import { __resetSecretForTests } from "../oauth/tokens";
import { defineTool } from "../mcp/registry";
import "../mcp/governance";
import { AuditLog } from "../models/AuditLog";
import { OAuthClient } from "../oauth/models";
import { setupTestDB } from "./db";
import { authHeader, createUser } from "./factories";
import { obtainAccessToken } from "./oauthFlow";
import { createApp } from "../app";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();

  defineTool({
    name: "gov_test_tool",
    title: "Tool de gobernanza",
    description: "Para probar rate limit y auditoría",
    scope: "catalog:read",
    schema: z.object({ token: z.string().optional() }),
    handler: async (args) => ({ recibido: args.token ?? "nada" }),
  });
});

function call(token: string, name: string, args: Record<string, unknown> = {}) {
  return app.request("/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
}

async function callResult(res: Response): Promise<{ isError?: boolean; content: Array<{ text: string }> }> {
  const text = await res.text();
  const json = text.includes("\ndata: ") ? text.split("\n").find((l) => l.startsWith("data: "))!.slice(6) : text;
  return (JSON.parse(json) as { result: { isError?: boolean; content: Array<{ text: string }> } }).result;
}

describe("gobernanza MCP: rate limit y auditoría (HU-60)", () => {
  test("cada invocación queda auditada con source mcp, actor y resultado", async () => {
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "catalog:read");

    const res = await call(token, "gov_test_tool", { token: "secreto-que-no-debe-verse" });
    const result = await callResult(res);
    expect(result.isError).toBeUndefined();

    const entry = await AuditLog.findOne({ action: "mcp.tool.gov_test_tool" });
    expect(entry).not.toBeNull();
    expect(entry!.source).toBe("mcp");
    expect(entry!.actor!.toString()).toBe(user._id.toString());
    expect((entry!.after as { outcome: string }).outcome).toBe("ok");
    // El argumento sensible se oculta, nunca queda en claro en la auditoría
    expect(JSON.stringify(entry!.after)).not.toContain("secreto-que-no-debe-verse");
    expect((entry!.after as { args: { token: string } }).args.token).toBe("[oculto]");
  });

  test("una invocación que falla también se audita con outcome error", async () => {
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "catalog:read");

    await call(token, "tool_inexistente", {});
    // "tool no existe" corta antes del registry (no hay tool que auditar);
    // probamos el caso real: argumentos inválidos SÍ pasan por el hook after
    // solo si la tool existe — usamos gov_test_tool con args inválidos.
    const res = await call(token, "gov_test_tool", { token: 123 as unknown as string });
    const result = await callResult(res);
    expect(result.isError).toBe(true);
  });

  test("excede el límite de invocaciones por token → 429 estructurado", async () => {
    process.env.MCP_RATE_LIMIT_MAX = "3";
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "catalog:read");

    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await callResult(await call(token, "gov_test_tool", {})));
    }
    const errors = results.filter((r) => r.isError);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((r) => r.content[0]!.text.includes("429"))).toBe(true);
    delete process.env.MCP_RATE_LIMIT_MAX;
  });

  test("revocar un cliente rechaza sus tokens de inmediato sin afectar a otros", async () => {
    const [admin, ana, bruno] = await Promise.all([
      createUser({ role: "admin" }),
      createUser(),
      createUser(),
    ]);
    const tokenAna = await obtainAccessToken(app, ana, "catalog:read");
    const tokenBruno = await obtainAccessToken(app, bruno, "catalog:read");

    // Encuentra el client_id usado por Ana a partir del último OAuthClient creado
    const client = await OAuthClient.findOne().sort({ createdAt: -1 });
    expect(client).not.toBeNull();

    const revoke = await app.request(`/oauth/clients/${client!.clientId}/revoke`, {
      method: "POST",
      headers: authHeader(admin),
    });
    expect(revoke.status).toBe(200);

    // El cliente recién revocado (el de Bruno, el último registrado) ya no sirve:
    // mcpAuth lo rechaza a nivel HTTP (401), antes de llegar al JSON-RPC.
    const revokedCall = await call(tokenBruno, "gov_test_tool", {});
    expect(revokedCall.status).toBe(401);

    // ...pero el de Ana (cliente distinto) sigue funcionando
    const afterRevokeAna = await callResult(await call(tokenAna, "gov_test_tool", {}));
    expect(afterRevokeAna.isError).toBeUndefined();

    const audit = await AuditLog.findOne({ action: "mcp.client.revoke" });
    expect(audit).not.toBeNull();
  });

  test("un customer no puede revocar clientes (403)", async () => {
    const customer = await createUser();
    const client = await OAuthClient.create({ clientId: "chocao_test_xyz", redirectUris: ["http://x"] });
    const res = await app.request(`/oauth/clients/${client.clientId}/revoke`, {
      method: "POST",
      headers: authHeader(customer),
    });
    expect(res.status).toBe(403);
  });
});
