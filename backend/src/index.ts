import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import "dotenv/config";

import { connectDB } from "./lib/db";
import usersRouter from "./routes/users";
import vehiclesRouter from "./routes/vehicles";
import bidsRouter from "./routes/bids";
import paymentsRouter from "./routes/payments";
import dashboardRouter from "./routes/dashboard";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use("*", logger());

app.get("/", (c) => c.json({ message: "Chocao API running" }));

app.route("/api/users", usersRouter);
app.route("/api/vehicles", vehiclesRouter);
app.route("/api/bids", bidsRouter);
app.route("/api/payments", paymentsRouter);
app.route("/api/dashboard", dashboardRouter);

app.notFound((c) => c.json({ error: "Recurso no encontrado" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Error interno del servidor" }, 500);
});

const PORT = parseInt(process.env.PORT || "3000");

connectDB().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`Chocao API running on http://localhost:${PORT}`);
  });
});
