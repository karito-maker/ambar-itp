import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'ÁMBAR',
  webDir: 'www',

  server: {
    androidScheme: 'https',
    cleartext: true
  },

  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;