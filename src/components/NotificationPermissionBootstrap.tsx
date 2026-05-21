import { useEffect } from 'react';
import { requestDisplayNotificationPermission } from '@/lib/notifications';

/** Pede permissão de notificação (Android 13+) na primeira abertura do app. */
export function NotificationPermissionBootstrap() {
  useEffect(() => {
    void requestDisplayNotificationPermission(false);
  }, []);

  return null;
}
