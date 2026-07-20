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

const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const value = getStripe()[prop as keyof Stripe];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});

export default stripe;
