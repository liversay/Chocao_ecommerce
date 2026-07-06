import React from "react";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  width?: string;
  align?: "left" | "right" | "center";
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  dense?: boolean;
}

export default function DataTable<T extends { _id?: string }>({
  columns,
  data,
  emptyMessage = "Sin datos para mostrar",
  dense = false,
}: Props<T>) {
  return (
    <div className="table-wrap">
      <table className={`table ${dense ? "table-dense" : ""}`}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={{ width: col.width, textAlign: col.align || "left" }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
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
  );
}
