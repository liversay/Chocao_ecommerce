import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import "dotenv/config";

import { connectDB } from "./lib/db";
import { errorHandler } from "./lib/errors";
import { logger } from "./lib/logger";
import { httpLogger, requestId } from "./middlewares/logging";
import type { AppEnv } from "./types";
import usersRouter from "./routes/users";
import vehiclesRouter from "./routes/vehicles";
import bidsRouter from "./routes/bids";
import paymentsRouter from "./routes/payments";
import dashboardRouter from "./routes/dashboard";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use("*", requestId);
app.use("*", httpLogger);

app.get("/", (c) => c.json({ message: "Chocao API running" }));

app.route("/api/users", usersRouter);
app.route("/api/vehicles", vehiclesRouter);
app.route("/api/bids", bidsRouter);
app.route("/api/payments", paymentsRouter);
app.route("/api/dashboard", dashboardRouter);

app.notFound((c) => c.json({ error: "Recurso no encontrado" }, 404));
app.onError(errorHandler);

const PORT = parseInt(process.env.PORT || "3000");

connectDB().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    logger.info(`Chocao API running on http://localhost:${PORT}`);
  });
});
