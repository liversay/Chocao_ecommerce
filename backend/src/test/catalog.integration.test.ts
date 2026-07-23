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
  items: Array<{ title: string; status: string; currentPrice?: number; brand?: string }>;
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

  test("filtra por rango de año", async () => {
    await createVehicle({ year: 2015 });
    await createVehicle({ year: 2019 });
    await createVehicle({ year: 2023 });

    const res = (await (await app.request("/api/vehicles?minYear=2017&maxYear=2021")).json()) as CatalogBody;
    expect(res.total).toBe(1);

    const onlyMin = (await (await app.request("/api/vehicles?minYear=2019")).json()) as CatalogBody;
    expect(onlyMin.total).toBe(2);

    const onlyMax = (await (await app.request("/api/vehicles?maxYear=2019")).json()) as CatalogBody;
    expect(onlyMax.total).toBe(2);
  });

  test("filtra por rango de kilometraje", async () => {
    await createVehicle({ mileage: 5_000 });
    await createVehicle({ mileage: 50_000 });
    await createVehicle({ mileage: 120_000 });

    const res = (await (await app.request("/api/vehicles?minMileage=10000&maxMileage=100000")).json()) as CatalogBody;
    expect(res.total).toBe(1);

    const onlyMin = (await (await app.request("/api/vehicles?minMileage=50000")).json()) as CatalogBody;
    expect(onlyMin.total).toBe(2);
  });

  test("filtra por transmisión (single y multi-valor)", async () => {
    await createVehicle({ transmission: "manual" });
    await createVehicle({ transmission: "automatic" });
    await createVehicle({ transmission: "automatic" });

    const single = (await (await app.request("/api/vehicles?transmission=manual")).json()) as CatalogBody;
    expect(single.total).toBe(1);

    const multi = (await (await app.request("/api/vehicles?transmission=manual,automatic")).json()) as CatalogBody;
    expect(multi.total).toBe(3);
  });

  test("filtra por estilo de carrocería (single y multi-valor)", async () => {
    await createVehicle({ bodyStyle: "sedan" });
    await createVehicle({ bodyStyle: "suv" });
    await createVehicle({ bodyStyle: "pickup" });

    const single = (await (await app.request("/api/vehicles?bodyStyle=suv")).json()) as CatalogBody;
    expect(single.total).toBe(1);

    const multi = (await (await app.request("/api/vehicles?bodyStyle=suv,pickup")).json()) as CatalogBody;
    expect(multi.total).toBe(2);
  });

  test("filtra por múltiples estados vía coma", async () => {
    await createVehicle({ status: "active" });
    await createVehicle({ status: "closed" });
    await createVehicle({ status: "awarded" });
    await createVehicle({ status: "published" });

    const res = (await (await app.request("/api/vehicles?status=active,closed")).json()) as CatalogBody;
    expect(res.total).toBe(2);
    expect(res.items.every((v) => v.status === "active" || v.status === "closed")).toBe(true);
  });

  test("filtra por múltiples marcas vía coma (OR)", async () => {
    await createVehicle({ brand: "Toyota" });
    await createVehicle({ brand: "Nissan" });
    await createVehicle({ brand: "Honda" });

    const res = (await (await app.request("/api/vehicles?brand=toyota,honda")).json()) as CatalogBody;
    expect(res.total).toBe(2);
  });

  test("combina marca múltiple y búsqueda de texto con $and (no se pisan los $or)", async () => {
    await createVehicle({ brand: "Toyota", model: "Hilux", title: "Toyota Hilux combinado" });
    await createVehicle({ brand: "Toyota", model: "Corolla", title: "Toyota Corolla combinado" });
    await createVehicle({ brand: "Nissan", model: "Hilux", title: "Nissan Hilux combinado" });

    // Marca en {toyota, honda} Y texto "hilux" en título/marca/modelo:
    // solo el primer vehículo cumple ambas condiciones a la vez.
    const res = (await (
      await app.request("/api/vehicles?brand=toyota,honda&q=hilux")
    ).json()) as CatalogBody;
    expect(res.total).toBe(1);
    expect(res.items[0]!.brand).toBe("Toyota");
  });

  test("ordena por precio ascendente y descendente", async () => {
    await createVehicle({ currentPrice: 5_000 });
    await createVehicle({ currentPrice: 15_000 });
    await createVehicle({ currentPrice: 10_000 });

    const desc = (await (await app.request("/api/vehicles?sort=price_desc")).json()) as CatalogBody;
    expect(desc.items.map((v) => v.currentPrice)).toEqual([15_000, 10_000, 5_000]);

    const asc = (await (await app.request("/api/vehicles?sort=price_asc")).json()) as CatalogBody;
    expect(asc.items.map((v) => v.currentPrice)).toEqual([5_000, 10_000, 15_000]);
  });

  test("ordena por fecha: 'oldest' explícito y 'newest' por defecto", async () => {
    await createVehicle({ title: "Primero creado", createdAt: new Date("2020-01-01") });
    await createVehicle({ title: "Segundo creado", createdAt: new Date("2021-01-01") });
    await createVehicle({ title: "Tercero creado", createdAt: new Date("2022-01-01") });

    const oldest = (await (await app.request("/api/vehicles?sort=oldest")).json()) as CatalogBody;
    expect(oldest.items.map((v) => v.title)).toEqual(["Primero creado", "Segundo creado", "Tercero creado"]);

    const byDefault = (await (await app.request("/api/vehicles?limit=50")).json()) as CatalogBody;
    expect(byDefault.items.map((v) => v.title)).toEqual(["Tercero creado", "Segundo creado", "Primero creado"]);

    const newest = (await (await app.request("/api/vehicles?sort=newest")).json()) as CatalogBody;
    expect(newest.items.map((v) => v.title)).toEqual(["Tercero creado", "Segundo creado", "Primero creado"]);
  });
});
