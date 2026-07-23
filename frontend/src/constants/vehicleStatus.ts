// Labels de estado de vehículo compartidos entre pantallas de backoffice
// (dashboard, reportes, filtros). Ver también StatusBadge (mismos valores).
export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  active: "Activo",
  closed: "Cerrado",
  awarded: "Adjudicado",
};

// Incluye "draft" (a diferencia del catálogo público) porque el backoffice
// también administra vehículos sin publicar.
export const ADMIN_VEHICLE_STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "published", label: "Publicado" },
  { value: "active", label: "Activo" },
  { value: "closed", label: "Cerrado" },
  { value: "awarded", label: "Adjudicado" },
];
