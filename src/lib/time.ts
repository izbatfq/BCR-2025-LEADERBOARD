// src/lib/time.ts

// Parser utama untuk semua waktu (start/finish/override)
export default function parseTimeToMs(raw: string): {
  ms: number | null;
  raw: string;
} {
  if (!raw) return { ms: null, raw };
  const str = raw.trim();

  // 1️⃣ Full datetime format: 2025-11-23 07:00:00.000 atau 2025-11-23T07:00:00
  const dtMatch = str.match(
    /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/
  );
  if (dtMatch) {
    const [, Y, M, D, h, m, s, msStr] = dtMatch;
    const ms = msStr ? Number(msStr.padEnd(3, "0").slice(0, 3)) : 0;
    const date = new Date(
      Number(Y),
      Number(M) - 1,
      Number(D),
      Number(h),
      Number(m),
      Number(s),
      ms
    );
    return { ms: date.getTime(), raw };
  }

  // 2️⃣ Time of day: HH:mm:ss(.SSS)
  const tMatch = str.match(/(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
  if (tMatch) {
    const [, h, m, s, msStr] = tMatch;
    const ms = msStr ? Number(msStr.padEnd(3, "0").slice(0, 3)) : 0;
    const now = new Date();
    now.setHours(Number(h), Number(m), Number(s), ms);
    return { ms: now.getTime(), raw };
  }

  // 3️⃣ Hour-minute: HH:mm
  const hm = str.match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    const [, h, m] = hm;
    const now = new Date();
    now.setHours(Number(h), Number(m), 0, 0);
    return { ms: now.getTime(), raw };
  }

  // 4️⃣ Hour only: "7"
  if (/^\d{1,2}$/.test(str)) {
    const h = Number(str);
    const now = new Date();
    now.setHours(h, 0, 0, 0);
    return { ms: now.getTime(), raw };
  }

  // 5️⃣ Fallback: Date.parse (handle 2025-11-23 07:00:00)
  const parsed = Date.parse(str.replace(" ", "T"));
  if (!Number.isNaN(parsed)) return { ms: parsed, raw };

  return { ms: null, raw };
}

/**
 * Ambil hanya HH:MM:SS.mmm dari string datetime/timestamp
 * "2025-11-23 08:28:28.915" → "08:28:28.915"
 */
export function extractTimeOfDay(raw: string): string {
  if (!raw) return "-";
  const m = raw.match(/(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/);
  if (m) {
    let t = m[1];
    if (t.includes(".")) {
      const [hhmmss, frac] = t.split(".");
      t = `${hhmmss}.${frac.padEnd(3, "0").slice(0, 3)}`;
    } else {
      t = `${t}.000`;
    }
    return t;
  }
  return raw;
}

/**
 * Format durasi ms → HH:MM:SS (dipakai untuk Total Time)
 */
export function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "-";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
