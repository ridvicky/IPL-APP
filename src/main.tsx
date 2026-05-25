import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Initialize Capacitor native plugins after React mounts.
// Dynamic imports + isNativePlatform guard = zero effect on web bundle.
async function initCapacitorPlugins() {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) return

  const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/splash-screen'),
    import('@capacitor/status-bar'),
  ])

  await SplashScreen.hide({ fadeOutDuration: 300 })
  await StatusBar.setStyle({ style: Style.Dark })
  await StatusBar.setBackgroundColor({ color: '#1a1a2e' })
}

initCapacitorPlugins().catch(console.error)
