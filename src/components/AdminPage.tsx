import React, { useEffect, useMemo, useState } from "react";
import type { LeaderRow } from "./LeaderboardTable";
import { CATEGORY_KEYS, DEFAULT_EVENT_TITLE, LS_DATA_VERSION, LS_EVENT_TITLE, type CsvKind } from "../lib/config";
import { putCsvFile, deleteCsvFile, listCsvMeta } from "../lib/idb";
import { parseCsv, countDataRows } from "../lib/csvParse";

const ADMIN_USER = "izbat@izbat.org";
const ADMIN_PASS = "12345678";

const LS_AUTH = "imr_admin_authed";
const LS_CUTOFF = "imr_cutoff_ms";
const LS_DQ = "imr_dq_map";
const LS_CAT_START = "imr_cat_start_raw"; // 🔹 start time per kategori (raw string)

function loadAuth() {
  return localStorage.getItem(LS_AUTH) === "true";
}
function saveAuth(v: boolean) {
  localStorage.setItem(LS_AUTH, v ? "true" : "false");
}

function loadCutoffMs(): number | null {
  const v = localStorage.getItem(LS_CUTOFF);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function saveCutoffMs(ms: number | null) {
  if (ms == null) localStorage.removeItem(LS_CUTOFF);
  else localStorage.setItem(LS_CUTOFF, String(ms));
}

function loadDQMap(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(LS_DQ) || "{}");
  } catch {
    return {};
  }
}
function saveDQMap(map: Record<string, boolean>) {
  localStorage.setItem(LS_DQ, JSON.stringify(map));
}

function loadCatStartMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_CAT_START) || "{}");
  } catch {
    return {};
  }
}
function saveCatStartMap(map: Record<string, string>) {
  localStorage.setItem(LS_CAT_START, JSON.stringify(map));
}

export default function AdminPage({
  allRows,
  onConfigChanged,
}: {
  allRows: LeaderRow[];
  onConfigChanged: () => void;
}) {
  const [authed, setAuthed] = useState(loadAuth());
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  const [cutoffHours, setCutoffHours] = useState(() => {
    const ms = loadCutoffMs();
    if (!ms) return "";
    return String(ms / 3600000);
  });

  const [q, setQ] = useState("");
  const [dqMap, setDqMap] = useState<Record<string, boolean>>(loadDQMap());
  const [catStart, setCatStart] = useState<Record<string, string>>(
    loadCatStartMap()
  );

  const [eventTitle, setEventTitle] = useState<string>(() =>
    localStorage.getItem(LS_EVENT_TITLE) || DEFAULT_EVENT_TITLE
  );

  const [csvMeta, setCsvMeta] = useState<
    Array<{ key: CsvKind; filename: string; updatedAt: number; rows: number }>
  >([]);

  const bumpDataVersion = () => {
    localStorage.setItem(LS_DATA_VERSION, String(Date.now()));
  };

  useEffect(() => {
    (async () => {
      try {
        const meta = await listCsvMeta();
        setCsvMeta(meta as any);
      } catch {
        // ignore
      }
    })();
  }, [authed]);

  const refreshCsvMeta = async () => {
    const meta = await listCsvMeta();
    setCsvMeta(meta as any);
  };

  const saveEventTitle = () => {
    const t = (eventTitle || "").trim();
    localStorage.setItem(LS_EVENT_TITLE, t || DEFAULT_EVENT_TITLE);
    bumpDataVersion();
    onConfigChanged();
    alert("Event title updated");
  };

  const uploadCsv = async (kind: CsvKind, file: File) => {
    const text = await file.text();
    const grid = parseCsv(text);
    const headers = (grid[0] || []).map((x) => String(x || "").toLowerCase());

    const hasEpc = headers.some((h) => h.includes("epc"));
    if (!hasEpc) {
      alert(`CSV '${kind}': kolom EPC tidak ditemukan.`);
      return;
    }

    if (kind !== "master") {
      const hasTimes = headers.some(
        (h) => h.includes("times") || h.includes("time") || h.includes("timestamp") || h.includes("jam")
      );
      if (!hasTimes) {
        alert(`CSV '${kind}': kolom Times/Time tidak ditemukan.`);
        return;
      }
    }

    const rows = countDataRows(grid);
    await putCsvFile({ kind, text, filename: file.name, rows });
    bumpDataVersion();
    onConfigChanged();
    await refreshCsvMeta();
    alert(`Uploaded '${kind}' (${rows} rows)`);
  };

  const clearAllCsv = async () => {
    if (!confirm("Reset semua CSV yang sudah diupload?")) return;
    for (const k of ["master", "start", "finish", "checkpoint"] as CsvKind[]) {
      await deleteCsvFile(k);
    }
    bumpDataVersion();
    onConfigChanged();
    await refreshCsvMeta();
    alert("All uploaded CSV cleared");
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return allRows;
    return allRows.filter(
      (r) =>
        (r.bib || "").toLowerCase().includes(qq) ||
        (r.name || "").toLowerCase().includes(qq)
    );
  }, [q, allRows]);

  const metaByKind = useMemo(() => {
    const m: Partial<Record<CsvKind, { filename: string; updatedAt: number; rows: number }>> = {};
    csvMeta.forEach((x) => {
      m[x.key] = { filename: x.filename, updatedAt: x.updatedAt, rows: x.rows };
    });
    return m;
  }, [csvMeta]);

  const login = () => {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      saveAuth(true);
      setAuthed(true);
    } else {
      alert("Invalid credentials");
    }
  };


  const logout = () => {
    saveAuth(false);
    setAuthed(false);
  };

  const applyCutoff = () => {
    const h = Number(cutoffHours);
    if (!Number.isFinite(h) || h <= 0) saveCutoffMs(null);
    else saveCutoffMs(h * 3600000);

    onConfigChanged();
    alert("Cut off time updated");
  };

  const toggleDQ = (epc: string) => {
    const next = { ...dqMap, [epc]: !dqMap[epc] };
    if (!next[epc]) delete next[epc];
    setDqMap(next);
    saveDQMap(next);
    onConfigChanged();
  };

  const applyCatStart = () => {
    saveCatStartMap(catStart);
    onConfigChanged();
    alert(
      "Category start times updated.\nTotal time will use these values per kategori."
    );
  };

  if (!authed) {
    return (
      <div className="card">
        <h2 className="section-title">Admin Login</h2>
        <div className="subtle">Restricted access</div>

        <div className="admin-login">
          <input
            className="search"
            placeholder="Username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
          <input
            className="search"
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button className="btn" onClick={login}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Event Title */}
      <div className="card">
        <div className="header-row">
          <div>
            <h2 className="section-title">Event Settings</h2>
            <div className="subtle">Ubah judul event yang tampil di halaman leaderboard.</div>
          </div>
          <button className="btn" onClick={saveEventTitle}>
            Save Title
          </button>
        </div>

        <div className="admin-cutoff">
          <div className="label">Event Title</div>
          <div className="tools">
            <input
              className="search"
              style={{ width: "100%" }}
              placeholder={DEFAULT_EVENT_TITLE}
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* CSV Upload */}
      <div className="card">
        <div className="header-row">
          <div>
            <h2 className="section-title">CSV Upload (Master / Start / Finish / Checkpoint)</h2>
            <div className="subtle">
              Data timing sekarang berasal dari file CSV upload (bukan Google Sheet). Master, Start, dan Finish wajib.
              Checkpoint optional.
            </div>
          </div>
          <div className="tools">
            <button className="btn ghost" onClick={() => refreshCsvMeta()}>
              Refresh Status
            </button>
            <button className="btn" onClick={clearAllCsv}>
              Reset Uploaded CSV
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="f1-table compact">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Type</th>
                <th>Upload</th>
                <th style={{ width: 320 }}>Current File</th>
                <th style={{ width: 120 }}>Rows</th>
                <th style={{ width: 200 }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(["master", "start", "finish", "checkpoint"] as CsvKind[]).map((kind) => {
                const meta = metaByKind[kind];
                return (
                  <tr key={kind} className="row-hover">
                    <td className="mono strong">{kind.toUpperCase()}</td>
                    <td>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          const f = (e.target as HTMLInputElement).files?.[0];
                          if (f) uploadCsv(kind, f);
                        }}
                      />
                    </td>
                    <td className="mono">{meta?.filename || "-"}</td>
                    <td className="mono">{meta?.rows ?? "-"}</td>
                    <td className="mono">
                      {meta?.updatedAt
                        ? new Date(meta.updatedAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="subtle" style={{ marginTop: 8 }}>
          Format kolom minimal:
          <ul style={{ marginTop: 6, marginBottom: 0 }}>
            <li><b>Master</b>: EPC, Nama, Kelamin, Kategori, BIB (mis: BIB Number)</li>
            <li><b>Start / Finish / Checkpoint</b>: EPC, Times (atau Time / Timestamp)</li>
          </ul>
        </div>
      </div>

      {/* Cut Off Time */}
      <div className="card">
        <div className="header-row">
          <div>
            <h2 className="section-title">Cut Off Settings</h2>
            <div className="subtle">
              Cut off time dihitung dari start masing-masing pelari / kategori.
            </div>
          </div>
          <button className="btn ghost" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="admin-cutoff">
          <div className="label">Cut Off Duration (hours)</div>
          <div className="tools">
            <input
              className="search"
              placeholder="e.g. 3.5"
              value={cutoffHours}
              onChange={(e) => setCutoffHours(e.target.value)}
            />
            <button className="btn" onClick={applyCutoff}>
              Save Cut Off
            </button>
          </div>
          <div className="subtle">Jika kosong / 0 → cut off nonaktif.</div>
        </div>
      </div>

      {/* Category Start Time Overrides */}
      <div className="card">
        <div className="header-row">
          <div>
            <h2 className="section-title">Category Start Times</h2>
            <div className="subtle">
              Set start time per kategori. Jika diisi, sistem akan menghitung{" "}
              <b>total time = finish time - start time kategori</b>
              untuk kategori tersebut (mengabaikan start time per peserta).
            </div>
          </div>
          <button className="btn" onClick={applyCatStart}>
            Save Start Times
          </button>
        </div>

        <div className="table-wrap">
          <table className="f1-table compact">
            <thead>
              <tr>
                <th>Category</th>
                <th>Start Time (datetime)</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_KEYS.map((catKey) => (
                <tr key={catKey} className="row-hover">
                  <td className="name-cell">{catKey}</td>
                  <td>
                    <input
                      className="search"
                      style={{ width: "100%" }}
                      placeholder="contoh: 2025-11-23 07:00:00.000"
                      value={catStart[catKey] || ""}
                      onChange={(e) =>
                        setCatStart((prev) => ({
                          ...prev,
                          [catKey]: e.target.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="subtle" style={{ marginTop: 8 }}>
          Gunakan format tanggal & jam yang sama dengan di CSV timing
          (misal: <code>2025-11-23 07:00:00.000</code>). Jika kolom dikosongkan,
          kategori tersebut akan kembali memakai start time per peserta dari
          CSV start.
        </div>
      </div>

      {/* DSQ Management */}
      <div className="card">
        <div className="header-row">
          <div>
            <h2 className="section-title">Disqualification (Manual)</h2>
            <div className="subtle">
              Toggle DSQ per runner (by EPC). DSQ tetap tampil di tabel tapi
              tanpa rank.
            </div>
          </div>
          <input
            className="search"
            placeholder="Search BIB / Name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="f1-table">
            <thead>
              <tr>
                <th className="col-bib">BIB</th>
                <th>NAME</th>
                <th className="col-gender">GENDER</th>
                <th className="col-cat">CATEGORY</th>
                <th style={{ width: 120 }}>STATUS</th>
                <th style={{ width: 120 }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isDQ = !!dqMap[r.epc];
                return (
                  <tr key={r.epc} className="row-hover">
                    <td className="mono">{r.bib}</td>
                    <td className="name-cell">{r.name}</td>
                    <td>{r.gender}</td>
                    <td>{r.category}</td>
                    <td className="mono strong">{isDQ ? "DSQ" : "OK"}</td>
                    <td>
                      <button
                        className="btn ghost"
                        onClick={() => toggleDQ(r.epc)}
                      >
                        {isDQ ? "Undo DSQ" : "Disqualify"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No runners matched.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
