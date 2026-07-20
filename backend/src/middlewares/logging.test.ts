import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { log } from "../lib/logger";
import type { AppEnv } from "../types";
import { httpLogger, requestId } from "./logging";

function makeApp() {
  const app = new Hono<AppEnv>();
  app.use("*", requestId);
  app.use("*", httpLogger);
  app.get("/ping", (c) => c.json({ ok: true }));
  return app;
}

afterEach(() => {
  delete process.env.LOG_LEVEL;
});

describe("requestId", () => {
  test("genera un X-Request-Id cuando el cliente no envía uno", async () => {
    const res = await makeApp().request("/ping");
    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("propaga el X-Request-Id entrante si es válido", async () => {
    const res = await makeApp().request("/ping", {
      headers: { "X-Request-Id": "front-abc-123" },
    });
    expect(res.headers.get("X-Request-Id")).toBe("front-abc-123");
  });

  test("descarta ids con formato sospechoso y genera uno propio", async () => {
    const res = await makeApp().request("/ping", {
      headers: { "X-Request-Id": "abc {inyección}" },
    });
    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("httpLogger", () => {
  test("emite una línea JSON con requestId, método, ruta, status y duración", async () => {
    const spy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await makeApp().request("/ping", { headers: { "X-Request-Id": "req-12345678" } });
      const line = spy.mock.calls.map((c) => String(c[0])).find((l) => l.includes('"http"'));
      expect(line).toBeDefined();
      const entry = JSON.parse(line!);
      expect(entry).toMatchObject({
        level: "info",
        message: "http",
        requestId: "req-12345678",
        method: "GET",
        path: "/ping",
        status: 200,
      });
      expect(typeof entry.durationMs).toBe("number");
      expect(typeof entry.timestamp).toBe("string");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("log levels", () => {
  test("respeta LOG_LEVEL: debug se silencia con nivel info", () => {
    const spy = spyOn(console, "log").mockImplementation(() => {});
    try {
      process.env.LOG_LEVEL = "info";
      log("debug", "invisible");
      expect(spy.mock.calls.length).toBe(0);
      process.env.LOG_LEVEL = "debug";
      log("debug", "visible");
      expect(spy.mock.calls.length).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
