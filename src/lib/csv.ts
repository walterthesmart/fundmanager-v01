/** Tiny dependency-free CSV helpers used by the cash and price import flows. */

export function parseCsv(text: string): Record<string, string>[] {
  const rows = splitRows(text.replace(/^\uFEFF/, "").trim());
  if (rows.length < 2) return [];
  const headerRow = rows[0];
  if (!headerRow) return [];
  const header = headerRow.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).flatMap((cells) => {
    if (cells.every((c) => c.trim() === "")) return [];
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = (cells[i] ?? "").trim();
    });
    return [row];
  });
}

function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else if (char === "\n") {
      cells.push(cell);
      rows.push(cells);
      cells = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  cells.push(cell);
  rows.push(cells);
  return rows;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const str = value === null || value === undefined ? "" : String(value);
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(","),
    )
    .join("\n");
}

export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export const CASH_TEMPLATE_HEADERS = [
  "client_identifier",
  "client_name",
  "direction",
  "amount",
  "currency",
  "value_date",
  "narration",
  "evidence_ref",
] as const;

export const cashTemplateCsv = () =>
  toCsv([
    [...CASH_TEMPLATE_HEADERS],
    ["SNK-CL-0001", "Adaeze Okonkwo", "inflow", "25000.00", "USD", "2026-08-01", "Bank transfer", "EOP-10021"],
    ["", "Adebayo Holdings Limited", "inflow", "150000.00", "USD", "2026-08-02", "Mandate funding", "EOP-10022"],
  ]);

export const PRICE_TEMPLATE_HEADERS = ["ticker", "price", "price_mode", "price_source"] as const;

export const priceTemplateCsv = () =>
  toCsv([
    [...PRICE_TEMPLATE_HEADERS],
    ["SNK-EQF", "143.2500", "automated", "NGX Market Feed"],
    ["DANGCEM", "31.9000", "manual", ""],
  ]);
