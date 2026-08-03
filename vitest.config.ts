import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Nested git worktrees under .claude/worktrees/ have their own node_modules
    // (a separate React copy) — without this exclude, Vitest's default file
    // discovery walks into them and duplicate-loads React, causing spurious
    // "Invalid hook call" failures in tests that are otherwise correct.
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
