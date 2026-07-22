import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { setupTestDB } from "./db";
import { authHeader, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

// Parser mínimo de SSE: junta chunks hasta acumular `count` eventos completos
// (separados por línea en blanco) y cierra el reader — dispara stream.onAbort()
// del lado del servidor, igual que una desconexión real de un cliente.
async function readSSEEvents(res: Response, count: number): Promise<Array<{ event?: string; data: string }>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Array<{ event?: string; data: string }> = [];

  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let eventName: string | undefined;
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) eventName = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      events.push({ event: eventName, data });
    }
  }

  await reader.cancel();
  return events;
}

describe("GET /api/events (SSE)", () => {
  test("responde text/event-stream con un evento hello inicial", async () => {
    const res = await app.request("/api/events");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const [hello] = await readSSEEvents(res, 1);
    expect(hello!.event).toBe("hello");
    expect(JSON.parse(hello!.data)).toEqual({ unreadCount: 0 });
  });

  test("un visitante anónimo recibe bid.placed en vivo (canal público)", async () => {
    const vehicle = await createVehicle({ basePrice: 10_000 });
    const bidder = await createUser();

    const res = await app.request("/api/events");
    const pending = readSSEEvents(res, 2); // hello + bid.placed

    const bidRes = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(bidder),
      body: JSON.stringify({ amount: 11_000 }),
    });
    expect(bidRes.status).toBe(201);

    const events = await pending;
    expect(events[0]!.event).toBe("hello");
    const bidPlaced = events.find((e) => e.event === "bid.placed");
    expect(bidPlaced).toBeDefined();
    expect(JSON.parse(bidPlaced!.data)).toMatchObject({
      vehicleId: vehicle._id.toString(),
      currentPrice: 11_000,
      amount: 11_000,
    });
  });

  test("el usuario superado recibe su notificación 'outbid' en tiempo real (canal personal)", async () => {
    const vehicle = await createVehicle({ basePrice: 10_000 });
    const [loser, winner] = await Promise.all([createUser(), createUser()]);

    // El futuro perdedor puja primero para tener una posición activa a superar.
    const firstBid = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(loser!),
      body: JSON.stringify({ amount: 11_000 }),
    });
    expect(firstBid.status).toBe(201);

    const res = await app.request("/api/events", { headers: authHeader(loser!) });
    // hello + bid.placed (canal público, también le llega) + notification
    const pending = readSSEEvents(res, 3);

    const secondBid = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(winner!),
      body: JSON.stringify({ amount: 12_000 }),
    });
    expect(secondBid.status).toBe(201);

    const events = await pending;
    const notification = events.find((e) => e.event === "notification");
    expect(notification).toBeDefined();
    expect(JSON.parse(notification!.data)).toMatchObject({
      type: "outbid",
      data: { vehicleId: vehicle._id.toString() },
    });
  });
});
