import Papa from "papaparse";

const MAX_ROWS = 200;
const MAX_CHARS = 30_000;

export type CsvParseResult = {
  text: string;
  rowCount: number;
  truncated: boolean;
};

export function parseCsvToText(raw: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rows = parsed.data.filter(
    (r) => r && Object.values(r).some((v) => v != null && String(v).trim() !== "")
  );
  const totalRows = rows.length;
  const trimmed = rows.slice(0, MAX_ROWS);

  const headers = parsed.meta.fields ?? Object.keys(trimmed[0] ?? {});

  const lines: string[] = [];
  lines.push(`CSV with ${totalRows} row(s); columns: ${headers.join(", ")}.`);
  lines.push("");

  for (let i = 0; i < trimmed.length; i++) {
    const row = trimmed[i];
    const parts = headers
      .map((h) => {
        const v = row[h];
        if (v == null || String(v).trim() === "") return null;
        return `${h}: ${String(v).trim()}`;
      })
      .filter(Boolean);
    lines.push(`Row ${i + 1} — ${parts.join(" | ")}`);
  }

  let text = lines.join("\n");
  let truncated = totalRows > MAX_ROWS;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + "\n...[truncated]";
    truncated = true;
  }

  return { text, rowCount: totalRows, truncated };
}
