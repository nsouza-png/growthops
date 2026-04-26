import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// build: v18 — MECE sitemap: nova estrutura de navegação
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/growthops/' : '/',
  build: {
    // Remove todos os console.log/warn/error no bundle de produção via oxc
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-v18.js`,
        chunkFileNames: `assets/[name]-[hash]-v18.js`,
        assetFileNames: `assets/[name]-[hash][extname]`,
      },
    },
    ...(command === 'build' ? {
      oxc: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    } : {}),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
}))
