import { Capacitor } from '@capacitor/core';
import type { PermissionState } from '@capacitor/core';
import {
  LocalNotifications,
  Weekday,
  type LocalNotificationSchema,
  type Schedule,
  type ScheduleEvery,
} from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Medication,
  isMedScheduledOn,
  computeDailyTimes,
  parseDate,
  patchCachedMedNotificationIds,
} from './storage';

const MED_CHANNEL_ID = 'medication_reminders_v2';
const NOTIFICATION_ACTION_TYPE = 'MARK_AS_TAKEN';
export const NOTIFICATION_ACTION_ID = 'mark_taken';
const MAX_NOTIFICATION_ID = 2147483647;
const MAX_MED_BASE = 2147483;
/** Dias de lembretes avulsos (frequências sem repetição nativa). */
const FINITE_SCHEDULE_HORIZON_DAYS = 60;

export type RescheduleOptions = {
  silent?: boolean;
};

export type RescheduleResult = {
  scheduled: number;
  activeMeds: number;
  permissionDenied: boolean;
  noUpcoming: boolean;
};

let lastPermissionGranted: boolean | null = null;
let permissionDeniedToastShown = false;
let exactAlarmPromptShown = false;
const permissionGrantedListeners = new Set<() => void>();

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Converte "22:00" + dia local em Date (horário real escolhido pelo usuário). */
export function buildScheduleDate(day: Date, timeHHmm: string): Date {
  const [hours, minutes] = timeHHmm.split(':').map(Number);
  const at = new Date(day);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

/** Próximo disparo futuro para esse horário, respeitando calendário do remédio. */
export function nextFireDate(med: Medication, timeHHmm: string): Date | null {
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < FINITE_SCHEDULE_HORIZON_DAYS; dayOffset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + dayOffset);
    if (!isMedScheduledOn(med, day)) continue;

    const at = buildScheduleDate(day, timeHHmm);
    if (at > now) return at;
  }
  return null;
}

function jsWeekdayToCapacitor(jsDay: number): Weekday {
  return (jsDay + 1) as Weekday;
}

function isContinuousTreatment(med: Medication): boolean {
  return med.durationDays == null || med.durationDays <= 0;
}

function treatmentEnded(med: Medication): boolean {
  if (!med.durationDays) return false;
  const start = parseDate(med.startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + med.durationDays - 1);
  end.setHours(23, 59, 59, 999);
  return new Date() > end;
}

/** ID estável por remédio + horário (+ dia da semana se semanal). */
export function stableNotificationId(medId: string, timeIndex: number, weekday = 0): number {
  const medBase = normalizeMedicationId(medId);
  return Math.min(MAX_NOTIFICATION_ID, medBase * 1000 + timeIndex * 10 + weekday);
}

/** ID avulso (tratamento finito / dias alternados). */
function oneOffNotificationId(medId: string, dayOffset: number, timeIndex: number): number {
  const medBase = normalizeMedicationId(medId);
  return Math.min(MAX_NOTIFICATION_ID, medBase * 100000 + dayOffset * 10 + timeIndex);
}

function buildNotificationPayload(
  med: Medication,
  time: string,
  id: number,
  schedule: Schedule,
  occurrenceDate?: string,
): LocalNotificationSchema {
  return {
    title: '💊 Hora do remédio',
    body: `Tomar ${med.dosage} de ${med.name} agora.`,
    id,
    schedule,
    channelId: MED_CHANNEL_ID,
    actionTypeId: NOTIFICATION_ACTION_TYPE,
    smallIcon: 'ic_stat_notification',
    extra: {
      medId: med.id,
      time,
      ...(occurrenceDate ? { date: occurrenceDate } : {}),
    },
  };
}

function scheduleRepeatingDaily(med: Medication, time: string, timeIndex: number): LocalNotificationSchema | null {
  const at = nextFireDate(med, time);
  if (!at) return null;

  const schedule: Schedule = { at, every: 'day' as ScheduleEvery };
  if (!isContinuousTreatment(med) && med.durationDays) {
    schedule.count = med.durationDays;
  }

  return buildNotificationPayload(med, time, stableNotificationId(med.id, timeIndex), schedule);
}

function scheduleRepeatingWeekly(
  med: Medication,
  time: string,
  timeIndex: number,
  jsWeekday: number,
): LocalNotificationSchema | null {
  const [hours, minutes] = time.split(':').map(Number);
  const schedule: Schedule = {
    on: {
      weekday: jsWeekdayToCapacitor(jsWeekday),
      hour: hours,
      minute: minutes,
    },
  };

  return buildNotificationPayload(
    med,
    time,
    stableNotificationId(med.id, timeIndex, jsWeekday),
    schedule,
  );
}

function scheduleFiniteOccurrences(med: Medication): LocalNotificationSchema[] {
  const out: LocalNotificationSchema[] = [];
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const times = computeDailyTimes(med);

  for (let dayOffset = 0; dayOffset < FINITE_SCHEDULE_HORIZON_DAYS; dayOffset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + dayOffset);
    if (!isMedScheduledOn(med, day)) continue;

    const dateStr = formatLocalDate(day);
    times.forEach((time, timeIndex) => {
      const at = buildScheduleDate(day, time);
      if (at <= now) return;

      out.push(
        buildNotificationPayload(
          med,
          time,
          oneOffNotificationId(med.id, dayOffset, timeIndex),
          { at },
          dateStr,
        ),
      );
    });
  }

  return out;
}

function buildMedNotifications(med: Medication): LocalNotificationSchema[] {
  if (med.status !== 'active' || treatmentEnded(med)) return [];

  const times = computeDailyTimes(med);
  const notifications: LocalNotificationSchema[] = [];

  if (med.frequency === 'daily' && isContinuousTreatment(med)) {
    times.forEach((time, timeIndex) => {
      const n = scheduleRepeatingDaily(med, time, timeIndex);
      if (n) notifications.push(n);
    });
    return notifications;
  }

  if (med.frequency === 'weekly' && isContinuousTreatment(med) && (med.weekdays?.length ?? 0) > 0) {
    times.forEach((time, timeIndex) => {
      for (const jsWeekday of med.weekdays!) {
        const n = scheduleRepeatingWeekly(med, time, timeIndex, jsWeekday);
        if (n) notifications.push(n);
      }
    });
    return notifications;
  }

  return scheduleFiniteOccurrences(med);
}

async function ensureExactAlarms(promptUser: boolean): Promise<boolean> {
  if (!isNative()) return true;

  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    if (exact_alarm === 'granted') return true;

    if (promptUser && !exactAlarmPromptShown) {
      exactAlarmPromptShown = true;
      toast.info(
        'Ative "Alarmes e lembretes" nas configurações para receber o aviso na hora do remédio.',
        { duration: 6000 },
      );
      await LocalNotifications.changeExactNotificationSetting();
    }
    return false;
  } catch (error) {
    console.warn('[Notifications] checkExactNotificationSetting:', error);
    return true;
  }
}

function isNative() {
  return Capacitor.isNativePlatform();
}

function emitPermissionGranted() {
  for (const listener of permissionGrantedListeners) {
    try {
      listener();
    } catch (error) {
      console.error('[Notifications] permissionGranted listener failed:', error);
    }
  }
}

export function onNotificationPermissionGranted(listener: () => void) {
  permissionGrantedListeners.add(listener);
  return () => permissionGrantedListeners.delete(listener);
}

async function readPermissionGranted(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch (error) {
    console.error('[Notifications] checkPermissions failed:', error);
    return false;
  }
}

export async function syncNotificationPermissionState(): Promise<boolean> {
  const granted = await readPermissionGranted();
  if (granted) await ensureExactAlarms(false);
  if (granted && lastPermissionGranted !== true) emitPermissionGranted();
  lastPermissionGranted = granted;
  return granted;
}

export async function setupNotificationChannels() {
  if (!isNative()) return;

  try {
    await LocalNotifications.createChannel({
      id: MED_CHANNEL_ID,
      name: 'Lembretes de Medicamentos',
      description: 'Notificações para avisar a hora de tomar seus remédios',
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch (error) {
    console.error('[Notifications] createChannel failed:', error);
  }

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: NOTIFICATION_ACTION_TYPE,
          actions: [{ id: NOTIFICATION_ACTION_ID, title: 'Marcar como Tomado' }],
        },
      ],
    });
  } catch (error) {
    console.error('[Notifications] registerActionTypes failed:', error);
  }
}

export async function requestDisplayNotificationPermission(
  showStatusFeedback = false,
): Promise<PermissionState> {
  if (!isNative()) return 'granted';

  await setupNotificationChannels();

  try {
    let status = await LocalNotifications.checkPermissions();
    if (status.display === 'prompt' || status.display === 'denied') {
      status = await LocalNotifications.requestPermissions();
    }

    const display = status.display;
    console.log('[Notifications] permission display:', display);

    if (showStatusFeedback) {
      toast.message(`Status da permissão: ${display}`);
      window.alert(`Status da permissão: ${display}`);
    }

    const wasGranted = lastPermissionGranted === true;
    lastPermissionGranted = display === 'granted';

    if (display === 'granted') {
      permissionDeniedToastShown = false;
      await ensureExactAlarms(true);
      if (!wasGranted) emitPermissionGranted();
    }

    return display;
  } catch (error) {
    console.error('[Notifications] requestPermissions failed:', error);
    if (showStatusFeedback) {
      toast.error('Erro ao pedir permissão de notificação');
      window.alert('Erro ao pedir permissão de notificação');
    }
    return 'denied';
  }
}

export async function initNotificationPermissions(): Promise<boolean> {
  const display = await requestDisplayNotificationPermission(false);
  return display === 'granted';
}

async function persistMedNotificationIds(medId: string, ids: number[]) {
  const { error } = await supabase
    .from('medications')
    .update({ notification_ids: ids })
    .eq('id', medId);

  if (error) {
    console.error('[Notifications] persist notification_ids failed:', error.message);
    return;
  }
  patchCachedMedNotificationIds(medId, ids);
}

function showPermissionDeniedToast() {
  if (!isNative() || permissionDeniedToastShown) return;
  permissionDeniedToastShown = true;
  toast.error('Ative as notificações nas configurações do celular para receber lembretes dos remédios.');
}

function showRescheduleFeedback(result: RescheduleResult, options?: RescheduleOptions) {
  if (!isNative() || options?.silent) return;

  if (result.permissionDenied && result.activeMeds > 0) {
    showPermissionDeniedToast();
    return;
  }

  if (result.scheduled > 0) {
    permissionDeniedToastShown = false;
    return;
  }

  if (result.noUpcoming && result.activeMeds > 0) {
    toast.info('Nenhum lembrete futuro para agendar. Confira os horários dos medicamentos ativos.');
  }
}

function normalizeMedicationId(medId: string) {
  const digits = medId.replace(/\D/g, '');
  const numericId = digits ? Number(digits.slice(-6)) : NaN;
  if (!Number.isNaN(numericId) && numericId > 0) {
    return numericId % MAX_MED_BASE;
  }
  return Math.abs(hashCode(medId)) % MAX_MED_BASE;
}

export async function scheduleMedNotifications(med: Medication): Promise<number> {
  if (!isNative()) return 0;

  await setupNotificationChannels();
  await cancelMedNotifications(med.id, med.notificationIds ?? []);

  if (med.status !== 'active') {
    await persistMedNotificationIds(med.id, []);
    return 0;
  }
  if (!(await readPermissionGranted())) return 0;
  if (!(await ensureExactAlarms(false))) {
    console.warn('[Notifications] Exact alarms not granted, skipping schedule for', med.name);
    return 0;
  }

  const notifications = buildMedNotifications(med);
  if (notifications.length === 0) {
    await persistMedNotificationIds(med.id, []);
    return 0;
  }

  try {
    const result = await LocalNotifications.schedule({ notifications });
    const ids = notifications.map((n) => n.id);
    await persistMedNotificationIds(med.id, ids);

    console.log(
      `[Notifications] Scheduled ${notifications.length} for ${med.name}`,
      med.frequency,
      'ids',
      ids,
      'confirmed',
      result.notifications.length,
    );

    if (result.notifications.length === 0) {
      toast.error('O sistema não aceitou os lembretes. Verifique Alarmes e lembretes nas configurações.');
      return 0;
    }
    return notifications.length;
  } catch (error) {
    console.error('[Notifications] Error scheduling:', error);
    toast.error('Não foi possível agendar os lembretes. Tente abrir o app novamente.');
    return 0;
  }
}

/** Cancela IDs salvos no banco + qualquer pendente com extra.medId. */
export async function cancelMedNotifications(medId: string, savedIds: number[] = []) {
  if (!isNative()) return;

  try {
    const pending = await LocalNotifications.getPending();
    const idSet = new Set<number>(savedIds);

    for (const n of pending.notifications) {
      if (n.extra?.medId === medId) idSet.add(n.id);
    }

    const toCancel = [...idSet].map((id) => ({ id }));
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }

    await persistMedNotificationIds(medId, []);
  } catch (error) {
    console.error('[Notifications] Error cancelling:', error);
  }
}

export async function cancelAllNotifications() {
  if (!isNative()) return;

  try {
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications.map((n) => ({ id: n.id }));
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }
  } catch (error) {
    console.error('[Notifications] Error cancelling all notifications:', error);
  }
}

export async function rescheduleAllNotifications(
  meds: Medication[],
  options?: RescheduleOptions,
): Promise<RescheduleResult> {
  const activeMeds = meds.filter((m) => m.status === 'active');

  if (!isNative()) {
    return { scheduled: 0, activeMeds: activeMeds.length, permissionDenied: false, noUpcoming: false };
  }

  const granted = await readPermissionGranted();
  lastPermissionGranted = granted;

  if (!granted) {
    const result: RescheduleResult = {
      scheduled: 0,
      activeMeds: activeMeds.length,
      permissionDenied: true,
      noUpcoming: false,
    };
    showRescheduleFeedback(result, options);
    return result;
  }

  await ensureExactAlarms(!options?.silent);
  await cancelAllNotifications();

  let scheduled = 0;
  for (const med of activeMeds) {
    scheduled += await scheduleMedNotifications(med);
  }

  const result: RescheduleResult = {
    scheduled,
    activeMeds: activeMeds.length,
    permissionDenied: false,
    noUpcoming: activeMeds.length > 0 && scheduled === 0,
  };

  showRescheduleFeedback(result, options);
  return result;
}

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
