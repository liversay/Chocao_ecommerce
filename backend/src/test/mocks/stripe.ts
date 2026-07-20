import { mock } from "bun:test";
import Stripe from "stripe";

// Instancia real SOLO para las utilidades de webhooks (firma/verificación);
// no hace llamadas de red y la clave es un dummy.
const realStripeForWebhooks = new Stripe("sk_test_dummy", { apiVersion: "2026-06-24.dahlia" });

interface FakeSession {
  id: string;
  url: string;
  payment_status: "paid" | "unpaid";
  payment_intent: string;
  metadata?: Record<string, string>;
}

// Mock del singleton de Stripe (src/lib/stripe.ts). Los tests controlan el
// estado de las sesiones con markSessionPaid()/resetStripeMock().
const sessions = new Map<string, FakeSession>();
let counter = 0;

export const stripeMock = {
  // Verificación de firma REAL del SDK: los tests de webhook firman con
  // generateTestHeaderString y el endpoint valida de verdad.
  webhooks: realStripeForWebhooks.webhooks,
  checkout: {
    sessions: {
      create: mock(async (params: { metadata?: Record<string, string> }) => {
        const session: FakeSession = {
          id: `cs_test_${++counter}`,
          url: `https://checkout.stripe.test/pay/${counter}`,
          payment_status: "unpaid",
          payment_intent: `pi_test_${counter}`,
          metadata: params.metadata,
        };
        sessions.set(session.id, session);
        return session;
      }),
      retrieve: mock(async (id: string) => {
        const session = sessions.get(id);
        if (!session) throw new Error(`No such checkout session: ${id}`);
        return session;
      }),
    },
  },
  refunds: {
    create: mock(async (params: { payment_intent: string }) => ({
      id: `re_test_${params.payment_intent}`,
      status: "succeeded",
      payment_intent: params.payment_intent,
    })),
  },
};

export function markSessionPaid(id: string) {
  const session = sessions.get(id);
  if (session) session.payment_status = "paid";
}

export function resetStripeMock() {
  sessions.clear();
  counter = 0;
  stripeMock.checkout.sessions.create.mockClear();
  stripeMock.checkout.sessions.retrieve.mockClear();
  stripeMock.refunds.create.mockClear();
}

mock.module("../../lib/stripe", () => ({ default: stripeMock }));
