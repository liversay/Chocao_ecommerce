import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { listVehicles } from "../../services/vehicles";
import type { McpAuthInfo } from "../../types";

export const CATALOG_URI = "catalog://vehicles";

// Resource catalog://vehicles (HU-58): el inventario como contexto vivo de
// la conversación, sin invocar una tool en cada turno.
//
// LIMITACIÓN CONOCIDA: el transporte MCP de Chocao es Streamable HTTP en
// modo stateless (server.ts crea una instancia nueva por request — ver
// mcp/index.ts). La suscripción real a cambios (resources/subscribe +
// notifications/resources/updated) requiere una sesión persistente con un
// stream SSE abierto; en modo stateless el cliente debe releer el resource
// (resources/read) para obtener el estado actual. Esto está documentado en
// docs/mcp.md — no se anuncia `subscribe: true` en las capabilities para no
// prometer push que el transporte actual no puede cumplir.
export function attachCatalogResource(server: Server, auth: McpAuthInfo) {
  const canRead = auth.scopes.includes("catalog:read");

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    // Sin scope catalog:read el resource ni se lista (mismo criterio de
    // mínimo privilegio que las tools, HU-59).
    resources: canRead
      ? [
          {
            uri: CATALOG_URI,
            name: "Catálogo de vehículos",
            description:
              "Inventario público de vehículos en subasta (primeras 50 entradas activas/publicadas). " +
              "Léelo de nuevo para refrescar el contenido — este servidor no empuja actualizaciones.",
            mimeType: "application/json",
          },
        ]
      : [],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== CATALOG_URI) {
      throw new Error(`Resource desconocido: ${request.params.uri}`);
    }
    if (!canRead) throw new Error("403: no tienes el scope catalog:read");

    // listVehicles solo devuelve borradores cuando se pide status="draft"
    // explícitamente (mismo comportamiento que el catálogo REST, HU-44) —
    // para el admin mezclamos ambas listas hasta el límite de 50.
    const includeDrafts = auth.scopes.includes("vehicle:write");
    const published = await listVehicles({ limit: 50 });
    const drafts = includeDrafts
      ? await listVehicles({ status: "draft", includeDrafts: true, limit: 50 })
      : { items: [], total: 0 };

    const items = [...published.items, ...drafts.items].slice(0, 50);
    const total = published.total + drafts.total;

    return {
      contents: [
        {
          uri: CATALOG_URI,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              total,
              vehicles: items.map((v) => ({
                id: v._id.toString(),
                title: v.title,
                brand: v.brand,
                model: v.model,
                year: v.year,
                status: v.status,
                currentPrice: v.currentPrice,
                auctionEndDate: v.auctionEndDate,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  });
}
