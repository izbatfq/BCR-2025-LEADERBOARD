// src/lib/config.ts

// ✅ Canonical category keys (as requested)
export const CATEGORY_KEYS = [
  "10K Laki-laki",
  "10K Perempuan",
  "5K Laki-Laki",
  "5K Perempuan",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const DEFAULT_EVENT_TITLE = "IMR 2025 Timing By IZT Race Technology";

// LocalStorage keys
export const LS_EVENT_TITLE = "imr_event_title";
export const LS_DATA_VERSION = "imr_data_version"; // used to force refresh across tabs

// IndexedDB keys (for CSV file contents)
export const DB_NAME = "imr_timing_db";
export const DB_STORE = "files";

export type CsvKind = "master" | "start" | "finish" | "checkpoint";

export const CSV_KINDS: CsvKind[] = ["master", "start", "finish", "checkpoint"];
