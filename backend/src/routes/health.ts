import { Hono } from "hono";
import mongoose from "mongoose";
import { metrics } from "../lib/metrics";
import type { AppEnv } from "../types";

const health = new Hono<AppEnv>();

// Liveness: el proceso responde.
health.get("/health", (c) =>
  c.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) })
);

// Readiness: listo para recibir tráfico (incluye la conexión a MongoDB).
health.get("/ready", async (c) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  let mongoPing = false;
  if (mongoConnected) {
    try {
      await mongoose.connection.db?.admin().ping();
      mongoPing = true;
    } catch {
      mongoPing = false;
    }
  }

  const ready = mongoConnected && mongoPing;
  return c.json(
    { status: ready ? "ready" : "not-ready", mongo: mongoConnected && mongoPing ? "up" : "down" },
    ready ? 200 : 503
  );
});

// Métricas estilo Prometheus.
health.get("/metrics", (c) => c.text(metrics.render()));

export default health;
