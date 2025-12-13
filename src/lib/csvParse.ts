// src/lib/csvParse.ts
// Robust-enough CSV parser for typical timing exports (supports quotes & commas).

function stripBom(s: string) {
  if (!s) return s;
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function detectDelimiter(sampleLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const c of candidates) {
    const count = sampleLine.split(c).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

export function parseCsv(text: string): string[][] {
  const input = stripBom(String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  const lines = input.split("\n");

  // Find a non-empty sample line to detect delimiter
  const sample = lines.find((l) => l.trim().length > 0) || "";
  const delimiter = detectDelimiter(sample);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field.trim());
      field = "";

      // ignore fully empty lines
      const isEmpty = row.every((c) => !String(c || "").trim());
      if (!isEmpty) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  // last field
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    const isEmpty = row.every((c) => !String(c || "").trim());
    if (!isEmpty) rows.push(row);
  }

  return rows;
}

export function countDataRows(grid: string[][]): number {
  if (!grid || grid.length <= 1) return 0;
  return grid.length - 1;
}
