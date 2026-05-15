import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Medication, isMedScheduledOn, computeDailyTimes } from './storage';

const MED_CHANNEL_ID = 'medication-reminders';
const NOTIFICATION_ACTION_TYPE = 'MARK_AS_TAKEN';
export const NOTIFICATION_ACTION_ID = 'mark_taken';
const MAX_NOTIFICATION_ID = 2147483647;
const MAX_MED_BASE = 2147483; // base * 1000 + dayOffset stays within safe range

export async function setupNotificationChannels() {
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

async function hasNotificationPermission() {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch (error) {
    console.error('[Notifications] checkPermissions failed:', error);
    return false;
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

export async function scheduleMedNotifications(med: Medication) {
  await setupNotificationChannels();
  await cancelMedNotifications(med.id);

  if (med.status !== 'active') return;
  if (!(await hasNotificationPermission())) return;

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

  if (notifications.length === 0) return;

  try {
    await LocalNotifications.schedule({ notifications });
    console.log(`[Notifications] Scheduled ${notifications.length} alerts for ${med.name}`);
  } catch (error) {
    console.error('[Notifications] Error scheduling:', error);
  }
}

export async function cancelMedNotifications(medId: string) {
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

export async function rescheduleAllNotifications(meds: Medication[]) {
  await cancelAllNotifications();
  for (const med of meds) {
    await scheduleMedNotifications(med);
  }
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
