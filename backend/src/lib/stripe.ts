import Stripe from "stripe";

// Singleton lazy: la instancia se crea en el primer uso, no al importar el
// módulo. Así los tests (que mockean este módulo) y el typecheck no exigen
// STRIPE_SECRET_KEY en el entorno.
let instance: Stripe | null = null;

function getStripe(): Stripe {
  if (!instance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not defined");
    }
    instance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return instance;
}

// Modo E2E (Playwright): implementación fake compatible con los usos reales
// del código (checkout.sessions.create/retrieve, refunds.create). La URL de
// checkout apunta directo al /checkout/success del frontend con la sesión ya
// "pagada", así el ciclo compra→confirmación→recibo corre completo sin red.
// Jamás activo sin E2E=1 explícito.
function createE2EStripe(): Stripe {
  const sessions = new Map<string, { id: string; url: string; payment_status: string; payment_intent: string }>();
  let counter = 0;

  return {
    checkout: {
      sessions: {
        create: async () => {
          counter += 1;
          const id = `cs_e2e_${counter}`;
          const session = {
            id,
            url: `${process.env.STRIPE_SUCCESS_URL}?session_id=${id}`,
            payment_status: "paid",
            payment_intent: `pi_e2e_${counter}`,
          };
          sessions.set(id, session);
          return session;
        },
        retrieve: async (id: string) => {
          // Ids desconocidos (p. ej. pagos sembrados por el seed E2E) se
          // resuelven como sesiones pagadas sintéticas, para que flujos como
          // el reembolso funcionen sobre datos pre-cargados.
          return (
            sessions.get(id) ?? {
              id,
              url: `${process.env.STRIPE_SUCCESS_URL}?session_id=${id}`,
              payment_status: "paid",
              payment_intent: `pi_${id}`,
            }
          );
        },
      },
    },
    refunds: {
      create: async (params: { payment_intent: string }) => ({
        id: `re_e2e_${params.payment_intent}`,
        status: "succeeded",
      }),
    },
    webhooks: {
      constructEventAsync: async () => {
        throw new Error("webhooks no disponibles en modo E2E");
      },
    },
  } as unknown as Stripe;
}

let e2eInstance: Stripe | null = null;

// La decisión E2E-vs-real se toma EN CADA ACCESO, no al cargar el módulo:
// los imports de ESM se ejecutan antes que cualquier statement del entry
// point, así que un `process.env.E2E = "1"` en scripts/e2e-server.ts aún no
// existe cuando este módulo se evalúa.
const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (process.env.E2E === "1") {
      if (!e2eInstance) e2eInstance = createE2EStripe();
      return e2eInstance[prop as keyof Stripe];
    }
    const value = getStripe()[prop as keyof Stripe];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});

export default stripe;
