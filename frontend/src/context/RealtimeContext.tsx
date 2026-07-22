import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source";
import type { RealtimeEventPayloads, RealtimeEventType, RealtimeHandler } from "../lib/realtime";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface RealtimeContextValue {
  /** Snapshot de no-leídas recibido en cada conexión/reconexión ("hello"). */
  unreadCount: number;
  subscribe: <T extends RealtimeEventType>(type: T, handler: RealtimeHandler<T>) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// Una única conexión SSE compartida por toda la app a /api/events (backend/src/routes/events.ts).
// Auth opcional: sin sesión Clerk igual se reciben los eventos públicos de
// subasta (bid.placed, vehicle.*); con sesión, además los personales
// (notification, watchlist.updated) y, si es admin, los de backoffice
// (order.updated, user.updated) — el backend decide qué manda según el token.
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const listenersRef = useRef(new Map<RealtimeEventType, Set<(payload: unknown) => void>>());

  const subscribe = useCallback(<T extends RealtimeEventType>(type: T, handler: RealtimeHandler<T>) => {
    const listeners = listenersRef.current;
    let set = listeners.get(type);
    if (!set) {
      set = new Set();
      listeners.set(type, set);
    }
    const wrapped = handler as (payload: unknown) => void;
    set.add(wrapped);
    return () => {
      set!.delete(wrapped);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const controller = new AbortController();
    let stopped = false;

    function handleMessage(msg: { event?: string; data: string }) {
      if (!msg.event || msg.event === "ping") return;

      if (msg.event === "hello") {
        try {
          const hello = JSON.parse(msg.data) as { unreadCount: number };
          setUnreadCount(hello.unreadCount);
        } catch {
          /* payload malformado: ignorar */
        }
        return;
      }

      const type = msg.event as RealtimeEventType;
      const handlers = listenersRef.current.get(type);
      if (!handlers || handlers.size === 0) return;
      try {
        const payload = JSON.parse(msg.data) as RealtimeEventPayloads[typeof type];
        handlers.forEach((handler) => handler(payload));
      } catch {
        /* payload malformado: ignorar */
      }
    }

    // fetchEventSource fija los headers de la conexión al abrirla — no los
    // vuelve a pedir en sus reintentos internos. Como el token de Clerk es de
    // corta duración, envolvemos cada intento en nuestro propio bucle: cada
    // vez que la conexión se cae (o el JWT expira a mitad de sesión),
    // relanzamos el error desde onerror para salir del await y reconectar
    // con un token recién pedido.
    const BASE_RETRY_MS = 1000;
    const MAX_RETRY_MS = 30_000;

    async function connect() {
      let attempt = 0;
      while (!stopped && !controller.signal.aborted) {
        try {
          const headers: Record<string, string> = {};
          if (isSignedIn) {
            const token = await getToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          }

          await fetchEventSource(`${BASE_URL}/api/events`, {
            signal: controller.signal,
            headers,
            openWhenHidden: true, // una subasta puede cerrar mientras la pestaña está en segundo plano
            async onopen(response) {
              if (response.ok && response.headers.get("content-type")?.startsWith(EventStreamContentType)) {
                attempt = 0; // conexión sana: el próximo corte reintenta desde el delay base
                return;
              }
              throw new Error(`SSE handshake inesperado (status ${response.status})`);
            },
            onmessage: handleMessage,
            onerror(err) {
              throw err; // relanzar: sale del await de abajo y reconecta con token fresco
            },
          });
        } catch (err) {
          if (controller.signal.aborted) return;
          // Backoff exponencial (1s, 2s, 4s… tope 30s) en vez de un intervalo
          // fijo: un reintento cada 3s en loop puede, con varias pestañas o
          // visitantes anónimos detrás del mismo NAT, agotar el límite propio
          // de esta ruta (routes/events.ts) sin que nadie esté abusando.
          attempt += 1;
          const delay = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** (attempt - 1));
          console.error(`[realtime] conexión SSE interrumpida, reintentando en ${delay}ms`, err);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    connect();
    return () => {
      stopped = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getToken cambia de identidad en cada render de Clerk
  }, [isLoaded, isSignedIn]);

  return <RealtimeContext.Provider value={{ unreadCount, subscribe }}>{children}</RealtimeContext.Provider>;
}

// El hook de acceso vive junto a su Provider por cohesión (mismo criterio que
// useAuth/useUser en clerkStub.tsx); el disable de abajo solo cambia el
// fast-refresh de este archivo a full-reload, sin efecto en runtime.
// eslint-disable-next-line react-refresh/only-export-components
export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime debe usarse dentro de <RealtimeProvider>");
  return ctx;
}
