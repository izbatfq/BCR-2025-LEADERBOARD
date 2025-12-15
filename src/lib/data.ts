// src/lib/data.ts

import parseTimeToMs from "./time";
import { parseCsv } from "./csvParse";
import { getCsvFile } from "./idb";
import { getCsvFromBlob } from "./vercelBlob";
import { CATEGORY_KEYS, type CategoryKey } from "./config";

const headerAliases: Record<string, string[]> = {
  epc: ["epc", "uid", "tag", "rfid", "chip epc", "epc code"],
  bib: ["bib", "no bib", "bib number", "race bib", "nomor bib", "no. bib"],
  name: ["nama lengkap", "full name", "name", "nama", "participant name"],
  gender: ["jenis kelamin", "gender", "sex", "jk", "kelamin"],
  category: ["kategori", "category", "kelas", "class"],
  times: [
    "times",
    "time",
    "timestamp",
    "start time",
    "finish time",
    "jam",
    "checkpoint time",
    "cp time",
  ],
};

function norm(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

function findColIndex(headers: string[], key: keyof typeof headerAliases): number {
  const aliases = headerAliases[key].map(norm);
  const hs = headers.map(norm);
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i];
    if (aliases.some((a) => h === a || h.includes(a))) return i;
  }
  return -1;
}

function normalizeGender(v: string): string {
  const s = norm(v);
  if (!s) return v;
  if (s.includes("perempuan") || s.includes("wanita") || s === "f" || s.includes("female")) return "Perempuan";
  if (s.includes("laki") || s.includes("pria") || s === "m" || s.includes("male")) return "Laki-laki";
  return v;
}

function normalizeCategoryFromMaster(args: {
  rawCategory: string;
  rawGender: string;
}): CategoryKey {
  const c = norm(args.rawCategory);
  const g = norm(args.rawGender);

  const is10k = c.includes("10") || c.includes("10k") || c.includes("10 km") || c.includes("10km");
  const is5k = c.includes("5") || c.includes("5k") || c.includes("5 km") || c.includes("5km");

  const female = g.includes("perempuan") || g.includes("wanita") || g === "f" || g.includes("female");

  if (is10k) return female ? "10K Perempuan" : "10K Laki-laki";
  if (is5k) return female ? "5K Perempuan" : "5K Laki-Laki";

  // fallback: try to match directly
  const direct = CATEGORY_KEYS.find((k) => norm(k) === c || norm(k).includes(c) || c.includes(norm(k)));
  return (direct as CategoryKey) || "10K Laki-laki";
}

export type MasterParticipant = {
  epc: string;
  bib: string;
  name: string;
  gender: string;
  category: string;
  sourceCategoryKey: CategoryKey;
};

async function requireCsvText(kind: "master" | "finish"): Promise<string> {
  // Try Vercel Blob first, fallback to IndexedDB
  let file = await getCsvFromBlob(kind);
  if (!file) {
    file = await getCsvFile(kind);
  }
  
  if (!file?.text) {
    throw new Error(
      `CSV '${kind}' belum diupload. Silakan login Admin → Upload CSV.`
    );
  }
  return file.text;
}

async function getCsvTextOptional(
  kind: "start" | "checkpoint"
): Promise<string | null> {
  // Try Vercel Blob first, fallback to IndexedDB
  let file = await getCsvFromBlob(kind);
  if (!file) {
    file = await getCsvFile(kind);
  }
  return file?.text || null;
}

export async function loadMasterParticipants(): Promise<{
  all: MasterParticipant[];
  byCategoryKey: Record<string, MasterParticipant[]>;
  byEpc: Map<string, MasterParticipant>;
}> {
  const text = await requireCsvText("master");
  const grid = parseCsv(text);
  if (!grid || grid.length <= 1) {
    return { all: [], byCategoryKey: {}, byEpc: new Map() };
  }

  const headers = (grid[0] || []).map(String);
  const epcIdx = findColIndex(headers, "epc");
  const bibIdx = findColIndex(headers, "bib");
  const nameIdx = findColIndex(headers, "name");
  const genderIdx = findColIndex(headers, "gender");
  const categoryIdx = findColIndex(headers, "category");

  if (epcIdx < 0) {
    throw new Error("Kolom EPC tidak ditemukan di Master CSV.");
  }

  const byEpc = new Map<string, MasterParticipant>();
  const byCategoryKey: Record<string, MasterParticipant[]> = {};
  CATEGORY_KEYS.forEach((k) => (byCategoryKey[k] = []));

  grid.slice(1).forEach((r) => {
    const epc = String(r[epcIdx] ?? "").trim();
    if (!epc) return;

    const rawGender = genderIdx >= 0 ? String(r[genderIdx] ?? "").trim() : "";
    const rawCategory = categoryIdx >= 0 ? String(r[categoryIdx] ?? "").trim() : "";

    const catKey = normalizeCategoryFromMaster({ rawCategory, rawGender });
    const gender = normalizeGender(rawGender);

    const p: MasterParticipant = {
      epc,
      bib: bibIdx >= 0 ? String(r[bibIdx] ?? "").trim() : "",
      name: nameIdx >= 0 ? String(r[nameIdx] ?? "").trim() : "",
      gender,
      category: catKey,
      sourceCategoryKey: catKey,
    };

    // prefer latest row if duplicate EPC
    byEpc.set(epc, p);
  });

  const all = Array.from(byEpc.values());
  all.forEach((p) => {
    if (!byCategoryKey[p.sourceCategoryKey]) byCategoryKey[p.sourceCategoryKey] = [];
    byCategoryKey[p.sourceCategoryKey].push(p);
  });

  return { all, byCategoryKey, byEpc };
}

export type TimeEntry = { ms: number | null; raw: string };

export async function loadTimesMap(kind: "start" | "finish"): Promise<Map<string, TimeEntry>> {
  const text =
    kind === "finish" ? await requireCsvText("finish") : await getCsvTextOptional("start");
  if (!text) {
    // START is optional (can be handled via Category Start Times in Admin)
    return new Map();
  }
  const grid = parseCsv(text);
  if (!grid || grid.length <= 1) return new Map();

  const headers = (grid[0] || []).map(String);
  const epcIdx = findColIndex(headers, "epc");
  const timesIdx = findColIndex(headers, "times");
  if (epcIdx < 0 || timesIdx < 0) {
    throw new Error(
      `Kolom EPC / Times tidak ditemukan di CSV '${kind}'. Pastikan ada kolom EPC dan Times.`
    );
  }

  const map = new Map<string, TimeEntry>();
  grid.slice(1).forEach((r) => {
    const epc = String(r[epcIdx] ?? "").trim();
    if (!epc) return;

    const rawStr = String(r[timesIdx] ?? "").trim();
    if (!rawStr) return;

    const parsed = parseTimeToMs(rawStr);
    const entry: TimeEntry = { ms: parsed.ms, raw: rawStr };

    const existing = map.get(epc);
    if (!existing) {
      map.set(epc, entry);
      return;
    }

    const newMs = entry.ms ?? null;
    const oldMs = existing.ms ?? null;

    // ✅ FINISH: take the latest scan (largest ms)
    if (kind === "finish") {
      if (newMs != null && (oldMs == null || newMs > oldMs)) {
        map.set(epc, entry);
      }
      return;
    }

    // ✅ START: take the earliest scan (smallest ms)
    if (kind === "start") {
      if (newMs != null && (oldMs == null || newMs < oldMs)) {
        map.set(epc, entry);
      }
      return;
    }
  });

  return map;
}

export async function loadCheckpointTimesMap(): Promise<Map<string, string[]>> {
  // checkpoint is optional
  // Try Vercel Blob first, fallback to IndexedDB
  let file = await getCsvFromBlob("checkpoint");
  if (!file) {
    file = await getCsvFile("checkpoint");
  }
  if (!file?.text) return new Map();

  const grid = parseCsv(file.text);
  if (!grid || grid.length <= 1) return new Map();

  const headers = (grid[0] || []).map(String);
  const epcIdx = findColIndex(headers, "epc");
  const timesIdx = findColIndex(headers, "times");
  if (epcIdx < 0) return new Map();

  const map = new Map<string, string[]>();
  grid.slice(1).forEach((r) => {
    const epc = String(r[epcIdx] ?? "").trim();
    if (!epc) return;

    const rawStr = timesIdx >= 0 ? String(r[timesIdx] ?? "").trim() : "";
    if (!map.has(epc)) map.set(epc, []);
    if (rawStr) map.get(epc)!.push(rawStr);
  });

  return map;
}
