import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.023321bd72b04e009519e4dc0d48c63f',
  appName: 'topha',
  webDir: 'dist',
  server: {
    url: 'https://023321bd-72b0-4e00-9519-e4dc0d48c63f.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    // Enable overlay permission request
    allowMixedContent: true
  }
};

export default config;
