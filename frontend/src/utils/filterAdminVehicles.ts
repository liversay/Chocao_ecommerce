import type { Vehicle } from "../types";
import type { AdminVehicleInstantFilters, AdminVehicleRangeDraft } from "../types/adminVehicleFilters";

// Filtrado + orden client-side de la tabla de vehículos del backoffice.
// Compartido por AdminVehicles y AdminReports: ambas pantallas cargan el
// listado completo vía GET /api/vehicles/admin/all y filtran en memoria
// (mismo patrón que ya usaba AdminVehicles antes de este cambio).
export function filterAdminVehicles(
  vehicles: Vehicle[],
  search: string,
  range: AdminVehicleRangeDraft,
  instant: AdminVehicleInstantFilters
): Vehicle[] {
  const q = search.trim().toLowerCase();
  const minPrice = range.minPrice ? parseFloat(range.minPrice) : undefined;
  const maxPrice = range.maxPrice ? parseFloat(range.maxPrice) : undefined;
  const minYear = range.minYear ? parseFloat(range.minYear) : undefined;
  const maxYear = range.maxYear ? parseFloat(range.maxYear) : undefined;
  const minMileage = range.minMileage ? parseFloat(range.minMileage) : undefined;
  const maxMileage = range.maxMileage ? parseFloat(range.maxMileage) : undefined;
  const dateFrom = range.dateFrom ? new Date(`${range.dateFrom}T00:00:00`).getTime() : undefined;
  const dateTo = range.dateTo ? new Date(`${range.dateTo}T23:59:59.999`).getTime() : undefined;

  const filtered = vehicles.filter((v) => {
    if (q) {
      const haystack = `${v.title} ${v.brand} ${v.model}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (instant.status.length > 0 && !instant.status.includes(v.status)) return false;
    if (instant.transmission.length > 0 && (!v.transmission || !instant.transmission.includes(v.transmission))) return false;
    if (instant.bodyStyle.length > 0 && (!v.bodyStyle || !instant.bodyStyle.includes(v.bodyStyle))) return false;
    if (instant.brand.length > 0 && !instant.brand.includes(v.brand)) return false;
    if (minPrice !== undefined && !isNaN(minPrice) && v.currentPrice < minPrice) return false;
    if (maxPrice !== undefined && !isNaN(maxPrice) && v.currentPrice > maxPrice) return false;
    if (minYear !== undefined && !isNaN(minYear) && v.year < minYear) return false;
    if (maxYear !== undefined && !isNaN(maxYear) && v.year > maxYear) return false;
    if (minMileage !== undefined && !isNaN(minMileage) && (v.mileage ?? 0) < minMileage) return false;
    if (maxMileage !== undefined && !isNaN(maxMileage) && (v.mileage ?? 0) > maxMileage) return false;
    const createdAt = new Date(v.createdAt).getTime();
    if (dateFrom !== undefined && createdAt < dateFrom) return false;
    if (dateTo !== undefined && createdAt > dateTo) return false;
    return true;
  });

  const sorted = [...filtered];
  switch (instant.sort) {
    case "oldest":
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case "price_desc":
      sorted.sort((a, b) => b.currentPrice - a.currentPrice);
      break;
    case "price_asc":
      sorted.sort((a, b) => a.currentPrice - b.currentPrice);
      break;
    case "newest":
    default:
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return sorted;
}

export function countActiveAdminVehicleFilters(range: AdminVehicleRangeDraft, instant: AdminVehicleInstantFilters): number {
  let count = 0;
  if (range.minPrice || range.maxPrice) count++;
  if (range.minYear || range.maxYear) count++;
  if (range.minMileage || range.maxMileage) count++;
  if (range.dateFrom || range.dateTo) count++;
  if (instant.status.length > 0) count++;
  if (instant.transmission.length > 0) count++;
  if (instant.bodyStyle.length > 0) count++;
  if (instant.brand.length > 0) count++;
  return count;
}
