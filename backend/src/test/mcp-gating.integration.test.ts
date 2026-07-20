import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import { __resetSecretForTests } from "../oauth/tokens";
import { defineTool } from "../mcp/registry";
import { setupTestDB } from "./db";
import { createUser } from "./factories";
import { obtainAccessToken as obtainWithApp } from "./oauthFlow";
import { createApp } from "../app";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();

  // Tools de prueba: una de lectura (customer) y una admin sensible
  defineTool({
    name: "test_echo",
    title: "Echo de prueba",
    description: "Devuelve el mensaje",
    scope: "catalog:read",
    schema: z.object({ mensaje: z.string().min(1) }),
    readOnly: true,
    handler: async (args) => ({ eco: args.mensaje }),
  });
  defineTool({
    name: "test_admin_destroy",
    title: "Acción admin de prueba",
    description: "Solo admins",
    scope: "vehicle:write",
    schema: z.object({}),
    requiresConfirmation: true,
    handler: async () => ({ hecho: true }),
  });
});

function rpc(token: string, method: string, params: Record<string, unknown> = {}) {
  return app.request("/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method, params }),
  });
}

async function rpcResult<T>(res: Response): Promise<T> {
  const text = await res.text();
  const json = text.includes("\ndata: ")
    ? text.split("\n").find((l) => l.startsWith("data: "))!.slice(6)
    : text;
  return (JSON.parse(json) as { result: T }).result;
}

interface ToolList {
  tools: Array<{ name: string; annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean } }>;
}
interface CallResult {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
}

describe("gating por scopes (HU-59)", () => {
  test("tools/list se filtra por los scopes del token", async () => {
    const customer = await createUser();
    const token = await obtainWithApp(app, customer, "catalog:read bids:read");

    const list = await rpcResult<ToolList>(await rpc(token, "tools/list"));
    const names = list.tools.map((t) => t.name);
    expect(names).toContain("test_echo");
    expect(names).not.toContain("test_admin_destroy");
  });

  test("un admin ve las tools admin, con la anotación de confirmación", async () => {
    const admin = await createUser({ role: "admin" });
    const token = await obtainWithApp(app, admin, "catalog:read vehicle:write");

    const list = await rpcResult<ToolList>(await rpc(token, "tools/list"));
    const adminTool = list.tools.find((t) => t.name === "test_admin_destroy");
    expect(adminTool).toBeDefined();
    expect(adminTool!.annotations?.destructiveHint).toBe(true);

    const echo = list.tools.find((t) => t.name === "test_echo");
    expect(echo!.annotations?.readOnlyHint).toBe(true);
  });

  test("tools/call sin el scope devuelve 403 estructurado (aunque conozca el nombre)", async () => {
    const customer = await createUser();
    const token = await obtainWithApp(app, customer, "catalog:read");

    const result = await rpcResult<CallResult>(
      await rpc(token, "tools/call", { name: "test_admin_destroy", arguments: {} })
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("403");
  });

  test("un customer nunca puede invocar tools admin aunque pida el scope", async () => {
    const customer = await createUser();
    // pide vehicle:write pero su rol no lo tiene: el token no lo incluye
    const token = await obtainWithApp(app, customer, "catalog:read vehicle:write");

    const result = await rpcResult<CallResult>(
      await rpc(token, "tools/call", { name: "test_admin_destroy", arguments: {} })
    );
    expect(result.isError).toBe(true);
  });

  test("argumentos inválidos se rechazan con mensaje claro", async () => {
    const customer = await createUser();
    const token = await obtainWithApp(app, customer, "catalog:read");

    const result = await rpcResult<CallResult>(
      await rpc(token, "tools/call", { name: "test_echo", arguments: { mensaje: "" } })
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Argumentos inválidos");
  });

  test("una invocación válida ejecuta el handler y devuelve JSON", async () => {
    const customer = await createUser();
    const token = await obtainWithApp(app, customer, "catalog:read");

    const result = await rpcResult<CallResult>(
      await rpc(token, "tools/call", { name: "test_echo", arguments: { mensaje: "hola" } })
    );
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]!.text)).toEqual({ eco: "hola" });
  });
});
