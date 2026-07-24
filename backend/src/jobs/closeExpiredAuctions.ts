import { logger } from "../lib/logger";
import { closeExpiredAuctions, notifyClosingSoonWatchers, procesarIncumplimientos } from "../services/auctions";

// Job liviano sin dependencias: revisa cada minuto si hay subastas activas
// vencidas y las cierra/adjudica, avisa a quienes siguen (watchlist) las que
// están por cerrar dentro de la próxima hora, y procesa las adjudicaciones
// cuyo plazo legal de pago venció (RP-04/RP-05). Los tres pasos son
// idempotentes en el servicio (claim atómico), así que un tick duplicado o
// un reinicio no repiten adjudicaciones, avisos ni sanciones.
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

    try {
      const procesados = await procesarIncumplimientos();
      if (procesados > 0) logger.info("job de incumplimientos de pago", { procesados });
    } catch (err) {
      logger.error("el job de incumplimientos falló", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  void tick();
  return setInterval(tick, intervalMs);
}
