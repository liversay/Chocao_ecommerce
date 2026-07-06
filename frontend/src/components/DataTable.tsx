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
}

export default function DataTable<T extends { _id?: string }>({
  columns,
  data,
  emptyMessage = "Sin datos para mostrar",
}: Props<T>) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--nm-in-sm)",
        padding: "4px",
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: "var(--t-sm)",
        }}
      >
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{
                  padding: "14px 18px",
                  textAlign: col.align || "left",
                  color: "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: "var(--t-xs)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  borderBottom: "1px solid var(--hairline)",
                  width: col.width,
                  background: "transparent",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "var(--sp-6)",
                  textAlign: "center",
                  color: "var(--text-soft)",
                  fontSize: "var(--t-sm)",
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr
                key={row._id || ri}
                style={{ transition: "background 0.15s" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                }}
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "14px 18px",
                      color: "var(--text)",
                      verticalAlign: "middle",
                      textAlign: col.align || "left",
                      borderBottom:
                        ri === data.length - 1 ? "none" : "1px solid var(--hairline)",
                    }}
                  >
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

export const NeumorphicTable = DataTable;
