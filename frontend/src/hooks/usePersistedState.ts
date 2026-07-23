import { useEffect, useState } from "react";

// Como useState, pero respaldado en localStorage bajo `key`. Usado por las
// pantallas de backoffice para recordar los últimos filtros aplicados entre
// visitas (namespacing sugerido: "chocao.admin.filters.<pantalla>").
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Almacenamiento lleno o inaccesible (modo privado): degradar en silencio,
      // los filtros simplemente no persistirán en esta sesión.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
