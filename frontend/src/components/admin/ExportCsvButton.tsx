import Button from "../Button";

interface Column<T> {
  header: string;
  accessor: (row: T) => string | number;
}

interface Props<T> {
  data: T[];
  filename: string;
  columns: Column<T>[];
}

function toCsvValue(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export default function ExportCsvButton<T>({ data, filename, columns }: Props<T>) {
  function handleExport() {
    const header = columns.map((c) => toCsvValue(c.header)).join(",");
    const rows = data.map((row) => columns.map((c) => toCsvValue(c.accessor(row))).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} disabled={data.length === 0}>
      Exportar CSV
    </Button>
  );
}
