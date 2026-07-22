import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// Flujo crítico: watchlist (guardar/quitar), página Mi watchlist y
// preferencias de notificación en la cuenta. Usa "Civic E2E" para no
// interferir con el vehículo de las pruebas de pujas.

test.describe("Watchlist", () => {
  test("guardar un vehículo desde el detalle y verlo en Mi watchlist", async ({ page }) => {
    await loginAs(page, "ana");
    await page.goto("/vehicles");
    await expect(page.getByText("Cargando catálogo...")).toHaveCount(0, { timeout: 15_000 });

    await page.getByText("Civic E2E").first().click();
    await expect(page).toHaveURL(/\/vehicles\/.+/);

    // El corazón de "guardar" tiene el mismo aria-label en el catálogo y en
    // el detalle: un locator ambiguo (resuelve a N elementos) NO reintenta
    // en Playwright, así que hay que esperar primero algo único del detalle
    // (el <h1>, a diferencia de los <h3> de las tarjetas) antes de tocarlo.
    await expect(page.getByRole("heading", { name: "Civic E2E", level: 1 })).toBeVisible();

    const saveButton = page.getByRole("button", { name: "Guardar en mi watchlist" });
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    await expect(page.getByRole("button", { name: "Quitar de mi watchlist" })).toBeVisible();

    await page.goto("/watchlist");
    await expect(page.getByRole("heading", { name: "Mi watchlist" })).toBeVisible();
    await expect(page.getByText("Civic E2E").first()).toBeVisible({ timeout: 10_000 });
  });

  test("quitar el vehículo de la watchlist la deja vacía", async ({ page }) => {
    await loginAs(page, "ana");
    await page.goto("/watchlist");
    await expect(page.getByRole("heading", { name: "Mi watchlist" })).toBeVisible();
    await expect(page.getByText("Civic E2E").first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Quitar de mi watchlist" }).first().click();
    await page.reload();
    await expect(page.getByText("Aún no sigues ningún vehículo")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Cuenta y preferencias", () => {
  test("editar teléfono y desactivar una preferencia persiste", async ({ page }) => {
    await loginAs(page, "ana");
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Perfil y preferencias" })).toBeVisible();

    // Nombre y correo bloqueados (gestionados por el proveedor de identidad)
    await expect(page.getByLabel("Nombre")).toBeDisabled();
    await expect(page.getByLabel("Correo")).toBeDisabled();

    await page.getByLabel("Teléfono").fill("+507 6000-1234");

    // Desactivar "Puja superada"
    const outbidToggle = page
      .locator("label", { hasText: "Puja superada" })
      .locator('input[type="checkbox"]');
    await expect(outbidToggle).toBeChecked();
    await outbidToggle.uncheck();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Guardado ✓")).toBeVisible({ timeout: 10_000 });

    // Persistencia real: recargar y verificar contra el backend
    await page.reload();
    await expect(page.getByLabel("Teléfono")).toHaveValue("+507 6000-1234");
    await expect(
      page.locator("label", { hasText: "Puja superada" }).locator('input[type="checkbox"]')
    ).not.toBeChecked();

    // Restaurar la preferencia para no afectar otros tests
    await page
      .locator("label", { hasText: "Puja superada" })
      .locator('input[type="checkbox"]')
      .check();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Guardado ✓")).toBeVisible({ timeout: 10_000 });
  });

  test("las rutas protegidas exigen sesión", async ({ page }) => {
    // Sin loginAs: usuario anónimo
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/watchlist");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/notifications");
    await expect(page).toHaveURL(/\/login/);
  });
});
