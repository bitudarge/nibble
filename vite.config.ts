/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// See https://vite.dev/config/ for the full list of options.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Makes Nibbles installable (Add to Home Screen on phone, Install in a
    // desktop browser) and precaches the built app shell so repeat visits
    // load instantly. Deliberately NOT full offline data sync with
    // Supabase, that's a much bigger project, this is just shell
    // installability + basic offline resilience for static assets.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-180.png'],
      manifest: {
        name: 'Nibbles',
        short_name: 'Nibbles',
        description: 'Track what you read, with friends.',
        start_url: '/',
        display: 'standalone',
        background_color: '#F5FBF1',
        theme_color: '#F5FBF1',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built shell (JS/CSS/HTML/icons); never cache API
        // calls to Supabase/Open Library/Google Books, those must always
        // be fresh or fail honestly, not silently serve stale data.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // .claude/worktrees holds temporary git worktrees for background
    // agents (nested copies of this repo) — without this, running tests
    // locally while any are active picks up their test files too,
    // duplicating and inflating the count.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
