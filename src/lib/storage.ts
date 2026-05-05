import { useEffect, useState, useCallback } from "react";

export type MedFrequency =
  | "daily"
  | "alternate"
  | "weekly"
  | "interval_hours"
  | "interval_days";
export type MedIcon = "pill" | "syrup" | "injection" | "capsule" | "drop";
export type MedStatus = "active" | "paused" | "archived";

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: MedFrequency;
  weekdays?: number[]; // weekly: 0-6
  intervalHours?: number; // interval_hours: e.g. 8, 12
  intervalDays?: number; // interval_days: e.g. 2, 3
  startTime?: string; // "HH:mm" anchor for interval_hours
  times: string[]; // "HH:mm" — explicit list (or computed for hours)
  category: string;
  icon: MedIcon;
  photo?: string;
  startDate: string; // ISO yyyy-mm-dd
  durationDays?: number;
  stock?: number;
  lowStockThreshold?: number;
  status: MedStatus;
  createdAt: string;
}

export interface DoseLog {
  id: string;
  medId: string;
  date: string;
  time: string;
  takenAt?: string;
  status: "taken" | "missed" | "pending";
}

const KEY_MEDS = "medimind:meds:v2";
const KEY_LOGS = "medimind:logs:v2";

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("medimind:update"));
}

/** Compute the daily list of times for a med (resolves interval_hours dynamically). */
export function computeDailyTimes(med: Medication): string[] {
  if (med.frequency === "interval_hours" && med.intervalHours && med.startTime) {
    const out: string[] = [];
    const [sh, sm] = med.startTime.split(":").map(Number);
    let mins = sh * 60 + sm;
    const step = med.intervalHours * 60;
    const seen = new Set<string>();
    // Build doses across 24h starting at startTime
    for (let i = 0; i < Math.ceil(1440 / step) + 1; i++) {
      const m = ((mins + i * step) % 1440 + 1440) % 1440;
      const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      if (seen.has(t)) break;
      seen.add(t);
      out.push(t);
    }
    return out.sort();
  }
  return [...med.times].sort();
}

export function isMedScheduledOn(med: Medication, date: Date): boolean {
  if (med.status !== "active") return false;
  const start = parseDate(med.startDate);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (day < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false;
  if (med.durationDays) {
    const end = new Date(start);
    end.setDate(end.getDate() + med.durationDays - 1);
    if (day > end) return false;
  }
  if (med.frequency === "daily" || med.frequency === "interval_hours") return true;
  if (med.frequency === "alternate") {
    const diff = Math.floor((+day - +start) / 86400000);
    return diff % 2 === 0;
  }
  if (med.frequency === "interval_days" && med.intervalDays) {
    const diff = Math.floor((+day - +start) / 86400000);
    return diff % med.intervalDays === 0;
  }
  if (med.frequency === "weekly") {
    return (med.weekdays ?? []).includes(date.getDay());
  }
  return false;
}

export function logId(medId: string, date: string, time: string) {
  return `${medId}|${date}|${time}`;
}

// ---- Seed demo data ----
function seed() {
  const medsExist = localStorage.getItem(KEY_MEDS);
  if (medsExist) return;
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 120);

  const meds: Medication[] = [
    {
      id: "m1",
      name: "Losartana",
      dosage: "50mg",
      frequency: "daily",
      times: ["08:00", "20:00"],
      category: "Pós-refeição",
      icon: "pill",
      startDate: todayStr(start),
      stock: 42,
      lowStockThreshold: 10,
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "m2",
      name: "Metformina",
      dosage: "850mg",
      frequency: "daily",
      times: ["12:30"],
      category: "Pós-almoço",
      icon: "capsule",
      startDate: todayStr(start),
      stock: 18,
      lowStockThreshold: 7,
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "m3",
      name: "Vitamina D",
      dosage: "2000 UI",
      frequency: "interval_days",
      intervalDays: 2,
      times: ["09:00"],
      category: "Manhã",
      icon: "drop",
      startDate: todayStr(start),
      stock: 30,
      lowStockThreshold: 5,
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "m4",
      name: "Sinvastatina",
      dosage: "20mg",
      frequency: "interval_hours",
      intervalHours: 12,
      startTime: "08:00",
      times: [],
      category: "Cardiovascular",
      icon: "pill",
      startDate: todayStr(start),
      stock: 6,
      lowStockThreshold: 10,
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(KEY_MEDS, JSON.stringify(meds));

  const logs: DoseLog[] = [];
  for (let i = 120; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = todayStr(d);
    for (const med of meds) {
      if (!isMedScheduledOn(med, d)) continue;
      const times = computeDailyTimes(med);
      for (const t of times) {
        const r = Math.random();
        const status: DoseLog["status"] = r < 0.82 ? "taken" : "missed";
        let takenAt: string | undefined;
        if (status === "taken") {
          // Random delay 0–90 minutes
          const [h, m] = t.split(":").map(Number);
          const taken = new Date(d);
          taken.setHours(h, m + Math.floor(Math.random() * 90), 0, 0);
          takenAt = taken.toISOString();
        }
        logs.push({
          id: logId(med.id, ds, t),
          medId: med.id,
          date: ds,
          time: t,
          status,
          takenAt,
        });
      }
    }
  }
  localStorage.setItem(KEY_LOGS, JSON.stringify(logs));
}

export function ensureSeed() {
  if (typeof window === "undefined") return;
  seed();
}

// ---- React hooks ----
export function useMeds() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const refresh = useCallback(() => setMeds(read<Medication[]>(KEY_MEDS, [])), []);
  useEffect(() => {
    ensureSeed();
    refresh();
    const onUp = () => refresh();
    window.addEventListener("medimind:update", onUp);
    window.addEventListener("storage", onUp);
    return () => {
      window.removeEventListener("medimind:update", onUp);
      window.removeEventListener("storage", onUp);
    };
  }, [refresh]);
  return meds;
}

export function useLogs() {
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const refresh = useCallback(() => setLogs(read<DoseLog[]>(KEY_LOGS, [])), []);
  useEffect(() => {
    ensureSeed();
    refresh();
    const onUp = () => refresh();
    window.addEventListener("medimind:update", onUp);
    window.addEventListener("storage", onUp);
    return () => {
      window.removeEventListener("medimind:update", onUp);
      window.removeEventListener("storage", onUp);
    };
  }, [refresh]);
  return logs;
}

export function addMed(med: Omit<Medication, "id" | "createdAt" | "status"> & { status?: MedStatus }) {
  const meds = read<Medication[]>(KEY_MEDS, []);
  const newMed: Medication = {
    ...med,
    status: med.status ?? "active",
    id: `m${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  meds.push(newMed);
  write(KEY_MEDS, meds);
  return newMed;
}

export function updateMed(id: string, patch: Partial<Medication>) {
  const meds = read<Medication[]>(KEY_MEDS, []);
  const idx = meds.findIndex((m) => m.id === id);
  if (idx < 0) return;
  meds[idx] = { ...meds[idx], ...patch, id: meds[idx].id };
  write(KEY_MEDS, meds);
}

export function deleteMed(id: string) {
  const meds = read<Medication[]>(KEY_MEDS, []).filter((m) => m.id !== id);
  write(KEY_MEDS, meds);
}

export function setMedStatus(id: string, status: MedStatus) {
  updateMed(id, { status });
}

export function adjustStock(id: string, delta: number) {
  const meds = read<Medication[]>(KEY_MEDS, []);
  const idx = meds.findIndex((m) => m.id === id);
  if (idx < 0) return;
  if (typeof meds[idx].stock !== "number") return;
  meds[idx] = { ...meds[idx], stock: Math.max(0, (meds[idx].stock ?? 0) + delta) };
  write(KEY_MEDS, meds);
}

export function markDose(medId: string, date: string, time: string, status: DoseLog["status"]) {
  const logs = read<DoseLog[]>(KEY_LOGS, []);
  const id = logId(medId, date, time);
  const idx = logs.findIndex((l) => l.id === id);
  const prev = idx >= 0 ? logs[idx].status : "pending";
  const log: DoseLog = {
    id,
    medId,
    date,
    time,
    status,
    takenAt: status === "taken" ? new Date().toISOString() : undefined,
  };
  if (idx >= 0) logs[idx] = log;
  else logs.push(log);
  write(KEY_LOGS, logs);

  // Stock changes only when taken state actually flips
  if (prev !== "taken" && status === "taken") adjustStock(medId, -1);
  else if (prev === "taken" && status !== "taken") adjustStock(medId, +1);
}

export function getDoseStatus(logs: DoseLog[], medId: string, date: string, time: string): DoseLog["status"] {
  const id = logId(medId, date, time);
  return logs.find((l) => l.id === id)?.status ?? "pending";
}

export interface ScheduledDose {
  medId: string;
  med: Medication;
  date: string;
  time: string;
  status: DoseLog["status"];
  takenAt?: string;
}

export function getScheduledDosesForDate(meds: Medication[], logs: DoseLog[], date: Date): ScheduledDose[] {
  const ds = todayStr(date);
  const out: ScheduledDose[] = [];
  for (const med of meds) {
    if (!isMedScheduledOn(med, date)) continue;
    const times = computeDailyTimes(med);
    for (const t of times) {
      const id = logId(med.id, ds, t);
      const log = logs.find((l) => l.id === id);
      out.push({
        medId: med.id,
        med,
        date: ds,
        time: t,
        status: log?.status ?? "pending",
        takenAt: log?.takenAt,
      });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

export function getAdherenceForDate(
  meds: Medication[],
  logs: DoseLog[],
  date: Date,
): { total: number; taken: number; ratio: number; onTimeRatio: number } {
  const doses = getScheduledDosesForDate(meds, logs, date);
  const total = doses.length;
  const taken = doses.filter((d) => d.status === "taken").length;
  // on-time = taken within +/- 30 min of scheduled
  let onTime = 0;
  for (const d of doses) {
    if (d.status !== "taken" || !d.takenAt) continue;
    const [h, m] = d.time.split(":").map(Number);
    const sched = new Date(d.date + "T00:00:00");
    sched.setHours(h, m, 0, 0);
    const diff = Math.abs(new Date(d.takenAt).getTime() - sched.getTime());
    if (diff <= 30 * 60 * 1000) onTime++;
  }
  return { total, taken, ratio: total ? taken / total : 0, onTimeRatio: taken ? onTime / taken : 0 };
}

/** Heat level 0..4 with a "5" for perfect on-time. */
export function heatLevel(ratio: number, total: number, onTimeRatio = 0): 0 | 1 | 2 | 3 | 4 | 5 {
  if (total === 0 || ratio === 0) return 0;
  if (ratio < 0.5) return 1;
  if (ratio < 0.8) return 2;
  if (ratio < 1) return 3;
  // 100% taken — distinguish on-time vs late
  if (onTimeRatio >= 0.8) return 5;
  return 4;
}
