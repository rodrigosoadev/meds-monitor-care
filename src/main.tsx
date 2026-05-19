import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { LocalNotifications } from '@capacitor/local-notifications'
import { toast } from 'sonner'
import { initNotificationPermissions, NOTIFICATION_ACTION_ID } from './lib/notifications'
import './style.css'

const router = getRouter()

initNotificationPermissions();

LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
  if (action.actionId !== NOTIFICATION_ACTION_ID) return;

  const extra = action.notification.extra as {
    medId?: string;
    date?: string;
    time?: string;
  };
  if (!extra?.medId || !extra?.date || !extra?.time) return;

  try {
    const { markDose } = await import('./lib/storage');
    await markDose(extra.medId, extra.date, extra.time, 'taken');
    toast.success('Dose marcada como tomada ✅');
  } catch (error) {
    console.error('[Notifications] Action mark as taken failed:', error);
  }
});

// Listener para capturar o retorno do navegador (Deep Link)
App.addListener('appUrlOpen', (data) => {
  if (data.url.startsWith('com.medsmonitor.app://')) {
    Browser.close();
    console.log('App URL opened:', data.url);
    router.navigate({ to: '/' });
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
