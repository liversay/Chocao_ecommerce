import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { MemoryRateLimitStore, rateLimit } from "./rateLimit";

function makeApp(max: number, windowMs = 60_000) {
  const app = new Hono<AppEnv>();
  app.use("*", rateLimit({ name: "test", max, windowMs, store: new MemoryRateLimitStore() }));
  app.get("/x", (c) => c.json({ ok: true }));
  return app;
}

describe("MemoryRateLimitStore", () => {
  test("cuenta dentro de la ventana y reinicia al expirar", async () => {
    const store = new MemoryRateLimitStore();
    expect(store.hit("k", 50).count).toBe(1);
    expect(store.hit("k", 50).count).toBe(2);
    await Bun.sleep(60);
    expect(store.hit("k", 50).count).toBe(1);
  });

  test("aísla los contadores por clave", () => {
    const store = new MemoryRateLimitStore();
    store.hit("a", 1000);
    expect(store.hit("b", 1000).count).toBe(1);
  });
});

describe("rateLimit middleware", () => {
  test("permite hasta max y responde 429 con Retry-After al excederse", async () => {
    const app = makeApp(3);
    const headers = { "x-forwarded-for": "10.0.0.1" };
    for (let i = 0; i < 3; i++) {
      expect((await app.request("/x", { headers })).status).toBe(200);
    }
    const res = await app.request("/x", { headers });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(((await res.json()) as { error: string }).error).toContain("Demasiadas peticiones");
  });

  test("IPs distintas no comparten contador", async () => {
    const app = makeApp(1);
    expect((await app.request("/x", { headers: { "x-forwarded-for": "10.0.0.1" } })).status).toBe(200);
    expect((await app.request("/x", { headers: { "x-forwarded-for": "10.0.0.2" } })).status).toBe(200);
    expect((await app.request("/x", { headers: { "x-forwarded-for": "10.0.0.1" } })).status).toBe(429);
  });

  test("la ventana expira y vuelve a permitir peticiones", async () => {
    const app = makeApp(1, 50);
    const headers = { "x-forwarded-for": "10.0.0.9" };
    expect((await app.request("/x", { headers })).status).toBe(200);
    expect((await app.request("/x", { headers })).status).toBe(429);
    await Bun.sleep(60);
    expect((await app.request("/x", { headers })).status).toBe(200);
  });
});
