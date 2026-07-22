import { defineConfig, devices } from "@playwright/test";

// La suite E2E usa el puerto 5174 (y el backend E2E el 3100) para no chocar
// jamás con los servidores de desarrollo (5173/3000) que puedas tener abiertos.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5174";
const isRemote = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  // Serial a propósito: todos los specs comparten UN backend con estado (el
  // seed E2E). Paralelizar mezclaría pujas/pagos entre tests y rompería el
  // determinismo que la suite promete.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Modo autocontenido: Playwright levanta el backend E2E (Mongo en memoria +
  // seed fijo + auth/Stripe simulados) y el frontend con el stub de Clerk.
  // reuseExistingServer está apagado a propósito: si tienes un `bun run dev`
  // ocupando el 3000/5173, detén­lo antes de correr los tests — así nunca se
  // testea contra un servidor con datos o build equivocados.
  webServer: isRemote
    ? undefined
    : [
        {
          command: "bun scripts/e2e-server.ts",
          cwd: "../backend",
          url: "http://localhost:3100/health",
          reuseExistingServer: false,
          timeout: 120_000,
          env: { PORT: "3100" },
        },
        {
          command: "bun run dev -- --port 5174 --strictPort",
          url: "http://localhost:5174",
          reuseExistingServer: false,
          timeout: 60_000,
          env: { VITE_E2E: "1", VITE_API_URL: "http://localhost:3100" },
        },
      ],
});
