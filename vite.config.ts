import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' — приложение работает из любой подпапки GitHub Pages (имя.github.io/<репо>/)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'Династия',
        short_name: 'Династия',
        description: 'Игра-тренажёр комплексного таргетинга: Instagram и Telegram Ads',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0E0E10',
        theme_color: '#0E0E10',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}'],
        // Фоны стадий кэшируем по мере открытия, чтобы они работали офлайн
        runtimeCaching: [
          { urlPattern: /\/art\/.*\.webp$/, handler: 'CacheFirst', options: { cacheName: 'art', expiration: { maxEntries: 80 } } },
          { urlPattern: /\/models\/.*\.glb$/, handler: 'CacheFirst', options: { cacheName: 'models', expiration: { maxEntries: 20 } } },
        ],
      },
    }),
  ],
})
