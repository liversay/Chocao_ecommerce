import type { Hono } from "hono";
import type { AppEnv } from "../types";

// Helpers JSON-RPC compartidos por los tests de tools MCP: invoca
// tools/call sobre /mcp y desempaqueta el resultado (texto plano si es
// error, JSON si la tool lo devolvió así).
export function callTool(
  app: Hono<AppEnv>,
  token: string,
  name: string,
  args: Record<string, unknown> = {}
) {
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

export interface ToolCallResult<T> {
  isError?: boolean;
  content: Array<{ text: string }>;
  data?: T;
}

export async function toolResult<T = Record<string, unknown>>(res: Response): Promise<ToolCallResult<T>> {
  const text = await res.text();
  const json = text.includes("\ndata: ") ? text.split("\n").find((l) => l.startsWith("data: "))!.slice(6) : text;
  const parsed = (JSON.parse(json) as { result: { isError?: boolean; content: Array<{ text: string }> } }).result;
  let data: T | undefined;
  if (!parsed.isError && parsed.content?.[0]) {
    try {
      data = JSON.parse(parsed.content[0].text) as T;
    } catch {
      data = undefined;
    }
  }
  return { ...parsed, data };
}
