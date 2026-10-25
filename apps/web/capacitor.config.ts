import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dramatrace.app',
  appName: '剧迹 DramaTrace',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
