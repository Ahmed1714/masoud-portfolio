import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.masoud.hub',
  appName: 'Masoud Hub',
  webDir: 'dist',
  backgroundColor: '#0e0e0e',
  android: { allowMixedContent: false },
  plugins: {
    // Routes fetch() through native HTTP so Notion / AI APIs work without CORS limits.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
