import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { Vehicle } from "../models/Vehicle";
import { invalidateCatalog, listVehicles } from "../services/vehicles";
import { setupTestDB } from "./db";
import { createVehicle } from "./factories";

setupTestDB();
const app = createApp();

interface CatalogBody {
  items: Array<{ title: string; status: string }>;
  total: number;
  page: number;
  pages: number;
}

describe("catálogo paginado (HU-44)", () => {
  test("pagina con total y páginas correctas", async () => {
    for (let i = 0; i < 15; i++) await createVehicle();

    const p1 = (await (await app.request("/api/vehicles?limit=10&page=1")).json()) as CatalogBody;
    const p2 = (await (await app.request("/api/vehicles?limit=10&page=2")).json()) as CatalogBody;

    expect(p1.items.length).toBe(10);
    expect(p1.total).toBe(15);
    expect(p1.pages).toBe(2);
    expect(p2.items.length).toBe(5);
  });

  test("filtra por marca, rango de precio y texto", async () => {
    await createVehicle({ brand: "Toyota", model: "Hilux", currentPrice: 18_000 });
    await createVehicle({ brand: "Nissan", model: "Frontier", currentPrice: 9_000 });
    await createVehicle({ brand: "Toyota", model: "Corolla", currentPrice: 7_000 });

    const porMarca = (await (await app.request("/api/vehicles?brand=toyota")).json()) as CatalogBody;
    expect(porMarca.total).toBe(2);

    const porPrecio = (await (await app.request("/api/vehicles?minPrice=8000&maxPrice=20000")).json()) as CatalogBody;
    expect(porPrecio.total).toBe(2);

    const porTexto = (await (await app.request("/api/vehicles?q=hilux")).json()) as CatalogBody;
    expect(porTexto.total).toBe(1);
    expect(porTexto.items[0]!.title).toContain("prueba");
  });

  test("?status=draft no expone borradores al público", async () => {
    await createVehicle({ status: "draft", title: "Borrador secreto" });
    await createVehicle({ status: "active" });

    const res = (await (await app.request("/api/vehicles?status=draft")).json()) as CatalogBody;
    expect(res.items.every((v) => v.status !== "draft")).toBe(true);
  });

  test("la caché sirve resultados y se invalida al cambiar el inventario", async () => {
    await createVehicle({ title: "Original único" });

    const antes = await listVehicles({ q: "único" });
    expect(antes.total).toBe(1);

    // Mutación directa sin invalidar: la caché sigue sirviendo lo anterior
    await Vehicle.create({
      title: "Nuevo único",
      brand: "Kia",
      model: "Rio",
      year: 2020,
      basePrice: 5000,
      currentPrice: 5000,
      status: "active",
    });
    expect((await listVehicles({ q: "único" })).total).toBe(1);

    // Con invalidación explícita (la que disparan las rutas/servicios) se ve el cambio
    invalidateCatalog();
    expect((await listVehicles({ q: "único" })).total).toBe(2);
  });
});
