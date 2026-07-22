import { describe, expect, test } from "bun:test";
import { setupTestDB } from "../test/db";
import { createBid, createUser, createVehicle } from "../test/factories";
import { Payment } from "../models/Payment";
import { getAnalytics } from "./dashboard";

setupTestDB();

describe("getAnalytics", () => {
  test("agrega ingresos y pujas por día, y calcula métricas derivadas", async () => {
    const [buyer1, buyer2] = await Promise.all([createUser(), createUser()]);
    const vehicle1 = await createVehicle({ status: "awarded" });
    const vehicle2 = await createVehicle({ status: "published" });
    await createBid(vehicle1, buyer1, { amount: 10_000 });
    await createBid(vehicle2, buyer2, { amount: 5_000 });

    await Payment.create({
      userId: buyer1._id,
      vehicleId: vehicle1._id,
      bidId: (await createBid(vehicle1, buyer1, { amount: 10_500 }))._id,
      amount: 10_000,
      status: "paid",
    });
    await Payment.create({
      userId: buyer2._id,
      vehicleId: vehicle2._id,
      bidId: (await createBid(vehicle2, buyer2, { amount: 6_000 }))._id,
      amount: 3_000,
      status: "refunded",
    });

    const analytics = await getAnalytics();

    expect(analytics.revenueByDay.length).toBeGreaterThan(0);
    expect(analytics.revenueByDay[0]!.value).toBe(10_000);
    expect(analytics.bidsByDay.length).toBeGreaterThan(0);
    expect(analytics.averageTicket).toBe(10_000);
    expect(analytics.totalRefunded).toBe(3_000);
    expect(analytics.uniqueBuyers).toBe(1);
    expect(analytics.adjudicationRate).toBeCloseTo(0.5, 5);
    expect(analytics.vehiclesByStatus.length).toBeGreaterThan(0);
  });

  test("sin datos, devuelve ceros sin lanzar", async () => {
    const analytics = await getAnalytics();
    expect(analytics.averageTicket).toBe(0);
    expect(analytics.totalRefunded).toBe(0);
    expect(analytics.uniqueBuyers).toBe(0);
    expect(analytics.adjudicationRate).toBe(0);
  });
});
