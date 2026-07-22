import { test, expect } from "@playwright/test";

test.describe("Landing", () => {
  test("carga con hero, navbar y CTA hacia el catálogo", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Subastas oficiales");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Catálogo" })).toBeVisible();

    await page.getByRole("link", { name: "Ver catálogo" }).click();
    await expect(page).toHaveURL(/\/vehicles$/);
  });
});

test.describe("Catálogo", () => {
  test("renderiza el listado y responde a la búsqueda", async ({ page }) => {
    await page.goto("/vehicles");

    await expect(page.getByRole("heading", { name: "Vehículos en subasta" })).toBeVisible();

    const searchInput = page.getByPlaceholder("Buscar por marca o modelo...");
    await expect(searchInput).toBeVisible();

    // Esperar a que termine el estado de carga antes de interactuar.
    await expect(page.getByText("Cargando catálogo...")).toHaveCount(0, { timeout: 15_000 });

    // Escribir un término que casi con certeza no matchea nada, para ejercitar el filtro.
    await searchInput.fill("zzz-sin-resultados-zzz");
    await expect(page.getByRole("heading", { name: "No hay vehículos disponibles" })).toBeVisible();
    await expect(page.getByText(/Sin resultados para/)).toBeVisible();

    // Limpiar y verificar que vuelve a mostrar tarjetas o el empty state normal.
    await searchInput.fill("");
    await expect(
      page.locator(".grid-cards").or(page.getByText("No hay vehículos disponibles"))
    ).toBeVisible();
  });

  test("permite entrar al detalle de un vehículo cuando hay catálogo", async ({ page }) => {
    await page.goto("/vehicles");
    await expect(page.getByText("Cargando catálogo...")).toHaveCount(0, { timeout: 15_000 });

    const firstCard = page.locator('a[href^="/vehicles/"]').first();
    const hasVehicles = (await firstCard.count()) > 0;
    test.skip(!hasVehicles, "No hay vehículos en el catálogo para probar el detalle");

    await firstCard.click();
    await expect(page).toHaveURL(/\/vehicles\/.+/);
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByText("Vehículo no encontrado"))).toBeVisible();
  });
});

test.describe("Páginas legales", () => {
  test("Términos y condiciones carga", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Objeto de la plataforma")).toBeVisible();
  });

  test("Política de privacidad carga", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Datos que recopilamos")).toBeVisible();
  });
});
