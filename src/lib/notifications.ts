import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { toast } from 'sonner';
import { Medication, isMedScheduledOn, computeDailyTimes } from './storage';

const MED_CHANNEL_ID = 'medication-reminders';
const NOTIFICATION_ACTION_TYPE = 'MARK_AS_TAKEN';
export const NOTIFICATION_ACTION_ID = 'mark_taken';
const MAX_NOTIFICATION_ID = 2147483647;
const MAX_MED_BASE = 2147483; // base * 1000 + dayOffset stays within safe range

export type RescheduleOptions = {
  /** Suppress user-facing toasts (e.g. background refresh). */
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
const permissionGrantedListeners = new Set<() => void>();

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

/** Register callback to reschedule meds when notification permission is newly granted. */
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

/** Detect grant after system settings or first dialog; emits listeners on transition to granted. */
export async function syncNotificationPermissionState(): Promise<boolean> {
  const granted = await readPermissionGranted();
  if (granted && lastPermissionGranted !== true) {
    emitPermissionGranted();
  }
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
          actions: [
            {
              id: NOTIFICATION_ACTION_ID,
              title: 'Marcar como Tomado',
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('[Notifications] registerActionTypes failed:', error);
  }
}

/** Create channels and request permission; re-schedules via listeners when newly granted. */
export async function initNotificationPermissions(): Promise<boolean> {
  if (!isNative()) return false;

  await setupNotificationChannels();

  const before = await readPermissionGranted();
  lastPermissionGranted = before;
  if (before) return true;

  try {
    const { display } = await LocalNotifications.requestPermissions();
    const granted = display === 'granted';
    lastPermissionGranted = granted;
    if (granted) {
      permissionDeniedToastShown = false;
      emitPermissionGranted();
    }
    return granted;
  } catch (error) {
    console.error('[Notifications] requestPermissions failed:', error);
    return false;
  }
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

function notificationId(medId: string, dayOffset: number, timeIndex: number) {
  const medBase = normalizeMedicationId(medId);
  return Math.min(MAX_NOTIFICATION_ID, medBase * 100000 + dayOffset * 10 + timeIndex);
}

export async function scheduleMedNotifications(med: Medication): Promise<number> {
  if (!isNative()) return 0;

  await setupNotificationChannels();
  await cancelMedNotifications(med.id);

  if (med.status !== 'active') return 0;
  if (!(await readPermissionGranted())) return 0;

  const notifications: LocalNotificationSchema[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + dayOffset);

    if (!isMedScheduledOn(med, currentDate)) continue;

    const times = computeDailyTimes(med);
    times.forEach((time, timeIndex) => {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduleDate = new Date(currentDate);
      scheduleDate.setHours(hours, minutes, 0, 0);

      if (scheduleDate <= new Date()) return;

      notifications.push({
        title: '💊 Hora do remédio',
        body: `Tomar ${med.dosage} de ${med.name} agora.`,
        id: notificationId(med.id, dayOffset, timeIndex),
        schedule: { at: scheduleDate, allowWhileIdle: true },
        channelId: MED_CHANNEL_ID,
        actionTypeId: NOTIFICATION_ACTION_TYPE,
        extra: {
          medId: med.id,
          date: currentDate.toISOString().slice(0, 10),
          time,
        },
      });
    });
  }

  if (notifications.length === 0) return 0;

  try {
    await LocalNotifications.schedule({ notifications });
    console.log(`[Notifications] Scheduled ${notifications.length} alerts for ${med.name}`);
    return notifications.length;
  } catch (error) {
    console.error('[Notifications] Error scheduling:', error);
    if (isNative()) {
      toast.error('Não foi possível agendar os lembretes. Tente abrir o app novamente.');
    }
    return 0;
  }
}

export async function cancelMedNotifications(medId: string) {
  if (!isNative()) return;

  try {
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications
      .filter((n) => n.extra?.medId === medId)
      .map((n) => ({ id: n.id }));

    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }
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
