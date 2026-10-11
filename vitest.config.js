import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['tests/*.unit.test.js', 'client/src/**/*.test.jsx'],
    environment: 'jsdom',
    globals: false,
  },
  oxc: { jsx: { runtime: 'automatic' } },
})
