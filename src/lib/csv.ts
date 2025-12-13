import type { LeaderRow } from "../components/LeaderboardTable";

function esc(val: any) {
  const s = String(val ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportLeaderboardCSV(rows: LeaderRow[], filename: string) {
  const headers = [
    "Rank",
    "NO BIB",
    "Nama Lengkap",
    "Gender",
    "Kategori",
    "Finish Time",
    "Total Time"
  ];

  const csv = [
    headers.join(","),
    ...rows.map(r =>
      [
        r.rank,
        r.bib,
        r.name,
        r.gender,
        r.category,
        r.finishTimeRaw,
        r.totalTimeDisplay
      ].map(esc).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
