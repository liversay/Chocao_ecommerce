import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// Smoke del backoffice: tema oscuro, dashboard con analítica, gestión de
// usuarios, órdenes con reembolso y visor de auditoría.

test.describe("Backoffice", () => {
  test("un customer no puede entrar a /admin", async ({ page }) => {
    await loginAs(page, "ana");
    await page.goto("/admin");
    // AdminRoute redirige a la landing al no tener rol admin
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });

  test("dashboard: fondo slate oscuro, KPIs y gráficos", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15_000 });

    // El tema oscuro es real: el shell del admin resuelve --bg a #0f172a
    const bg = await page
      .locator(".admin-shell")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(15, 23, 42)");

    // KPIs del seed y gráficos Recharts renderizados
    await expect(page.getByText("Vehículos totales")).toBeVisible();
    await expect(page.getByText("Ingresos por día")).toBeVisible();
    await expect(page.getByText("Pujas por día")).toBeVisible();
    await expect(page.locator(".recharts-responsive-container").first()).toBeVisible();

    // Sidebar completo del backoffice
    for (const item of ["Vehículos", "Pujas", "Usuarios", "Órdenes", "Reportes", "Auditoría"]) {
      await expect(page.getByRole("link", { name: item })).toBeVisible();
    }
  });

  test("usuarios: lista del seed, búsqueda y filtro por rol", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
    await expect(page.getByText("ana@e2e.test")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("bruno@e2e.test")).toBeVisible();

    // Búsqueda con debounce
    await page.getByPlaceholder("Buscar por nombre o email...").fill("ana");
    await expect(page.getByText("bruno@e2e.test")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText("ana@e2e.test")).toBeVisible();

    // Export CSV habilitado con datos
    await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeEnabled();
  });

  test("órdenes: reembolsar el pago sembrado deja rastro en auditoría", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/orders");

    await expect(page.getByRole("heading", { name: "Órdenes y pagos" })).toBeVisible();
    await expect(page.getByText("Ranger E2E").first()).toBeVisible({ timeout: 10_000 });

    // Fila específica del Ranger (no ".first()": otros specs pueden haber
    // generado más pagos antes que este, y el orden es por fecha reciente).
    const rangerRow = page.locator(".table-wrap tr", { hasText: "Ranger E2E" });
    await rangerRow.getByRole("button", { name: "Reembolsar" }).click();
    await expect(page.getByText(/¿Reembolsar \$13,000\?/)).toBeVisible();
    await page.getByRole("button", { name: "Confirmar reembolso" }).click();

    // La fila queda en estado Reembolsado (scoped a la tabla: el <option>
    // "Reembolsado" del filtro de estado también matchea por texto)
    await expect(page.locator(".table-wrap").getByText("Reembolsado").first()).toBeVisible({
      timeout: 15_000,
    });

    // Auditoría registra la acción con el actor real
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Auditoría" })).toBeVisible();
    await expect(page.getByText("payment.refund").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("admin@e2e.test").first()).toBeVisible();
  });
});
