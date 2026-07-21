import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { metrics } from "../lib/metrics";

beforeEach(() => metrics.reset());

describe("health checks", () => {
  test("GET /health responde ok (liveness)", async () => {
    const res = await createApp().request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; uptimeSeconds: number };
    expect(body.status).toBe("ok");
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  test("GET /ready responde 503 cuando MongoDB no está conectado", async () => {
    // En el entorno de test no hay conexión a Mongo
    const res = await createApp().request("/ready");
    expect(res.status).toBe(503);
    expect(((await res.json()) as { mongo: string }).mongo).toBe("down");
  });

  test("GET /metrics expone contadores en formato Prometheus", async () => {
    const app = createApp();
    await app.request("/health");
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("http_requests_total{method=\"GET\",status=\"200\"}");
    expect(text).toContain("http_request_duration_ms_count");
    expect(text).toContain("process_uptime_seconds");
  });

  test("las métricas acumulan entre requests", async () => {
    const app = createApp();
    await app.request("/health");
    await app.request("/health");
    const text = await (await app.request("/metrics")).text();
    const match = text.match(/http_requests_total\{method="GET",status="200"\} (\d+)/);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(2);
  });
});
