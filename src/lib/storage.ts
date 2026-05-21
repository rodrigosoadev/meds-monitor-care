import { useEffect, useState, useCallback } from "react";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { toast } from "sonner";
import {
  onNotificationPermissionGranted,
  rescheduleAllNotifications,
  syncNotificationPermissionState,
} from "./notifications";

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
  weekdays?: number[];
  intervalHours?: number;
  intervalDays?: number;
  startTime?: string;
  times: string[];
  category: string;
  icon: MedIcon;
  photo?: string;
  startDate: string;
  durationDays?: number;
  stock?: number;
  lowStockThreshold?: number;
  status: MedStatus;
  createdAt: string;
  /** IDs locais agendados no dispositivo (persistidos no Supabase). */
  notificationIds?: number[];
}

export interface DoseLog {
  id: string;
  medId: string;
  date: string;
  time: string;
  takenAt?: string;
  status: "taken" | "missed" | "pending" | "delayed";
}

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

// ---- Row <-> Domain mapping ----
type MedRow = {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  category: string | null;
  icon: MedIcon;
  photo: string | null;
  frequency: MedFrequency;
  weekdays: number[] | null;
  interval_hours: number | null;
  interval_days: number | null;
  start_time: string | null;
  times: string[] | null;
  start_date: string;
  duration_days: number | null;
  stock: number | null;
  low_stock_threshold: number | null;
  status: MedStatus;
  created_at: string;
  notification_ids: number[] | null;
};

function rowToMed(r: MedRow): Medication {
  return {
    id: r.id,
    name: r.name,
    dosage: r.dosage,
    category: r.category ?? "",
    icon: r.icon,
    photo: r.photo ?? undefined,
    frequency: r.frequency,
    weekdays: r.weekdays ?? undefined,
    intervalHours: r.interval_hours ?? undefined,
    intervalDays: r.interval_days ?? undefined,
    startTime: r.start_time ?? undefined,
    times: r.times ?? [],
    startDate: r.start_date,
    durationDays: r.duration_days ?? undefined,
    stock: r.stock ?? undefined,
    lowStockThreshold: r.low_stock_threshold ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    notificationIds: r.notification_ids ?? [],
  };
}

/** Atualiza cache após persistir IDs de notificação (evita import circular). */
export function patchCachedMedNotificationIds(medId: string, ids: number[]) {
  cachedMeds = cachedMeds.map((m) => (m.id === medId ? { ...m, notificationIds: ids } : m));
  notify();
}

function medToInsert(m: Omit<Medication, "id" | "createdAt" | "status"> & { status?: MedStatus }, userId: string) {
  return {
    user_id: userId,
    name: m.name,
    dosage: m.dosage,
    category: m.category || null,
    icon: m.icon,
    photo: m.photo ?? null,
    frequency: m.frequency,
    weekdays: m.weekdays ?? null,
    interval_hours: m.intervalHours ?? null,
    interval_days: m.intervalDays ?? null,
    start_time: m.startTime ?? null,
    times: m.times ?? [],
    start_date: m.startDate,
    duration_days: m.durationDays ?? null,
    stock: m.stock ?? null,
    low_stock_threshold: m.lowStockThreshold ?? null,
    status: m.status ?? "active",
  };
}

function medToUpdate(p: Partial<Medication>) {
  const u: Record<string, unknown> = {};
  if (p.name !== undefined) u.name = p.name;
  if (p.dosage !== undefined) u.dosage = p.dosage;
  if (p.category !== undefined) u.category = p.category || null;
  if (p.icon !== undefined) u.icon = p.icon;
  if (p.photo !== undefined) u.photo = p.photo ?? null;
  if (p.frequency !== undefined) u.frequency = p.frequency;
  if ("weekdays" in p) u.weekdays = p.weekdays ?? null;
  if ("intervalHours" in p) u.interval_hours = p.intervalHours ?? null;
  if ("intervalDays" in p) u.interval_days = p.intervalDays ?? null;
  if ("startTime" in p) u.start_time = p.startTime ?? null;
  if (p.times !== undefined) u.times = p.times;
  if (p.startDate !== undefined) u.start_date = p.startDate;
  if ("durationDays" in p) u.duration_days = p.durationDays ?? null;
  if ("stock" in p) u.stock = p.stock ?? null;
  if ("lowStockThreshold" in p) u.low_stock_threshold = p.lowStockThreshold ?? null;
  if (p.status !== undefined) u.status = p.status;
  return u;
}

type LogRow = {
  id: string;
  medication_id: string;
  user_id: string;
  scheduled_date: string;
  scheduled_time: string;
  taken_at: string | null;
  status: DoseLog["status"];
};

function rowToLog(r: LogRow): DoseLog {
  return {
    id: `${r.medication_id}|${r.scheduled_date}|${r.scheduled_time}`,
    medId: r.medication_id,
    date: r.scheduled_date,
    time: r.scheduled_time,
    takenAt: r.taken_at ?? undefined,
    status: r.status,
  };
}

// ---- Schedule logic (pure) ----
export function computeDailyTimes(med: Medication): string[] {
  if (med.frequency === "interval_hours" && med.intervalHours && med.startTime) {
    const out: string[] = [];
    const [sh, sm] = med.startTime.split(":").map(Number);
    const mins = sh * 60 + sm;
    const step = med.intervalHours * 60;
    const seen = new Set<string>();
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

// ---- Module-level cache + subscribers (single source of truth) ----
let cachedMeds: Medication[] = [];
let cachedLogs: DoseLog[] = [];

onNotificationPermissionGranted(() => {
  if (cachedMeds.length === 0) return;
  rescheduleAllNotifications(cachedMeds).catch((error) => {
    console.error("[Notifications] reschedule after permission granted failed:", error);
  });
});
let cachedUserId: string | null = null;
let initialized = false;
let loadingState = true;
const subs = new Set<() => void>();

function notify() {
  for (const s of subs) s();
}

async function loadAll(userId: string) {
  loadingState = true;
  notify();
  const [{ data: meds, error: mErr }, { data: logs, error: lErr }] = await Promise.all([
    supabase.from("medications").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("adherence_logs").select("*").eq("user_id", userId).order("scheduled_date", { ascending: true }).order("scheduled_time", { ascending: true }),
  ]);
  if (mErr) toast.error("Erro ao carregar medicamentos");
  if (lErr) toast.error("Erro ao carregar histórico");
  cachedMeds = (meds ?? []).map((r) => rowToMed(r as MedRow));
  cachedLogs = (logs ?? []).map((r) => rowToLog(r as LogRow));
  cachedUserId = userId;
  loadingState = false;
  initialized = true;
  notify();
  rescheduleAllNotifications(cachedMeds, { silent: true }).catch((error) => {
    console.error('[Notifications] reschedule after loadAll failed:', error);
  });
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let realtimeUserId: string | null = null;
const connectedStates = new Set(["joined", "joining", "subscribed", "connecting", "open"]);
let appStateListenerAttached = false;

function setupRealtime(userId: string) {
  console.log("[setupRealtime] Setting up realtime for user:", userId);
  if (realtimeChannel) {
    const status = realtimeChannel.state ?? (realtimeChannel as any).status;
    if (realtimeUserId === userId && connectedStates.has(status)) {
      console.log("[setupRealtime] Existing channel already connected for user", userId);
      return;
    }
    console.log("[setupRealtime] Removing old channel");
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    realtimeUserId = null;
  }

  realtimeUserId = userId;
  realtimeChannel = supabase
    .channel(`medimind:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "medications", filter: `user_id=eq.${userId}` }, (payload) => {
      console.log("[Realtime] Medications change received:", payload.eventType);
      if (payload.eventType === "DELETE") {
        const id = (payload.old as MedRow).id;
        cachedMeds = cachedMeds.filter((m) => m.id !== id);
      } else {
        const newMed = rowToMed(payload.new as MedRow);
        const idx = cachedMeds.findIndex((m) => m.id === newMed.id);
        if (idx >= 0) cachedMeds = cachedMeds.map((m) => (m.id === newMed.id ? newMed : m));
        else cachedMeds = [...cachedMeds, newMed];
      }
      notify();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "adherence_logs", filter: `user_id=eq.${userId}` }, (payload) => {
      console.log("[Realtime] Adherence logs change received:", payload.eventType);
      if (payload.eventType === "DELETE") {
        const old = payload.old as LogRow;
        cachedLogs = cachedLogs.filter((l) => l.id !== logId(old.medication_id, old.scheduled_date, old.scheduled_time));
      } else {
        const log = rowToLog(payload.new as LogRow);
        const idx = cachedLogs.findIndex((l) => l.id === log.id);
        if (idx >= 0) {
          cachedLogs = cachedLogs.map((l) => (l.id === log.id ? log : l));
        } else {
          cachedLogs = [...cachedLogs, log];
        }
      }
      notify();
    })
    .subscribe((status, err) => {
      console.log("[setupRealtime] Subscribe status:", status, "Error:", err);
      if (status === "SUBSCRIBED") {
        console.log("[setupRealtime] Realtime subscribed successfully");
      } else if (status === "CHANNEL_ERROR") {
        console.error("[setupRealtime] Channel error:", err);
      } else if (status === "TIMED_OUT") {
        console.error("[setupRealtime] Channel timed out");
      }
    });
}

function teardownRealtime() {
  if (realtimeChannel) {
    console.log("[teardownRealtime] Removing channel");
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    realtimeUserId = null;
  }
}

function ensureRealtimeConnected(userId: string) {
  if (!realtimeChannel || realtimeUserId !== userId) {
    console.log("[ensureRealtimeConnected] Channel missing or wrong user, setting up", userId, realtimeUserId);
    setupRealtime(userId);
    return;
  }
  const status = realtimeChannel.state ?? (realtimeChannel as any).status;
  console.log("[ensureRealtimeConnected] Current channel state:", status);
  if (!connectedStates.has(status)) {
    console.log("[ensureRealtimeConnected] Channel not connected, reconnecting");
    setupRealtime(userId);
  }
}

/** Hook that initialises the cache for the current user and subscribes to changes. */
function useStoreSync() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [, setTick] = useState(0);

  useEffect(() => {
    const sub = () => setTick((n) => n + 1);
    subs.add(sub);
    return () => {
      subs.delete(sub);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      cachedMeds = [];
      cachedLogs = [];
      cachedUserId = null;
      initialized = false;
      loadingState = false;
      teardownRealtime();
      notify();
      return;
    }

    if (cachedUserId !== userId) {
      loadAll(userId);
    }
    ensureRealtimeConnected(userId);
  }, [loading, userId]);

  useEffect(() => {
    if (appStateListenerAttached) return;
    appStateListenerAttached = true;

    App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;
      if (cachedMeds.length === 0) return;
      try {
        await syncNotificationPermissionState();
        await rescheduleAllNotifications(cachedMeds, { silent: true });
      } catch (error) {
        console.error('[Notifications] reschedule on app active failed:', error);
      }
    });
  }, []);
}

export function useMeds(): Medication[] {
  useStoreSync();
  return cachedMeds;
}

export function useLogs(): DoseLog[] {
  useStoreSync();
  return cachedLogs;
}

export function useStoreLoading(): boolean {
  useStoreSync();
  return loadingState && !initialized;
}

// ---- Mutations ----
async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export async function addMed(med: Omit<Medication, "id" | "createdAt" | "status"> & { status?: MedStatus }) {
  console.log("[addMed] Called");
  const uid = await getUid();
  if (!uid) return;
  const { error, data } = await supabase.from("medications").insert(medToInsert(med, uid)).select().single();
  if (error) {
    console.error("[addMed] Error:", error.message);
    toast.error(error.message);
    return;
  }
  console.log("[addMed] Success, updating cache");
  const newMed = rowToMed(data as MedRow);
  cachedMeds = [...cachedMeds, newMed];

  try {
    await rescheduleAllNotifications(cachedMeds);
  } catch (error) {
    console.error('[Notifications] reschedule after addMed failed:', error);
  }

  notify();
  ensureRealtimeConnected(uid);
}

export async function updateMed(id: string, patch: Partial<Medication>) {
  console.log("[updateMed] Called with id:", id);
  const u = medToUpdate(patch);
  if (Object.keys(u).length === 0) return;
  const uid = await getUid();
  const { error, data } = await supabase.from("medications").update(u as never).eq("id", id).select().single();
  if (error) {
    console.error("[updateMed] Error:", error.message);
    toast.error(error.message);
    return;
  }
  console.log("[updateMed] Success, updating cache");
  const updated = rowToMed(data as MedRow);
  cachedMeds = cachedMeds.map((m) => (m.id === id ? updated : m));

  try {
    await rescheduleAllNotifications(cachedMeds);
  } catch (error) {
    console.error('[Notifications] reschedule after updateMed failed:', error);
  }

  notify();
  if (uid) ensureRealtimeConnected(uid);
}

export async function deleteMed(id: string) {
  console.log("[deleteMed] Called with id:", id);
  const uid = await getUid();
  const { error } = await supabase.from("medications").delete().eq("id", id);
  if (error) {
    console.error("[deleteMed] Error:", error.message);
    toast.error(error.message);
    return;
  }
  console.log("[deleteMed] Success, updating cache");
  cachedMeds = cachedMeds.filter((m) => m.id !== id);

  try {
    await rescheduleAllNotifications(cachedMeds);
  } catch (error) {
    console.error('[Notifications] reschedule after deleteMed failed:', error);
  }

  notify();
  if (uid) ensureRealtimeConnected(uid);
}

export async function setMedStatus(id: string, status: MedStatus) {
  await updateMed(id, { status });
}

export async function adjustStock(id: string, delta: number) {
  const m = cachedMeds.find((x) => x.id === id);
  if (!m || typeof m.stock !== "number") return;
  const next = Math.max(0, m.stock + delta);
  const { error } = await supabase.from("medications").update({ stock: next }).eq("id", id);
  if (error) {
    toast.error(error.message);
    return;
  }
  cachedMeds = cachedMeds.map((x) => (x.id === id ? { ...x, stock: next } : x));
  notify();
}

export async function markDose(medId: string, date: string, time: string, status: DoseLog["status"]) {
  const uid = await getUid();
  if (!uid) return;
  const id = logId(medId, date, time);
  const prev = cachedLogs.find((l) => l.id === id)?.status ?? "pending";

  const payload = {
    medication_id: medId,
    user_id: uid,
    scheduled_date: date,
    scheduled_time: time,
    status,
    taken_at: status === "taken" ? new Date().toISOString() : null,
  };
  const { error } = await supabase
    .from("adherence_logs")
    .upsert(payload, { onConflict: "medication_id,scheduled_date,scheduled_time" });
  if (error) {
    toast.error(error.message);
    return;
  }

  const log: DoseLog = {
    id,
    medId,
    date,
    time,
    status,
    takenAt: payload.taken_at ?? undefined,
  };
  const idx = cachedLogs.findIndex((l) => l.id === id);
  if (idx >= 0) {
    cachedLogs = cachedLogs.map((l, i) => (i === idx ? log : l));
  } else {
    cachedLogs = [...cachedLogs, log];
  }
  notify();
  ensureRealtimeConnected(uid);

  if (prev !== "taken" && status === "taken") await adjustStock(medId, -1);
  else if (prev === "taken" && status !== "taken") await adjustStock(medId, +1);
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

export function heatLevel(ratio: number, total: number, onTimeRatio = 0): 0 | 1 | 2 | 3 | 4 | 5 {
  if (total === 0 || ratio === 0) return 0;
  if (ratio < 0.5) return 1;
  if (ratio < 0.8) return 2;
  if (ratio < 1) return 3;
  if (onTimeRatio >= 0.8) return 5;
  return 4;
}

// Backwards-compat no-op (was localStorage seed)
export function ensureSeed() {}
