import React, { useMemo, useState } from "react";
import LeaderboardTable, { LeaderRow } from "./LeaderboardTable";
import { exportLeaderboardCSV } from "../lib/csv";

const trophyForRank = (rank: number) => {
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank <= 10) return "🏅";
  return "";
};

export default function CategorySection({
  categoryKey,
  rows,
  onSelect,
}: {
  categoryKey: string;
  rows: LeaderRow[];
  onSelect?: (row: LeaderRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  /**
   * ✅ Category ranking:
   * - Finishers: rank 1..N by totalTimeMs
   * - DNF: tetap diberi rank lanjutan setelah finisher, diurutkan by totalTimeMs
   * - DSQ: tetap tampil tapi rank null
   */
  const rankedRows = useMemo(() => {
    const finishers = rows.filter(
      (r) => r.totalTimeDisplay !== "DNF" && r.totalTimeDisplay !== "DSQ"
    );

    const dnfs = rows
      .filter((r) => r.totalTimeDisplay === "DNF")
      .sort((a, b) => a.totalTimeMs - b.totalTimeMs);

    const dsqs = rows.filter((r) => r.totalTimeDisplay === "DSQ");

    const rankedFinishers = [...finishers]
      .sort((a, b) => a.totalTimeMs - b.totalTimeMs)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const rankedDnfs = dnfs.map((r, i) => ({
      ...r,
      rank: rankedFinishers.length + i + 1,
    }));

    return [
      ...rankedFinishers,
      ...rankedDnfs,
      ...dsqs.map((r) => ({ ...r, rank: null })),
    ];
  }, [rows]);

  const top10 = useMemo(
    () => rankedRows.filter((r) => (r.rank ?? 999) <= 10),
    [rankedRows]
  );

  const exportAll = () =>
    exportLeaderboardCSV(
      rankedRows,
      `${categoryKey.replace(/\s+/g, "_")}_full.csv`
    );

  const exportTop10 = () =>
    exportLeaderboardCSV(
      top10,
      `${categoryKey.replace(/\s+/g, "_")}_top10.csv`
    );

  return (
    <div className="category-wrap">
      {/* Top 10 Preview */}
      <div className="card f1-top10">
        <div className="header-row">
          <div>
            <h2 className="section-title">{categoryKey} — Top 10</h2>
            <div className="subtle">Top 10 per kategori (CSV)</div>
          </div>

          <div className="tools">
            <button className="btn ghost" onClick={exportTop10}>
              Export Top 10 CSV
            </button>
            <button className="btn" onClick={exportAll}>
              Export Full CSV
            </button>
            <button
              className="btn toggle"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide Full Standings" : "View Full Standings"}
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="f1-table compact">
            <thead>
              <tr>
                <th className="col-rank">POS</th>
                <th className="col-bib">BIB</th>
                <th>NAME</th>
                <th className="col-time">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r) => (
                <tr key={r.epc} className="row-hover top10-row">
                  <td className="pos-cell">
                    <span
                      className={`pos-pill pos-${
                        (r.rank ?? 999) <= 3 ? r.rank : "n"
                      }`}
                    >
                      {r.rank} {r.rank ? trophyForRank(r.rank) : ""}
                    </span>
                  </td>
                  <td className="mono">
                    <button className="link-btn" onClick={() => onSelect?.(r)}>
                      {r.bib}
                    </button>
                  </td>
                  <td className="name-cell">
                    <button className="link-btn" onClick={() => onSelect?.(r)}>
                      {r.name}
                    </button>
                  </td>
                  <td className="mono strong">{r.totalTimeDisplay}</td>
                </tr>
              ))}
              {top10.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    No runners yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Standings */}
      {expanded && (
        <LeaderboardTable
          title={`Full Standings — ${categoryKey}`}
          rows={rankedRows}
          showTop10Badge
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
