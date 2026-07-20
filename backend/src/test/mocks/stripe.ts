import { mock } from "bun:test";

interface FakeSession {
  id: string;
  url: string;
  payment_status: "paid" | "unpaid";
  metadata?: Record<string, string>;
}

// Mock del singleton de Stripe (src/lib/stripe.ts). Los tests controlan el
// estado de las sesiones con markSessionPaid()/resetStripeMock().
const sessions = new Map<string, FakeSession>();
let counter = 0;

export const stripeMock = {
  checkout: {
    sessions: {
      create: mock(async (params: { metadata?: Record<string, string> }) => {
        const session: FakeSession = {
          id: `cs_test_${++counter}`,
          url: `https://checkout.stripe.test/pay/${counter}`,
          payment_status: "unpaid",
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
}

mock.module("../../lib/stripe", () => ({ default: stripeMock }));
