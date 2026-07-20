import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { __resetSecretForTests } from "../oauth/tokens";
import "../mcp/tools";
import { Vehicle } from "../models/Vehicle";
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

describe("chocao_place_bid (HU-50)", () => {
  test("una puja válida se registra y actualiza el precio del vehículo", async () => {
    const vehicle = await createVehicle({ basePrice: 10_000, currentPrice: 10_000 });
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "bids:write");

    const res = await toolResult<{ bidId: string; currentPrice: number; status: string }>(
      await callTool(app, token, "chocao_place_bid", { vehicleId: vehicle._id.toString(), amount: 12_000 })
    );

    expect(res.isError).toBeUndefined();
    expect(res.data!.currentPrice).toBe(12_000);
    expect((await Vehicle.findById(vehicle._id))!.currentPrice).toBe(12_000);
  });

  test("reaplica las reglas de negocio: monto no mayor al precio actual falla", async () => {
    const vehicle = await createVehicle({ basePrice: 10_000, currentPrice: 10_000 });
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "bids:write");

    const res = await toolResult(
      await callTool(app, token, "chocao_place_bid", { vehicleId: vehicle._id.toString(), amount: 5_000 })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("mayor a la oferta actual");
  });

  test("un vehículo no activo rechaza la puja", async () => {
    const vehicle = await createVehicle({ status: "closed" });
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "bids:write");

    const res = await toolResult(
      await callTool(app, token, "chocao_place_bid", { vehicleId: vehicle._id.toString(), amount: 99_999 })
    );
    expect(res.isError).toBe(true);
  });

  test("sin el scope bids:write la tool falla con 403", async () => {
    const vehicle = await createVehicle();
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "catalog:read");

    const res = await toolResult(
      await callTool(app, token, "chocao_place_bid", { vehicleId: vehicle._id.toString(), amount: 99_999 })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("403");
  });

  test("la tool queda anotada como destructiva (requiere confirmación)", async () => {
    const user = await createUser();
    const token = await obtainAccessToken(app, user, "bids:write");

    const res = await app.request("/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    const text = await res.text();
    const json = text.includes("\ndata: ") ? text.split("\n").find((l) => l.startsWith("data: "))!.slice(6) : text;
    const list = (JSON.parse(json) as { result: { tools: Array<{ name: string; annotations?: { destructiveHint?: boolean } }> } }).result;
    const tool = list.tools.find((t) => t.name === "chocao_place_bid");
    expect(tool?.annotations?.destructiveHint).toBe(true);
  });
});

describe("chocao_create_checkout_link (HU-53)", () => {
  test("genera la url de pago de una puja ganadora propia", async () => {
    const user = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, user, { amount: 12_000, status: "winner" });
    const token = await obtainAccessToken(app, user, "payments:write");

    const res = await toolResult<{ url: string }>(
      await callTool(app, token, "chocao_create_checkout_link", { bidId: bid._id.toString() })
    );
    expect(res.isError).toBeUndefined();
    expect(res.data!.url).toContain("https://");
  });

  test("no procede sobre una puja ajena (403)", async () => {
    const [ana, bruno] = await Promise.all([createUser(), createUser()]);
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, ana, { amount: 12_000, status: "winner" });
    const token = await obtainAccessToken(app, bruno, "payments:write");

    const res = await toolResult(
      await callTool(app, token, "chocao_create_checkout_link", { bidId: bid._id.toString() })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("403");
  });

  test("no procede si el bid no está en estado winner", async () => {
    const user = await createUser();
    const vehicle = await createVehicle();
    const bid = await createBid(vehicle, user, { amount: 12_000, status: "active" });
    const token = await obtainAccessToken(app, user, "payments:write");

    const res = await toolResult(
      await callTool(app, token, "chocao_create_checkout_link", { bidId: bid._id.toString() })
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("ganadora");
  });
});
