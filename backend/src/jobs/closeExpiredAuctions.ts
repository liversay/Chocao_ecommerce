import { logger } from "../lib/logger";
import { closeExpiredAuctions } from "../services/auctions";

// Job liviano sin dependencias: revisa cada minuto si hay subastas activas
// vencidas y las cierra/adjudica. La idempotencia vive en el servicio (claim
// atómico), así que un tick duplicado o un reinicio no adjudican dos veces.
export function startAuctionCloser(intervalMs = 60_000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const closed = await closeExpiredAuctions();
      if (closed > 0) logger.info("job de cierre de subastas", { closed });
    } catch (err) {
      logger.error("el job de cierre de subastas falló", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  void tick();
  return setInterval(tick, intervalMs);
}
