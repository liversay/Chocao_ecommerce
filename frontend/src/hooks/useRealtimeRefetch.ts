import { useEffect, useRef } from "react";
import { useRealtime } from "../context/RealtimeContext";
import type { RealtimeEventType } from "../lib/realtime";

// Backoffice: en vez de parchear cada tabla evento a evento, simplemente
// vuelve a pedir los datos de la página cuando llega cualquiera de los
// eventos indicados — con debounce para no disparar un fetch por cada
// evento si llegan varios casi simultáneos (p. ej. varias pujas seguidas).
export function useRealtimeRefetch(types: RealtimeEventType[], refetch: () => void, debounceMs = 800): void {
  const { subscribe } = useRealtime();
  const refetchRef = useRef(refetch);
  // No mutar el ref durante el render (regla react-hooks/refs) — se
  // sincroniza en un efecto que corre en cada render.
  useEffect(() => {
    refetchRef.current = refetch;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refetchRef.current(), debounceMs);
    };
    const unsubscribers = types.map((type) => subscribe(type, scheduleRefetch));
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // types se pasa como array literal en cada render en los call sites; nos
    // resuscribimos solo si su contenido (no la referencia) cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, types.join(","), debounceMs]);
}
