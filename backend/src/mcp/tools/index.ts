// Barrel de tools MCP: cada archivo se registra en el registry (HU-59) al
// importarse por su efecto secundario. Importar este módulo una sola vez
// (mcp/index.ts) basta para exponer todas las tools de negocio.
import "./searchVehicles";
import "./getVehicle";
import "./getBidHistory";
import "./getMyBids";
import "./getMyPurchases";
import "./placeBid";
