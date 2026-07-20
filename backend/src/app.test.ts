import { afterEach, describe, expect, test } from "bun:test";
import { createApp } from "./app";

afterEach(() => {
  delete process.env.ALLOWED_ORIGINS;
});

describe("endurecimiento HTTP", () => {
  test("responde con cabeceras de seguridad", async () => {
    const res = await createApp().request("/");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(res.headers.get("X-XSS-Protection")).toBe("0");
  });

  test("CORS acepta un origen de la lista blanca", async () => {
    process.env.ALLOWED_ORIGINS = "https://chocao.example.com,http://localhost:5173";
    const res = await createApp().request("/", {
      headers: { Origin: "https://chocao.example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://chocao.example.com");
  });

  test("CORS rechaza un origen fuera de la lista (sin cabeceras CORS, nunca *)", async () => {
    process.env.ALLOWED_ORIGINS = "https://chocao.example.com";
    const res = await createApp().request("/", {
      headers: { Origin: "https://atacante.example.net" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("el preflight OPTIONS permite los headers de la app para orígenes válidos", async () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    const res = await createApp().request("/api/vehicles", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization",
      },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
});
