import React, { useEffect, useMemo, useState } from "react";
import type { LeaderRow } from "./LeaderboardTable";
import { CATEGORY_KEYS, DEFAULT_EVENT_TITLE, LS_DATA_VERSION, LS_EVENT_TITLE, type CsvKind } from "../lib/config";
import { putCsvFile, deleteCsvFile, listCsvMeta } from "../lib/idb";
import { uploadCsvToBlob, deleteCsvFromBlob, listCsvMetaFromBlob } from "../lib/vercelBlob";
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

function formatNowAsTimestamp(): string {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${Y}-${M}-${D} ${h}:${m}:${s}.${ms}`;
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
        try {
          const meta = await listCsvMetaFromBlob();
          setCsvMeta(meta as any);
        } catch {
          const meta = await listCsvMeta();
          setCsvMeta(meta as any);
        }
      } catch {
        // ignore
      }
    })();
  }, [authed]);

  const refreshCsvMeta = async () => {
    try {
      try {
        const meta = await listCsvMetaFromBlob();
        setCsvMeta(meta as any);
      } catch {
        const meta = await listCsvMeta();
        setCsvMeta(meta as any);
      }
    } catch (error) {
      console.error('Error refreshing CSV meta:', error);
    }
  };

  const saveEventTitle = () => {
    const t = (eventTitle || "").trim();
    localStorage.setItem(LS_EVENT_TITLE, t || DEFAULT_EVENT_TITLE);
    bumpDataVersion();
    onConfigChanged();
    alert("Judul event berhasil diperbarui");
  };

  const uploadCsv = async (kind: CsvKind, file: File) => {
    const text = await file.text();
    const grid = parseCsv(text);
    
    if (!grid || grid.length === 0) {
      alert(`CSV '${kind}': File kosong atau tidak valid.`);
      return;
    }
    
    const headers = (grid[0] || []).map((x) => String(x || "").trim());
    
    // Normalize headers untuk matching (sama seperti di data.ts)
    function norm(s: string) {
      return String(s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/\n/g, " ")
        .trim();
    }
    
    const headersNorm = headers.map(norm);

    // Menggunakan headerAliases yang sama dengan data.ts
    const headerAliases: Record<string, string[]> = {
      epc: ["epc", "uid", "tag", "rfid", "chip epc", "epc code"],
      bib: ["bib", "no bib", "bib number", "race bib", "nomor bib", "no. bib"],
      name: ["nama lengkap", "full name", "name", "nama", "participant name"],
      gender: ["jenis kelamin", "gender", "sex", "jk", "kelamin"],
      category: ["kategori", "category", "kelas", "class"],
      times: ["times", "time", "timestamp", "start time", "finish time", "jam", "checkpoint time", "cp time"],
    };

    // Validasi untuk Master CSV
    if (kind === "master") {
      const epcAliases = headerAliases.epc.map(norm);
      const hasEpc = headersNorm.some((h) => 
        epcAliases.some((alias) => h === alias || h.includes(alias))
      );
      
      if (!hasEpc) {
        const headerList = headers.length > 0 ? headers.join(", ") : "(tidak ada header)";
        alert(
          `CSV '${kind}': kolom EPC tidak ditemukan.\n\n` +
          `Kolom yang ditemukan: ${headerList}\n\n` +
          `Format Master CSV harus memiliki kolom:\n` +
          `- EPC (atau UID, Tag, RFID, Chip EPC)\n` +
          `- NO BIB (atau BIB, Bib Number)\n` +
          `- Nama Lengkap (atau Name, Nama)\n` +
          `- Gender (atau Jenis Kelamin, JK)\n` +
          `- Kategori (atau Category, Kelas)\n\n` +
          `Catatan: CSV yang diupload sepertinya adalah hasil export leaderboard.\n` +
          `Master CSV harus berisi data peserta dengan kolom EPC untuk matching.`
        );
        return;
      }
    }

    // Validasi untuk Start, Finish, Checkpoint CSV
    if (kind !== "master") {
      const epcAliases = headerAliases.epc.map(norm);
      const timesAliases = headerAliases.times.map(norm);
      
      const hasEpc = headersNorm.some((h) => 
        epcAliases.some((alias) => h === alias || h.includes(alias))
      );
      const hasTimes = headersNorm.some((h) => 
        timesAliases.some((alias) => h === alias || h.includes(alias))
      );
      
      if (!hasEpc) {
        const headerList = headers.length > 0 ? headers.join(", ") : "(tidak ada header)";
        alert(
          `CSV '${kind}': kolom EPC tidak ditemukan.\n\n` +
          `Kolom yang ditemukan: ${headerList}\n\n` +
          `Format CSV '${kind}' harus memiliki:\n` +
          `- EPC (atau UID, Tag, RFID)\n` +
          `- Times (atau Time, Timestamp, Jam)`
        );
        return;
      }
      
      if (!hasTimes) {
        const headerList = headers.length > 0 ? headers.join(", ") : "(tidak ada header)";
        alert(
          `CSV '${kind}': kolom Times/Time tidak ditemukan.\n\n` +
          `Kolom yang ditemukan: ${headerList}\n\n` +
          `Format CSV '${kind}' harus memiliki:\n` +
          `- EPC (atau UID, Tag, RFID)\n` +
          `- Times (atau Time, Timestamp, Jam)`
        );
        return;
      }
    }

    const rows = countDataRows(grid);
    const isDev = import.meta.env.DEV;
    
    if (isDev) {
      await putCsvFile({ kind, text, filename: file.name, rows });
    } else {
      try {
        const blob = await uploadCsvToBlob(kind, file);
        console.log('File uploaded to Vercel Blob:', blob.url);
        const response = await fetch(blob.url);
        const uploadedText = await response.text();
        await putCsvFile({ kind, text: uploadedText, filename: file.name, rows });
      } catch (error: any) {
        console.error('Upload to Vercel Blob failed, using IndexedDB only:', error);
        await putCsvFile({ kind, text, filename: file.name, rows });
      }
    }
    
    bumpDataVersion();
    onConfigChanged();
    await refreshCsvMeta();
    alert(`'${kind}' berhasil diupload (${rows} baris)`);
  };

  const clearAllCsv = async () => {
    if (!confirm("Reset semua CSV yang sudah diupload?")) return;
    for (const k of ["master", "start", "finish", "checkpoint"] as CsvKind[]) {
      try {
        await deleteCsvFromBlob(k);
      } catch (error) {
        console.error(`Failed to delete ${k} from blob:`, error);
      }
      await deleteCsvFile(k);
    }
    bumpDataVersion();
    onConfigChanged();
    await refreshCsvMeta();
    alert("Semua CSV yang diupload telah dihapus");
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
      alert("Kredensial tidak valid");
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
    alert("Cut off time berhasil diperbarui");
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
      "Waktu start kategori berhasil diperbarui.\nTotal time akan menggunakan nilai ini per kategori."
    );
  };

  if (!authed) {
    return (
      <div className="card">
        <h2 className="section-title">Admin Login</h2>
        <div className="subtle">Akses terbatas</div>

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
              Data timing sekarang berasal dari file CSV upload (bukan Google Sheet).
              <b>Master &amp; Finish wajib</b>. <b>Start tidak wajib</b> jika kamu memakai
              <b> Category Start Times</b> (start global per kategori) di bawah.
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
            <li><b>Finish / Checkpoint</b>: EPC, Times (atau Time / Timestamp)</li>
            <li><b>Start</b>: optional (bisa pakai Category Start Times). Jika dipakai: EPC, Times (atau Time / Timestamp)</li>
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
                <th style={{ width: 200 }}>Action</th>
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
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          setCatStart((prev) => ({
                            ...prev,
                            [catKey]: formatNowAsTimestamp(),
                          }))
                        }
                      >
                        Set Now
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          setCatStart((prev) => ({
                            ...prev,
                            [catKey]: "",
                          }))
                        }
                      >
                        Clear
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="subtle" style={{ marginTop: 8 }}>
          Gunakan format tanggal &amp; jam yang sama dengan di CSV timing
          (misal: <code>2025-11-23 07:00:00.000</code>). Kamu juga bisa klik <b>Set Now</b>
          untuk mengisi otomatis berdasarkan jam saat ini. Jika kolom dikosongkan,
          kategori tersebut akan kembali memakai start time per peserta dari CSV start (jika ada).
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
                    Tidak ada peserta yang cocok.
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
