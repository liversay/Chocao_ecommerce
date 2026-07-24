// Validación ESTRUCTURAL del documento de identidad (RI-01). No existe una
// fuente pública confiable del algoritmo real de dígito verificador
// panameño ni del catálogo exacto de prefijos/provincias — por eso NO se
// inventa un checksum, y el catálogo de patrones abajo es ILUSTRATIVO para
// esta demo (confirmar contra la fuente oficial antes de un uso real; punto
// abierto #1 del documento de reglas de negocio). El diseño es una
// estrategia por categoría, no una única regex monolítica, para que cada
// categoría pueda corregirse de forma aislada.
interface EstrategiaDocumento {
  categoria: string;
  patron: RegExp;
  canonizar: (raw: string) => string;
}

const estrategias: EstrategiaDocumento[] = [
  {
    // Cédula nacional: dígito(s) de provincia - libro - tomo
    categoria: "NACIONAL",
    patron: /^\d{1,2}-\d{2,4}-\d{2,6}$/,
    canonizar: (raw) => raw,
  },
  {
    // Extranjero residente con cédula de extranjería
    categoria: "EXTRANJERO_RESIDENTE",
    patron: /^E-\d{2,4}-\d{2,6}$/i,
    canonizar: (raw) => raw.toUpperCase(),
  },
  {
    // Pasaporte extranjero: alfanumérico simple, sin guiones
    categoria: "PASAPORTE",
    patron: /^[A-Z0-9]{6,9}$/i,
    canonizar: (raw) => raw.toUpperCase(),
  },
];

// Quita espacios sobrantes alrededor de los separadores ("8 - 888" -> "8-888")
// para que variantes de tipeo normalicen a la misma forma canónica.
function limpiar(raw: string): string {
  return raw.trim().replace(/\s*-\s*/g, "-").replace(/\s+/g, "");
}

export interface DocumentoNormalizado {
  categoria: string;
  canonico: string;
}

// Devuelve la forma canónica única (RI-02) y la categoría detectada, o null
// si el documento no matchea ninguna estrategia conocida. La forma canónica
// es la que lleva el índice único en Proponente (RI-03: un documento = un
// sujeto).
export function normalizarDocumento(raw: string): DocumentoNormalizado | null {
  const limpio = limpiar(raw);
  if (!limpio) return null;
  for (const estrategia of estrategias) {
    if (estrategia.patron.test(limpio)) {
      return { categoria: estrategia.categoria, canonico: estrategia.canonizar(limpio) };
    }
  }
  return null;
}
