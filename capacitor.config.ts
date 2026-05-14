import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medsmonitor.app',
  appName: 'Meds Monitor Care',
  webDir: 'dist/client',
  server: {
    url: 'https://tanstack-start-app.rodrigo-med-app.workers.dev', 
    cleartext: true
  }
};

export default config;
