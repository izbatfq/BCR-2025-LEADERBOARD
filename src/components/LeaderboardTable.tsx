import React, { useMemo, useState } from "react";
import { exportLeaderboardCSV } from "../lib/csv";

export type LeaderRow = {
  rank: number | null; // can be null for DNF/DSQ
  bib: string;
  name: string;
  gender: string;
  category: string;
  sourceCategoryKey: string;
  finishTimeRaw: string;
  totalTimeMs: number;
  totalTimeDisplay: string; // "DNF"/"DSQ"/formatted
  epc: string;
};

export default function LeaderboardTable({
  title,
  rows,
  showTop10Badge = false,
  onSelect,
}: {
  title: string;
  rows: LeaderRow[];
  showTop10Badge?: boolean;
  onSelect?: (row: LeaderRow) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => String(r.bib).toLowerCase().includes(query));
  }, [q, rows]);

  const handleExport = () => {
    exportLeaderboardCSV(
      filtered.map(
        (r) =>
          ({
            ...r,
            rank: r.rank ?? "-",
          } as any)
      ),
      `${title.replace(/\s+/g, "_")}.csv`
    );
  };

  const showingCount = filtered.length;

  return (
    <div className="card">
      <div className="header-row">
        <div>
          <h2 className="section-title">{title}</h2>
          <div className="subtle">
            Showing <b>{showingCount}</b> participants (valid EPC only)
          </div>
        </div>

        <div className="tools">
          <input
            className="search"
            type="text"
            placeholder="Search NO BIB…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn ghost" onClick={() => setQ("")}>
            Reset
          </button>
          <button className="btn" onClick={handleExport}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="f1-table">
          <thead>
            <tr>
              <th className="col-rank">POS</th>
              <th className="col-bib">BIB</th>
              <th>NAME</th>
              <th className="col-gender">GENDER</th>
              <th className="col-cat">CATEGORY</th>
              <th className="col-time">FINISH</th>
              <th className="col-time">TOTAL</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const pos = r.rank ?? "-";
              const isTop10 = r.rank != null && r.rank <= 10;
              const isSpecial =
                r.totalTimeDisplay === "DNF" || r.totalTimeDisplay === "DSQ";

              return (
                <tr
                  key={r.epc}
                  className={[
                    "row-hover",
                    isTop10 && showTop10Badge ? "top10-row" : "",
                    isSpecial ? "special-row" : "",
                  ].join(" ")}
                >
                  <td className="pos-cell">
                    <span className={`pos-pill pos-${pos <= 3 ? pos : "n"}`}>
                      {pos}
                    </span>
                  </td>

                  <td className="mono">
                    <button className="link-btn" onClick={() => onSelect?.(r)}>
                      {r.bib || "-"}
                    </button>
                  </td>

                  <td className="name-cell">
                    <button className="link-btn" onClick={() => onSelect?.(r)}>
                      {r.name || "-"}
                    </button>
                  </td>

                  <td>{r.gender || "-"}</td>
                  <td>{r.category || "-"}</td>
                  <td className="mono">{r.finishTimeRaw || "-"}</td>
                  <td className="mono strong">{r.totalTimeDisplay}</td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  {rows.length === 0
                    ? "Belum ada finisher (data waktu belum tersedia)."
                    : "No data matched your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
