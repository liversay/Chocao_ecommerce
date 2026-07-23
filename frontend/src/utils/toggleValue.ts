// Helper de checkbox groups (agregar/quitar un valor de una selección
// múltiple). En su propio módulo (no en FilterCheckboxGroup.tsx) para no
// romper el fast refresh de Vite (react-refresh/only-export-components).
export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
