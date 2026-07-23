// Tipos y valores por defecto de los filtros del catálogo — en un módulo
// aparte (no un .tsx de componente) para no romper el fast refresh de Vite
// (react-refresh/only-export-components).
export interface RangeDraft {
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  minMileage: string;
  maxMileage: string;
}

export interface InstantFilters {
  status: string[];
  transmission: string[];
  bodyStyle: string[];
  brand: string[];
  sort: string;
}

export const EMPTY_RANGE_DRAFT: RangeDraft = {
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  minMileage: "",
  maxMileage: "",
};

export const EMPTY_INSTANT_FILTERS: InstantFilters = {
  status: [],
  transmission: [],
  bodyStyle: [],
  brand: [],
  sort: "newest",
};
