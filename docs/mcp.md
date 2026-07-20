# Servidor MCP de Chocao

Chocao expone su plataforma de subastas a agentes de IA mediante **Model Context
Protocol** (Streamable HTTP) protegido con **OAuth 2.1 + PKCE**. El servidor vive
en el mismo backend, bajo `/mcp`.

- **Endpoint MCP**: `https://<backend>/mcp` (dev: `http://localhost:3000/mcp`)
- **Descubrimiento OAuth**: `/.well-known/oauth-protected-resource` y
  `/.well-known/oauth-authorization-server`
- **Registro de clientes**: Dynamic Client Registration (RFC 7591) — los clientes
  se registran solos, sin configuración manual.

## Importar en Claude Code

```bash
claude mcp add --transport http chocao http://localhost:3000/mcp
```

o en `.mcp.json` del proyecto:

```json
{
  "mcpServers": {
    "chocao": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

La **primera conexión** dispara el flujo OAuth: Claude Code abre el navegador en
la página de consentimiento de Chocao (`/mcp-consent`), inicias sesión con tu
cuenta (Clerk), revisas los permisos y autorizas. El token se refresca
automáticamente (refresh rotativo); no vuelves a ver el navegador salvo que
revoques el acceso.

## Importar en Codex

En `~/.codex/config.toml`:

```toml
[mcp_servers.chocao]
url = "http://localhost:3000/mcp"
```

Codex detecta la metadata OAuth por el `WWW-Authenticate` del 401 inicial y
completa el mismo flujo de consentimiento en el navegador.

## Probar con MCP Inspector

```bash
bunx @modelcontextprotocol/inspector
# Transport: Streamable HTTP · URL: http://localhost:3000/mcp
```

El Inspector corre en el navegador: en dev agrega su origen a `ALLOWED_ORIGINS`
del backend (p. ej. `http://localhost:6274`).

## Scopes

Los scopes OAuth usan el mismo vocabulario que el RBAC del backend. Solo puedes
conceder los que tu rol permite, y en cada llamada se re-verifican contra tu rol
vigente.

| Scope | Permite | Rol mínimo |
| --- | --- | --- |
| `catalog:read` | Buscar vehículos, ver detalle e historial de pujas | customer |
| `bids:read` | Ver tus pujas y compras | customer |
| `bids:write` | Pujar en tu nombre (el agente pide confirmación) | customer |
| `payments:write` | Generar el link de pago de un bid ganador | customer |
| `vehicle:write` | Crear/editar vehículos y operar el ciclo de subasta | admin |
| `dashboard:read` | KPIs del dashboard | admin |
| `report:read` | Reportes e inventario | admin |
| `payment:refund` | Reembolsos | admin |
| `audit:read` | Registro de auditoría | admin |

## Capacidades

El servidor publica `tools`, `resources` y `prompts` con `listChanged`. Las
tools de negocio (`chocao_search_vehicles`, `chocao_place_bid`,
`chocao_create_checkout_link`, …) y el resource `catalog://vehicles` se listan
según los scopes concedidos: un token sin scopes admin nunca ve las tools
`admin:*`. Las tools de escritura están anotadas como sensibles para que el
cliente pida confirmación explícita antes de comprometer dinero.

### Resource `catalog://vehicles`

Expone el inventario (primeras 50 entradas activas/publicadas, o con
borradores si el token trae scope `vehicle:write`) como contexto de la
conversación, sin necesidad de invocar una tool en cada turno.

**Limitación conocida**: el transporte es Streamable HTTP en modo
*stateless* (cada request construye una instancia nueva del servidor MCP).
Suscribirse a cambios en tiempo real (`resources/subscribe` +
`notifications/resources/updated`) requiere una sesión persistente con un
stream SSE abierto, que este modo no ofrece — por eso no se anuncia
`subscribe: true`. El cliente debe releer el resource (`resources/read`)
para refrescar el contenido; el catálogo interno ya invalida su caché en
cada cambio de inventario (HU-44), así que una relectura siempre trae datos
al día.

## Variables de entorno relevantes (backend)

| Variable | Uso |
| --- | --- |
| `OAUTH_JWT_SECRET` | Firma de los access tokens (obligatoria en producción) |
| `OAUTH_ISSUER` | URL pública del backend (metadata OAuth); en dev se infiere |
| `ALLOWED_ORIGINS` | CSV de orígenes CORS (agregar el Inspector en dev) |
