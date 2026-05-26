import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'GPL Auction',
        short_name: 'GPL Auction',
        description: 'Geek Premier League — GPL Auction Simulator with AI franchise owners',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@personas': path.resolve(__dirname, 'src/personas'),
      '@store': path.resolve(__dirname, 'src/store'),
      '@session': path.resolve(__dirname, 'src/session'),
      '@llm': path.resolve(__dirname, 'src/llm'),
      '@dataset': path.resolve(__dirname, 'src/dataset'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@screens': path.resolve(__dirname, 'src/screens'),
    },
  },
})
