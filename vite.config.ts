import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/speed-reader-pwa/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg'],
      manifest: {
        name: 'Speed Reader',
        short_name: 'Speed Reader',
        description: 'A private, offline-ready ebook reader with speed-practice tools.',
        theme_color: '#f7f2e8',
        background_color: '#f7f2e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/speed-reader-pwa/',
        scope: '/speed-reader-pwa/',
        icons: [
          {
            src: 'app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
})
