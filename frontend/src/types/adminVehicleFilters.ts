// Tipos del panel de filtros de vehículos del backoffice (AdminVehicleFilters).
// Separado del componente para no romper el fast refresh de Vite, igual que
// frontend/src/types/catalogFilters.ts. A diferencia del catálogo público,
// aquí "estado" incluye "draft" y se agrega un rango de fecha de registro.
export interface AdminVehicleRangeDraft {
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  minMileage: string;
  maxMileage: string;
  dateFrom: string;
  dateTo: string;
}

export interface AdminVehicleInstantFilters {
  status: string[];
  transmission: string[];
  bodyStyle: string[];
  brand: string[];
  sort: string;
}

export const EMPTY_ADMIN_VEHICLE_RANGE: AdminVehicleRangeDraft = {
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  minMileage: "",
  maxMileage: "",
  dateFrom: "",
  dateTo: "",
};

export const EMPTY_ADMIN_VEHICLE_INSTANT: AdminVehicleInstantFilters = {
  status: [],
  transmission: [],
  bodyStyle: [],
  brand: [],
  sort: "newest",
};
