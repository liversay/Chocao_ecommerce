import "./mocks/clerk";
import "./mocks/stripe";
import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { Notification } from "../models/Notification";
import { Payment } from "../models/Payment";
import { Watchlist } from "../models/Watchlist";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";
import { markSessionPaid, resetStripeMock } from "./mocks/stripe";
import { notifyClosingSoonWatchers } from "../services/auctions";

setupTestDB();
const app = createApp();
beforeEach(() => resetStripeMock());

describe("notificaciones disparadas por eventos de negocio", () => {
  test("al ser superado, el pujador anterior recibe una notificación outbid", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle({ basePrice: 10_000, currentPrice: 11_000 });
    await createBid(vehicle, ana!, { amount: 11_000 });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(bruno!),
      body: JSON.stringify({ amount: 12_000 }),
    });
    expect(res.status).toBe(201);

    const notifications = await Notification.find({ userId: ana!._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.type).toBe("outbid");
  });

  test("un usuario no se notifica a sí mismo al superar su propia puja anterior", async () => {
    const ana = await createUser();
    const vehicle = await createVehicle({ basePrice: 10_000, currentPrice: 11_000 });
    await createBid(vehicle, ana, { amount: 11_000 });

    const res = await app.request(`/api/bids/vehicle/${vehicle._id}`, {
      method: "POST",
      headers: authHeader(ana),
      body: JSON.stringify({ amount: 12_000 }),
    });
    expect(res.status).toBe(201);

    expect(await Notification.countDocuments({ userId: ana._id })).toBe(0);
  });

  test("el ganador recibe una notificación won al cerrarse la subasta", async () => {
    const [admin, ganador] = await Promise.all([createUser({ role: "admin" }), createUser()]);
    const vehicle = await createVehicle();
    await createBid(vehicle, ganador!, { amount: 15_000 });

    const res = await app.request(`/api/vehicles/${vehicle._id}/status`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ status: "closed" }),
    });
    expect(res.status).toBe(200);

    expect(await Notification.countDocuments({ userId: ganador!._id, type: "won" })).toBe(1);
  });

  test("no duplica la notificación won si el vehículo ya estaba adjudicado", async () => {
    const [admin, ganador] = await Promise.all([createUser({ role: "admin" }), createUser()]);
    const vehicle = await createVehicle();
    await createBid(vehicle, ganador!, { amount: 15_000 });

    await app.request(`/api/vehicles/${vehicle._id}/status`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ status: "closed" }),
    });
    await app.request(`/api/vehicles/${vehicle._id}/status`, {
      method: "PATCH",
      headers: authHeader(admin!),
      body: JSON.stringify({ status: "awarded" }),
    });

    expect(await Notification.countDocuments({ userId: ganador!._id, type: "won" })).toBe(1);
  });

  test("al confirmarse el pago, el comprador recibe payment_confirmed", async () => {
    const buyer = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer, { amount: 12_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(buyer),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });
    expect(checkout.status).toBe(200);
    const payment = (await Payment.findOne({ bidId: bid._id }))!;
    markSessionPaid(payment.stripeSessionId!);

    const confirm = await app.request(`/api/payments/success?session_id=${payment.stripeSessionId}`, {
      headers: authHeader(buyer),
    });
    expect(confirm.status).toBe(200);

    expect(await Notification.countDocuments({ userId: buyer._id, type: "payment_confirmed" })).toBe(1);
  });

  test("al reembolsar, el comprador recibe refunded", async () => {
    const [admin, buyer] = await Promise.all([createUser({ role: "admin" }), createUser()]);
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, buyer!, { amount: 12_000, status: "winner" });

    const checkout = await app.request("/api/payments/create-checkout-session", {
      method: "POST",
      headers: authHeader(buyer!),
      body: JSON.stringify({ bidId: bid._id.toString() }),
    });
    expect(checkout.status).toBe(200);
    const payment = (await Payment.findOne({ bidId: bid._id }))!;
    markSessionPaid(payment.stripeSessionId!);
    await app.request(`/api/payments/success?session_id=${payment.stripeSessionId}`, {
      headers: authHeader(buyer!),
    });

    const refund = await app.request(`/api/payments/${payment._id}/refund`, {
      method: "POST",
      headers: authHeader(admin!),
    });
    expect(refund.status).toBe(200);

    expect(await Notification.countDocuments({ userId: buyer!._id, type: "refunded" })).toBe(1);
  });
});

describe("aviso de subasta por cerrar a quienes la siguen (watchlist)", () => {
  test("notifyClosingSoonWatchers notifica a los watchers y no repite en una segunda corrida", async () => {
    const watcher = await createUser();
    const vehicle = await createVehicle({
      status: "active",
      auctionEndDate: new Date(Date.now() + 30 * 60 * 1000),
    });
    await Watchlist.create({ userId: watcher._id, vehicleId: vehicle._id });

    const firstRun = await notifyClosingSoonWatchers();
    expect(firstRun).toBe(1);
    expect(await Notification.countDocuments({ userId: watcher._id, type: "watch_closing" })).toBe(1);

    const secondRun = await notifyClosingSoonWatchers();
    expect(secondRun).toBe(0);
    expect(await Notification.countDocuments({ userId: watcher._id, type: "watch_closing" })).toBe(1);
  });

  test("no notifica vehículos fuera de la ventana de una hora", async () => {
    const watcher = await createUser();
    const vehicle = await createVehicle({
      status: "active",
      auctionEndDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
    });
    await Watchlist.create({ userId: watcher._id, vehicleId: vehicle._id });

    expect(await notifyClosingSoonWatchers()).toBe(0);
    expect(await Notification.countDocuments({ userId: watcher._id })).toBe(0);
  });
});
