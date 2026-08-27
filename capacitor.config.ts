import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.actionanand.birthdaybuddy.app',
  appName: 'Birthday Buddy',
  webDir: 'www',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#f6f3ec' },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_birthday_buddy',
      iconColor: '#397153',
    },
    SplashScreen: {
      launchShowDuration: 1_800,
      backgroundColor: '#f6f3ec',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#f6f3ec',
    },
  },
};

export default config;
