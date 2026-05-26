import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.iplauction.simulator',
  appName: 'GPL Auction',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: '#1a1a2e',
      showSpinner: false,
      spinnerColor: '#e94560',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
}

export default config
