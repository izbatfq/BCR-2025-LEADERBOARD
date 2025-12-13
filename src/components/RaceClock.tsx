import React, { useEffect, useMemo, useState } from "react";
import { CATEGORY_KEYS } from "../lib/config";
import parseTimeToMs from "../lib/time";

const LS_CUTOFF = "imr_cutoff_ms";
const LS_CAT_START = "imr_cat_start_raw";
const LS_EVENT_DATE = "imr_event_date"; // optional: "2025-11-23"

function normalizeCutoffMs(n: number | null): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  // kalau kecil (<=48) kita anggap jam
  if (n <= 48) return n * 3600000;
  return n;
}

function readCutoffMs(): number | null {
  const v = localStorage.getItem(LS_CUTOFF);
  if (!v) return null;
  return normalizeCutoffMs(Number(v));
}

function readCatStartRaw(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_CAT_START) || "{}");
  } catch {
    return {};
  }
}

function readEventDate(): string | null {
  const v = localStorage.getItem(LS_EVENT_DATE);
  if (!v) return null;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatCountdown(msLeft: number) {
  const safe = Math.max(0, msLeft);
  const totalSec = Math.floor(safe / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatPassed(msPassed: number) {
  const totalSec = Math.floor(Math.max(0, msPassed) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Tentukan tanggal dasar (YYYY-MM-DD) untuk time-only.
 * Priority:
 * 1) dari salah satu raw start kategori yang punya tanggal
 * 2) dari localStorage imr_event_date
 * 3) hari ini
 */
function deriveBaseDate(catStartRaw: Record<string, string>): string {
  for (const raw of Object.values(catStartRaw)) {
    const s = String(raw || "").trim();
    const m = s.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const stored = readEventDate();
  if (stored) return stored;
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
}

/**
 * Convert raw start kategori -> absolute ms
 * - kalau raw ada tanggal: parse langsung
 * - kalau raw cuma jam: tempel ke baseDate
 */
function toAbsStartMs(raw: string, baseDateYMD: string): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;

  if (/\d{4}-\d{2}-\d{2}/.test(s)) {
    const p = parseTimeToMs(s);
    return p.ms;
  }

  const t = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?/);
  if (!t) return null;

  const h = Number(t[1] || 0);
  const mi = Number(t[2] || 0);
  const se = Number(t[3] || 0);
  const ms = t[4] ? Number(String(t[4]).padEnd(3, "0").slice(0, 3)) : 0;

  const [Y, M, D] = baseDateYMD.split("-").map(Number);
  const d = new Date(Y, M - 1, D, h, mi, se, ms);
  return d.getTime();
}

export default function RaceClock() {
  const [nowMs, setNowMs] = useState(Date.now());
  const [slot, setSlot] = useState(0);

  const [cutoffMs, setCutoffMs] = useState<number | null>(readCutoffMs());
  const [catStartRaw, setCatStartRaw] = useState<Record<string, string>>(
    readCatStartRaw()
  );

  // tick clock
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // rotate categories each 20s
  useEffect(() => {
    const id = setInterval(() => setSlot((s) => s + 1), 20000);
    return () => clearInterval(id);
  }, []);

  // polling config every 2s (biar update setelah save admin)
  useEffect(() => {
    const id = setInterval(() => {
      setCutoffMs(readCutoffMs());
      setCatStartRaw(readCatStartRaw());
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const baseDateYMD = useMemo(() => deriveBaseDate(catStartRaw), [catStartRaw]);

  const catEntries = useMemo(() => {
    return CATEGORY_KEYS
      .map((key) => {
        const raw = catStartRaw[key];
        const startMs = raw ? toAbsStartMs(raw, baseDateYMD) : null;
        return { key, startMs };
      })
      .filter((x) => x.startMs != null) as Array<{
      key: string;
      startMs: number;
    }>;
  }, [catStartRaw, baseDateYMD]);

  useEffect(() => setSlot(0), [catEntries.length]);

  if (!cutoffMs) return null;

  if (catEntries.length === 0) {
    return (
      <div className="card" style={wrapStyle}>
        <div style={labelStyle}>Cut Off Clock</div>
        <div style={hintStyle}>Set start time per kategori di Admin.</div>
      </div>
    );
  }

  const active = catEntries[slot % catEntries.length];
  const endMs = active.startMs + cutoffMs;
  const leftMs = endMs - nowMs;

  const isPassed = leftMs <= 0;

  return (
    <div className="card" style={wrapStyle}>
      <div style={labelStyle}>COT {active.key}</div>

      <div style={timeStyle}>{formatCountdown(leftMs)}</div>

      <div style={statusStyle}>
        {isPassed
          ? `Cut Off Passed (+${formatPassed(-leftMs)})`
          : "Remaining Cut Off Time"}
      </div>

      <div style={rotateStyle}>
        Base Date: {baseDateYMD} • Rotating every 20s
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  margin: "12px auto 16px",
  textAlign: "center",
  background: "rgba(15, 23, 42, 0.95)",
  color: "#fff",
  borderRadius: 14,
  padding: "18px 16px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 16,
  opacity: 0.9,
  letterSpacing: 0.7,
  fontWeight: 700,
};

const timeStyle: React.CSSProperties = {
  fontSize: 46,
  fontWeight: 900,
  marginTop: 6,
  fontFamily: "Roboto, system-ui, sans-serif",
};

const statusStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.85,
  marginTop: 6,
};

const rotateStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.65,
  marginTop: 4,
};

const hintStyle: React.CSSProperties = {
  fontSize: 14,
  opacity: 0.85,
  marginTop: 6,
};
