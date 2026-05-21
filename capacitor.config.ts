import type { CapacitorConfig } from '@capacitor/cli';

/**
 * TanStack Start não gera index.html em dist/client (só assets SSR).
 * Por isso o APK usa server.url para carregar o app do Cloudflare Workers.
 *
 * Após mudar src/ (ex.: notifications.ts): npm run build && npm run deploy:cloudflare
 * Depois: npx cap sync android e Run no Android Studio (parte nativa).
 *
 * Para bundle 100% local no futuro, seria preciso um build SPA separado.
 */
const CLOUDFLARE_APP_URL = 'https://tanstack-start-app.rodrigo-med-app.workers.dev';

const config: CapacitorConfig = {
  appId: 'com.medsmonitor.app',
  appName: 'Meds Monitor Care',
  webDir: 'dist/client',
  server: {
    url: CLOUDFLARE_APP_URL,
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_notification',
      iconColor: '#0ea5e9',
    },
  },
};

export default config;
