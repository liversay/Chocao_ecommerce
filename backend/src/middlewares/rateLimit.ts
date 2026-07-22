import type { Context, Next } from "hono";
import type { AppEnv } from "../types";

// Store de contadores con ventana fija. La interfaz permite sustituir la
// implementación en memoria por una compartida (Redis) sin tocar el
// middleware cuando haya múltiples instancias.
export interface RateLimitStore {
  hit(key: string, windowMs: number): { count: number; resetAt: number };
}

interface Window {
  count: number;
  resetAt: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private windows = new Map<string, Window>();

  hit(key: string, windowMs: number): Window {
    const now = Date.now();
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.windows.set(key, fresh);
      if (this.windows.size > 10_000) this.prune(now);
      return fresh;
    }
    current.count += 1;
    return current;
  }

  private prune(now: number) {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }

  /** Solo para tests: limpia todos los contadores. */
  reset() {
    this.windows.clear();
  }
}

export const defaultStore = new MemoryRateLimitStore();

// Variante reutilizable fuera del ciclo de vida de una request Hono (p. ej.
// invocaciones de tools MCP, que no pasan por el middleware HTTP). Devuelve
// si la petición debe rechazarse y los segundos de espera sugeridos.
export function hitRateLimit(
  key: string,
  max: number,
  windowMs = 60_000,
  store: RateLimitStore = defaultStore
): { limited: boolean; retryAfterSeconds: number } {
  const { count, resetAt } = store.hit(key, windowMs);
  return {
    limited: count > max,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
}

export interface RateLimitOptions {
  /** Nombre del límite: aísla los contadores por ruta/grupo. */
  name: string;
  /** Máximo de peticiones dentro de la ventana. */
  max: number;
  /** Tamaño de la ventana en ms (por defecto 1 minuto). */
  windowMs?: number;
  store?: RateLimitStore;
  /**
   * Excluye ciertas peticiones del contador global. Pensado para /api/events
   * (SSE): es una conexión larga, no una ráfaga de requests, y no debe
   * compartir presupuesto con el resto de la API — tiene su propio límite,
   * más generoso, en routes/events.ts.
   */
  skip?: (c: Context<AppEnv>) => boolean;
}

function clientIp(c: Context<AppEnv>): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return c.req.header("x-real-ip") ?? "ip-desconocida";
}

// Límite por usuario autenticado (si el middleware corre después de auth) o
// por IP. Al excederse responde 429 con Retry-After en segundos.
export function rateLimit({ name, max, windowMs = 60_000, store = defaultStore, skip }: RateLimitOptions) {
  return async (c: Context<AppEnv>, next: Next) => {
    if (skip?.(c)) return next();

    const user = c.get("user");
    const subject = user ? `u:${user._id.toString()}` : `ip:${clientIp(c)}`;
    const { count, resetAt } = store.hit(`${name}:${subject}`, windowMs);

    if (count > max) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json(
        { error: "Demasiadas peticiones; intenta de nuevo en unos segundos" },
        429
      );
    }
    await next();
  };
}
