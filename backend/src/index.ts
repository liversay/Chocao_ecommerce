import { serve } from "@hono/node-server";
import "dotenv/config";

import { createApp } from "./app";
import { connectDB } from "./lib/db";
import { logger } from "./lib/logger";

const app = createApp();
const PORT = parseInt(process.env.PORT || "3000");

connectDB().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    logger.info(`Chocao API running on http://localhost:${PORT}`);
  });
});
