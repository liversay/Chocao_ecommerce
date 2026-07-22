import type { UserDoc } from "./models/User";
import type { Permission } from "./lib/permissions";

// Identidad de una sesión MCP autenticada por OAuth (token del AS propio).
export interface McpAuthInfo {
  user: UserDoc;
  /** scopes del token ∩ permisos vigentes del rol */
  scopes: Permission[];
  jti: string;
  clientId: string;
}

// Variables que los middlewares dejan en el contexto de Hono.
export type AppEnv = {
  Variables: {
    user: UserDoc;
    requestId: string;
    mcpAuth?: McpAuthInfo;
  };
};
