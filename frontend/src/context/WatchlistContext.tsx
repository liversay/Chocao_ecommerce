import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { useApi } from "../hooks/useApi";
import { useRealtime } from "./RealtimeContext";

interface WatchlistContextValue {
  isSaved: (vehicleId: string) => boolean;
  toggle: (vehicleId: string) => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

// Estado de la watchlist compartido por toda la app: un solo GET /api/watchlist
// al montar (en vez de que cada WatchlistButton en un grid de N tarjetas pida
// lo mismo por su cuenta) para que todos los corazones ya guardados aparezcan
// en rojo a la vez, no uno por uno a medida que resuelven N requests idénticos.
export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const { subscribe } = useRealtime();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const requestIdsRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setSavedIds(new Set());
      return;
    }
    let cancelled = false;
    api
      .get("/api/watchlist")
      .then((r) => {
        if (cancelled) return;
        const items = r.data as { vehicleId: { _id: string } }[];
        setSavedIds(new Set(items.map((i) => i.vehicleId?._id).filter((id): id is string => !!id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  // Otras pestañas/dispositivos del mismo usuario tocando la watchlist llegan
  // por el mismo evento realtime que ya usaba WatchlistBell.
  useEffect(() => {
    return subscribe("watchlist.updated", (payload) => {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (payload.action === "added") next.add(payload.vehicleId);
        else next.delete(payload.vehicleId);
        return next;
      });
    });
  }, [subscribe]);

  const isSaved = useCallback((vehicleId: string) => savedIds.has(vehicleId), [savedIds]);

  const toggle = useCallback(
    (vehicleId: string) => {
      const next = !savedIds.has(vehicleId);
      setSavedIds((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(vehicleId);
        else copy.delete(vehicleId);
        return copy;
      });

      const myRequestId = (requestIdsRef.current.get(vehicleId) || 0) + 1;
      requestIdsRef.current.set(vehicleId, myRequestId);

      const request = next ? api.post(`/api/watchlist/${vehicleId}`) : api.delete(`/api/watchlist/${vehicleId}`);
      request.catch(() => {
        if (requestIdsRef.current.get(vehicleId) !== myRequestId) return;
        setSavedIds((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(vehicleId);
          else copy.add(vehicleId);
          return copy;
        });
      });
    },
    [savedIds, api]
  );

  return <WatchlistContext.Provider value={{ isSaved, toggle }}>{children}</WatchlistContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist debe usarse dentro de <WatchlistProvider>");
  return ctx;
}
