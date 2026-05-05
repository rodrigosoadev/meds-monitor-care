import { useEffect, useState, useCallback } from "react";

export type MedFrequency = "daily" | "alternate" | "weekly";
export type MedIcon = "pill" | "syrup" | "injection" | "capsule" | "drop";

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: MedFrequency;
  weekdays?: number[]; // for weekly: 0-6
  times: string[]; // "HH:mm"
  category: string; // e.g. "Pós-almoço"
  icon: MedIcon;
  photo?: string; // dataURL
  startDate: string; // ISO yyyy-mm-dd
  durationDays?: number; // undefined = continuous
  createdAt: string;
}

export interface DoseLog {
  id: string; // medId + date + time
  medId: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm scheduled
  takenAt?: string; // ISO when marked
  status: "taken" | "missed" | "pending";
}

const KEY_MEDS = "medimind:meds";
const KEY_LOGS = "medimind:logs";

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

export function isMedScheduledOn(med: Medication, date: Date): boolean {
  const start = parseDate(med.startDate);
  if (date < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false;
  if (med.durationDays) {
    const end = new Date(start);
    end.setDate(end.getDate() + med.durationDays - 1);
    if (date > end) return false;
  }
  if (med.frequency === "daily") return true;
  if (med.frequency === "alternate") {
    const diff = Math.floor((+date - +start) / 86400000);
    return diff % 2 === 0;
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
      createdAt: new Date().toISOString(),
    },
    {
      id: "m3",
      name: "Vitamina D",
      dosage: "2000 UI",
      frequency: "daily",
      times: ["09:00"],
      category: "Manhã",
      icon: "drop",
      startDate: todayStr(start),
      createdAt: new Date().toISOString(),
    },
    {
      id: "m4",
      name: "Sinvastatina",
      dosage: "20mg",
      frequency: "daily",
      times: ["22:00"],
      category: "Antes de dormir",
      icon: "pill",
      startDate: todayStr(start),
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(KEY_MEDS, JSON.stringify(meds));

  // Generate logs for last 120 days
  const logs: DoseLog[] = [];
  for (let i = 120; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = todayStr(d);
    for (const med of meds) {
      if (!isMedScheduledOn(med, d)) continue;
      for (const t of med.times) {
        // Random adherence weighted ~ 80% taken
        const r = Math.random();
        const status: DoseLog["status"] = r < 0.8 ? "taken" : "missed";
        logs.push({
          id: logId(med.id, ds, t),
          medId: med.id,
          date: ds,
          time: t,
          status,
          takenAt: status === "taken" ? new Date(d).toISOString() : undefined,
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

export function addMed(med: Omit<Medication, "id" | "createdAt">) {
  const meds = read<Medication[]>(KEY_MEDS, []);
  const newMed: Medication = {
    ...med,
    id: `m${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  meds.push(newMed);
  write(KEY_MEDS, meds);
  return newMed;
}

export function deleteMed(id: string) {
  const meds = read<Medication[]>(KEY_MEDS, []).filter((m) => m.id !== id);
  write(KEY_MEDS, meds);
}

export function markDose(medId: string, date: string, time: string, status: DoseLog["status"]) {
  const logs = read<DoseLog[]>(KEY_LOGS, []);
  const id = logId(medId, date, time);
  const idx = logs.findIndex((l) => l.id === id);
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
}

export function getScheduledDosesForDate(meds: Medication[], logs: DoseLog[], date: Date): ScheduledDose[] {
  const ds = todayStr(date);
  const out: ScheduledDose[] = [];
  for (const med of meds) {
    if (!isMedScheduledOn(med, date)) continue;
    for (const t of med.times) {
      out.push({
        medId: med.id,
        med,
        date: ds,
        time: t,
        status: getDoseStatus(logs, med.id, ds, t),
      });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

export function getAdherenceForDate(meds: Medication[], logs: DoseLog[], date: Date): { total: number; taken: number; ratio: number } {
  const doses = getScheduledDosesForDate(meds, logs, date);
  const total = doses.length;
  const taken = doses.filter((d) => d.status === "taken").length;
  return { total, taken, ratio: total ? taken / total : 0 };
}

export function heatLevel(ratio: number, total: number): 0 | 1 | 2 | 3 | 4 {
  if (total === 0) return 0;
  if (ratio === 0) return 0;
  if (ratio < 0.5) return 1;
  if (ratio < 0.8) return 2;
  if (ratio < 1) return 3;
  return 4;
}
