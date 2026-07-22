import React, { useMemo, useState } from "react";
import Button from "./Button";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  width?: string;
  align?: "left" | "right" | "center";
  /** Habilita el ordenamiento por esta columna al hacer click en el header. */
  sortKey?: string;
  /** Valor comparable a usar al ordenar (requerido si accessor es una función). */
  sortValue?: (row: T) => string | number;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  dense?: boolean;
  /** Paginación opcional: si se pasan los tres, se renderiza el pie con controles. */
  page?: number;
  pages?: number;
  onPageChange?: (page: number) => void;
}

export default function DataTable<T extends { _id?: string }>({
  columns,
  data,
  emptyMessage = "Sin datos para mostrar",
  dense = false,
  page,
  pages,
  onPageChange,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.sortKey === sort.key);
    if (!col) return data;
    const valueOf = (row: T): string | number =>
      col.sortValue ? col.sortValue(row) : String(typeof col.accessor === "function" ? "" : row[col.accessor] ?? "");
    const copy = [...data];
    copy.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sort, columns]);

  function toggleSort(col: Column<T>) {
    if (!col.sortKey) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.sortKey) return { key: col.sortKey!, dir: "asc" };
      return { key: col.sortKey!, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  const showPager = page !== undefined && pages !== undefined && onPageChange !== undefined && pages > 1;

  return (
    <div>
      <div className="table-wrap">
        <table className={`table ${dense ? "table-dense" : ""}`}>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    width: col.width,
                    textAlign: col.align || "left",
                    cursor: col.sortKey ? "pointer" : undefined,
                    userSelect: col.sortKey ? "none" : undefined,
                  }}
                  onClick={() => toggleSort(col)}
                >
                  {col.header}
                  {col.sortKey && sort?.key === col.sortKey ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, ri) => (
                <tr key={row._id || ri}>
                  {columns.map((col, ci) => (
                    <td key={ci} style={{ textAlign: col.align || "left" }}>
                      {typeof col.accessor === "function"
                        ? col.accessor(row)
                        : String(row[col.accessor] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPager && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "var(--sp-3)",
            padding: "var(--sp-4) 0",
          }}
        >
          <Button variant="ghost" size="sm" disabled={page! <= 1} onClick={() => onPageChange!(page! - 1)}>
            ← Anterior
          </Button>
          <span style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
            Página {page} de {pages}
          </span>
          <Button variant="ghost" size="sm" disabled={page! >= pages!} onClick={() => onPageChange!(page! + 1)}>
            Siguiente →
          </Button>
        </div>
      )}
    </div>
  );
}
