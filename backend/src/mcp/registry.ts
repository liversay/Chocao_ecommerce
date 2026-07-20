import { z, type ZodObject, type ZodRawShape } from "zod";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import type { Permission } from "../lib/permissions";
import type { McpAuthInfo } from "../types";

// Registry central de tools MCP (HU-59): cada tool declara su scope mínimo y
// el gating es transversal —
//   · tools/list solo muestra las tools cuyo scope está en el token;
//   · tools/call re-verifica el scope aunque el cliente "adivine" el nombre;
//   · los argumentos se validan con Zod antes de tocar los servicios;
//   · las tools de escritura van anotadas para que el cliente pida
//     confirmación explícita al usuario antes de comprometer dinero.
export interface ToolDefinition<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  title: string;
  description: string;
  scope: Permission;
  schema: ZodObject<Shape>;
  /** true = no modifica estado (hint para el cliente) */
  readOnly?: boolean;
  /** true = acción sensible: el cliente debe pedir confirmación del usuario */
  requiresConfirmation?: boolean;
  handler: (args: z.infer<ZodObject<Shape>>, auth: McpAuthInfo) => Promise<unknown>;
}

const tools: ToolDefinition[] = [];

export function defineTool<Shape extends ZodRawShape>(def: ToolDefinition<Shape>) {
  if (tools.some((t) => t.name === def.name)) {
    throw new Error(`Tool MCP duplicada: ${def.name}`);
  }
  tools.push(def as unknown as ToolDefinition);
}

export function registeredTools(): readonly ToolDefinition[] {
  return tools;
}

// Hooks de gobernanza (HU-60 los implementa: auditoría + rate limit por token)
export type ToolInvocationHook = (context: {
  tool: ToolDefinition;
  args: Record<string, unknown>;
  auth: McpAuthInfo;
}) => Promise<void>;

const beforeInvokeHooks: ToolInvocationHook[] = [];
export function onToolInvocation(hook: ToolInvocationHook) {
  beforeInvokeHooks.push(hook);
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function okResult(payload: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

// Instala tools/list y tools/call filtrados por los scopes del token.
export function attachToolHandlers(server: Server, auth: McpAuthInfo) {
  const visible = () => tools.filter((t) => auth.scopes.includes(t.scope));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: visible().map((t) => ({
      name: t.name,
      title: t.title,
      description: `${t.description} (requiere scope ${t.scope})`,
      inputSchema: z.toJSONSchema(t.schema) as { type: "object" },
      annotations: {
        title: t.title,
        readOnlyHint: t.readOnly ?? false,
        destructiveHint: t.requiresConfirmation ?? false,
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) return errorResult(`La tool ${request.params.name} no existe`);

    // Mínimo privilegio: sin el scope (∩ rol, ya resuelto en mcpAuth) → 403,
    // aunque la tool se haya descubierto con otro token.
    if (!auth.scopes.includes(tool.scope)) {
      return errorResult(
        `403: no tienes el scope requerido (${tool.scope}) o tu rol no lo permite`
      );
    }

    const parsed = tool.schema.safeParse(request.params.arguments ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return errorResult(
        `Argumentos inválidos — ${issue?.path.join(".") ?? ""}: ${issue?.message ?? "error de validación"}`
      );
    }

    try {
      for (const hook of beforeInvokeHooks) {
        await hook({ tool, args: parsed.data as Record<string, unknown>, auth });
      }
      const result = await tool.handler(parsed.data, auth);
      return okResult(result);
    } catch (err) {
      if (err instanceof AppError) return errorResult(`${err.status}: ${err.message}`);
      logger.error("tool MCP falló", {
        tool: tool.name,
        userId: auth.user._id.toString(),
        error: err instanceof Error ? err.message : String(err),
      });
      return errorResult("Error interno al ejecutar la tool");
    }
  });
}
