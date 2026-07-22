import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// Flujo crítico: pujar → ser superado → notificación in-app.
// Usa el vehículo "Corolla E2E" (active, $10.000) del seed.

test.describe("Pujas", () => {
  test("Ana puja sobre el Corolla y el precio/historial se actualizan", async ({ page }) => {
    await loginAs(page, "ana");
    await page.goto("/vehicles");
    await expect(page.getByText("Cargando catálogo...")).toHaveCount(0, { timeout: 15_000 });

    await page.getByText("Corolla E2E").first().click();
    await expect(page).toHaveURL(/\/vehicles\/.+/);

    // Formulario de puja visible para usuaria autenticada en subasta activa
    const bidInput = page.getByLabel("Tu puja (USD)");
    await expect(bidInput).toBeVisible();

    await bidInput.fill("10500");
    await page.getByRole("button", { name: "Pujar", exact: true }).click();

    await expect(page.getByText(/Puja de \$10,500 registrada/)).toBeVisible();
    await expect(page.getByText("$10,500").first()).toBeVisible();
  });

  test("Bruno supera la puja con el botón +5% y Ana recibe la notificación", async ({ browser }) => {
    // Bruno puja más alto en su propio contexto de navegador
    const brunoContext = await browser.newContext();
    const brunoPage = await brunoContext.newPage();
    await loginAs(brunoPage, "bruno");
    await brunoPage.goto("/vehicles");
    await expect(brunoPage.getByText("Cargando catálogo...")).toHaveCount(0, { timeout: 15_000 });
    await brunoPage.getByText("Corolla E2E").first().click();

    await expect(brunoPage.getByLabel("Tu puja (USD)")).toBeVisible();
    await brunoPage.getByRole("button", { name: "+5%" }).click();
    await brunoPage.getByRole("button", { name: "Pujar", exact: true }).click();
    await expect(brunoPage.getByText(/Puja de \$[\d,]+ registrada/)).toBeVisible();
    await brunoContext.close();

    // Ana ve el badge de la campana y la notificación "Te superaron"
    const anaContext = await browser.newContext();
    const anaPage = await anaContext.newPage();
    await loginAs(anaPage, "ana");
    await anaPage.goto("/");

    const bell = anaPage.getByRole("button", { name: "Notificaciones" });
    await expect(bell).toBeVisible();
    await expect(bell.locator("span").first()).toHaveText(/[1-9]/, { timeout: 10_000 });

    await bell.click();
    await expect(anaPage.getByText("Te superaron en una puja").first()).toBeVisible();

    // La página completa de notificaciones también la lista
    await anaPage.goto("/notifications");
    await expect(anaPage.getByRole("heading", { name: "Notificaciones" })).toBeVisible();
    await expect(anaPage.getByText("Te superaron en una puja").first()).toBeVisible();
    await anaContext.close();
  });

  test("una puja por debajo del precio actual se rechaza con error claro", async ({ page }) => {
    await loginAs(page, "ana");
    await page.goto("/vehicles");
    await expect(page.getByText("Cargando catálogo...")).toHaveCount(0, { timeout: 15_000 });
    await page.getByText("Corolla E2E").first().click();

    const bidInput = page.getByLabel("Tu puja (USD)");
    await expect(bidInput).toBeVisible();

    // El <input type="number" min={currentPrice+1}> bloquea el submit por
    // validación nativa del navegador antes de que corra el JS de la app —
    // se desactiva aquí para ejercitar el guard propio del componente
    // (`parsed <= currentPrice`), que es el que de verdad se prueba.
    await page.locator("form").evaluate((form) => {
      (form as HTMLFormElement).noValidate = true;
    });

    await bidInput.fill("1");
    await page.getByRole("button", { name: "Pujar", exact: true }).click();

    // Validación del cliente: "La puja debe ser mayor a $X"
    await expect(page.getByText(/La puja debe ser mayor a \$/).first()).toBeVisible();
  });
});
