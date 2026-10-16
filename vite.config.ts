import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'Kunskapsportalen',
      short_name: 'Kunskapsportalen',
      description: 'Ett äventyr fullt av nya upptäckter.',
      lang: 'sv',
      theme_color: '#7651d6',
      background_color: '#faf9ff',
      display: 'standalone',
      start_url: '/',
      icons: [{ src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
  })],
})
