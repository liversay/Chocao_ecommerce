import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { __resetSecretForTests } from "../oauth/tokens";
import "../mcp/tools";
import { setupTestDB } from "./db";
import { createBid, createUser, createVehicle } from "./factories";
import { obtainAccessToken } from "./oauthFlow";
import { callTool, toolResult } from "./mcpRpc";
import { createApp } from "../app";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();
});

describe("chocao_search_vehicles (HU-47)", () => {
  test("un customer busca el catálogo público sin ver borradores", async () => {
    await createVehicle({ title: "Toyota público", status: "active" });
    await createVehicle({ title: "Borrador oculto", status: "draft" });

    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{ items: Array<{ title: string; status: string }>; total: number }>(
      await callTool(app, token, "chocao_search_vehicles", {})
    );
    expect(res.isError).toBeUndefined();
    expect(res.data!.items.some((v) => v.status === "draft")).toBe(false);
  });

  test("un admin (scope vehicle:write) puede filtrar borradores explícitamente", async () => {
    await createVehicle({ title: "Borrador admin", status: "draft" });
    const admin = await createUser({ role: "admin" });
    const token = await obtainAccessToken(app, admin, "catalog:read vehicle:write");

    const res = await toolResult<{ items: Array<{ status: string }> }>(
      await callTool(app, token, "chocao_search_vehicles", { status: "all" })
    );
    expect(res.isError).toBeUndefined();
    expect(Array.isArray(res.data!.items)).toBe(true);
  });

  test("filtra por texto y marca igual que el endpoint REST", async () => {
    await createVehicle({ title: "Hilux especial", brand: "Toyota" });
    await createVehicle({ title: "Frontier normal", brand: "Nissan" });

    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{ total: number }>(
      await callTool(app, token, "chocao_search_vehicles", { q: "hilux" })
    );
    expect(res.data!.total).toBe(1);
  });

  test("sin el scope catalog:read la tool falla con 403", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "payments:write");

    const res = await toolResult(await callTool(app, token, "chocao_search_vehicles", {}));
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("403");
  });
});

describe("chocao_get_vehicle (HU-48)", () => {
  test("devuelve el detalle con segundos restantes y acceptsBids", async () => {
    const vehicle = await createVehicle({
      status: "active",
      auctionEndDate: new Date(Date.now() + 60_000),
    });
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{ remainingSeconds: number; acceptsBids: boolean; status: string }>(
      await callTool(app, token, "chocao_get_vehicle", { vehicleId: vehicle._id.toString() })
    );
    expect(res.isError).toBeUndefined();
    expect(res.data!.status).toBe("active");
    expect(res.data!.acceptsBids).toBe(true);
    expect(res.data!.remainingSeconds).toBeGreaterThan(0);
  });

  test("una subasta cerrada no acepta pujas", async () => {
    const vehicle = await createVehicle({ status: "closed" });
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{ acceptsBids: boolean }>(
      await callTool(app, token, "chocao_get_vehicle", { vehicleId: vehicle._id.toString() })
    );
    expect(res.data!.acceptsBids).toBe(false);
  });

  test("un vehículo inexistente responde 404 estructurado", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");
    const fakeId = "64b5f0c8a2f4e1d9c3b7a611";

    const res = await toolResult(await callTool(app, token, "chocao_get_vehicle", { vehicleId: fakeId }));
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("404");
  });

  test("un borrador no es visible sin scope vehicle:write", async () => {
    const vehicle = await createVehicle({ status: "draft" });
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult(
      await callTool(app, token, "chocao_get_vehicle", { vehicleId: vehicle._id.toString() })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("404");
  });

  test("un id con formato inválido se rechaza por Zod, no revienta con CastError", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult(
      await callTool(app, token, "chocao_get_vehicle", { vehicleId: "no-es-un-id" })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("Argumentos inválidos");
  });
});

describe("chocao_get_bid_history (HU-49)", () => {
  test("devuelve el historial ordenado por monto sin exponer identidad de los postores", async () => {
    const vehicle = await createVehicle({ basePrice: 10_000, currentPrice: 15_000 });
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    await createBid(vehicle, ana, { amount: 11_000, status: "outbid" });
    await createBid(vehicle, bruno, { amount: 15_000, status: "active" });

    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");

    const res = await toolResult<{
      currentPrice: number;
      highestBid: number;
      bids: Array<Record<string, unknown>>;
      total: number;
    }>(await callTool(app, token, "chocao_get_bid_history", { vehicleId: vehicle._id.toString() }));

    expect(res.isError).toBeUndefined();
    expect(res.data!.currentPrice).toBe(15_000);
    expect(res.data!.highestBid).toBe(15_000);
    expect(res.data!.total).toBe(2);
    expect(res.data!.bids[0]!.amount).toBe(15_000);
    // Nunca se expone userId, nombre o email de quien pujó
    for (const bid of res.data!.bids) {
      expect(bid.userId).toBeUndefined();
      expect(bid.name).toBeUndefined();
      expect(bid.email).toBeUndefined();
    }
  });

  test("un vehículo inexistente responde 404", async () => {
    const customer = await createUser();
    const token = await obtainAccessToken(app, customer, "catalog:read");
    const res = await toolResult(
      await callTool(app, token, "chocao_get_bid_history", { vehicleId: "64b5f0c8a2f4e1d9c3b7a611" })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("404");
  });

  test("pagina el historial", async () => {
    const vehicle = await createVehicle();
    const user = await createUser();
    for (let i = 0; i < 5; i++) {
      await createBid(vehicle, user, { amount: 10_000 + i * 100, status: "outbid" });
    }
    const token = await obtainAccessToken(app, user, "catalog:read");

    const res = await toolResult<{ bids: unknown[]; pages: number }>(
      await callTool(app, token, "chocao_get_bid_history", { vehicleId: vehicle._id.toString(), limit: 2 })
    );
    expect(res.data!.bids.length).toBe(2);
    expect(res.data!.pages).toBe(3);
  });
});

describe("chocao_get_my_bids (HU-51)", () => {
  test("solo devuelve las pujas del usuario dueño del token, con requiresPayment en las ganadoras", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle();
    await createBid(vehicle, ana, { amount: 12_000, status: "winner" });
    await createBid(vehicle, bruno, { amount: 13_000, status: "active" });

    const token = await obtainAccessToken(app, ana, "bids:read");
    const res = await toolResult<{
      bids: Array<{ amount: number; status: string; requiresPayment: boolean; vehicle: { title: string } }>;
    }>(await callTool(app, token, "chocao_get_my_bids", {}));

    expect(res.isError).toBeUndefined();
    expect(res.data!.bids.length).toBe(1);
    expect(res.data!.bids[0]!.amount).toBe(12_000);
    expect(res.data!.bids[0]!.requiresPayment).toBe(true);
    expect(res.data!.bids[0]!.vehicle.title).toBeDefined();
  });

  test("sin pujas devuelve una lista vacía, no un error", async () => {
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "bids:read");
    const res = await toolResult<{ bids: unknown[] }>(await callTool(app, token, "chocao_get_my_bids", {}));
    expect(res.isError).toBeUndefined();
    expect(res.data!.bids).toEqual([]);
  });
});

describe("chocao_get_my_purchases (HU-52)", () => {
  test("solo devuelve los bids paid del usuario, con la referencia de pago", async () => {
    const { Payment } = await import("../models/Payment");
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle();
    const misPagada = await createBid(vehicle, ana, { amount: 12_000, status: "paid" });
    await createBid(vehicle, ana, { amount: 9_000, status: "outbid" }); // no es compra
    await createBid(vehicle, bruno, { amount: 20_000, status: "paid" }); // de otro usuario

    await Payment.create({
      userId: ana._id,
      vehicleId: vehicle._id,
      bidId: misPagada._id,
      stripeSessionId: "cs_test_purchase",
      amount: 12_000,
      status: "paid",
    });

    const token = await obtainAccessToken(app, ana, "bids:read");
    const res = await toolResult<{
      purchases: Array<{ amount: number; vehicle: { title: string }; payment: { status: string } }>;
    }>(await callTool(app, token, "chocao_get_my_purchases", {}));

    expect(res.isError).toBeUndefined();
    expect(res.data!.purchases.length).toBe(1);
    expect(res.data!.purchases[0]!.amount).toBe(12_000);
    expect(res.data!.purchases[0]!.payment.status).toBe("paid");
  });

  test("sin compras devuelve una lista vacía", async () => {
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "bids:read");
    const res = await toolResult<{ purchases: unknown[] }>(
      await callTool(app, token, "chocao_get_my_purchases", {})
    );
    expect(res.data!.purchases).toEqual([]);
  });
});
