import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
