import { logger } from "../lib/logger";
import { closeExpiredAuctions, notifyClosingSoonWatchers } from "../services/auctions";

// Job liviano sin dependencias: revisa cada minuto si hay subastas activas
// vencidas y las cierra/adjudica, y además avisa a quienes siguen (watchlist)
// las que están por cerrar dentro de la próxima hora. Ambos pasos son
// idempotentes en el servicio (claim atómico), así que un tick duplicado o
// un reinicio no repiten adjudicaciones ni avisos.
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

    try {
      await notifyClosingSoonWatchers();
    } catch (err) {
      logger.error("el chequeo de watchlist por cierre falló", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  void tick();
  return setInterval(tick, intervalMs);
}
